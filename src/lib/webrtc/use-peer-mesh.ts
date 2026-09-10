"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../socket/client";

// Baseline (STUN only). The real list — including a TURN relay for phones on
// different networks — is fetched once from /api/webrtc/ice.
const FALLBACK_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
let cachedIce: RTCIceServer[] | null = null;
let icePromise: Promise<RTCIceServer[]> | null = null;

let iceHasTurn = false;

async function loadIceServers(): Promise<RTCIceServer[]> {
  if (cachedIce) return cachedIce;
  if (!icePromise) {
    icePromise = fetch("/api/webrtc/ice")
      .then((r) => r.json())
      .then((d): RTCIceServer[] => {
        const list: RTCIceServer[] =
          Array.isArray(d?.iceServers) && d.iceServers.length
            ? d.iceServers
            : FALLBACK_ICE;
        iceHasTurn = !!d?.hasTurn;
        cachedIce = list;
        return list;
      })
      .catch((): RTCIceServer[] => FALLBACK_ICE);
  }
  return icePromise;
}

export type PeerConnState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export interface RemotePeer {
  userId: string;
  stream: MediaStream;
  connState: PeerConnState;
  hasAudio: boolean;
  hasVideo: boolean;
}

interface PeerRecord {
  pc: RTCPeerConnection;
  initiator: boolean;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  hasRemote: boolean;
  iceRestarted: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  audioTx: RTCRtpTransceiver | null;
  videoTx: RTCRtpTransceiver | null;
  remoteStream: MediaStream;
}

function trackOfKind(stream: MediaStream | null, kind: "audio" | "video") {
  return stream?.getTracks().find((t) => t.kind === kind) ?? null;
}

/**
 * Full-mesh WebRTC for a small game room (2–4 humans).
 *
 * For each pair the peer with the LOWER userId is the sole initiator: it adds
 * the audio+video transceivers and sends the first offer, so the opening
 * handshake is glare-free and produces a clean two-line SDP. After that either
 * side may toggle mic/camera — `replaceTrack` needs no renegotiation, and a
 * direction change (recvonly⇄sendrecv) renegotiates via perfect-negotiation.
 * Signaling is relayed by the socket server (webrtc-handler.ts).
 */
export function usePeerMesh(
  gameId: string,
  myUserId: string,
  localStream: MediaStream | null,
  enabled: boolean
) {
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(
    new Map()
  );
  const peersRef = useRef<Map<string, PeerRecord>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const knownPeerIds = useRef<Set<string>>(new Set());
  localStreamRef.current = localStream;

  const sendSignal = useCallback((toUserId: string, data: unknown) => {
    getSocket().emit("webrtc:signal", { toUserId, data });
  }, []);

  const publish = useCallback((userId: string, rec: PeerRecord) => {
    const isLive = (t: MediaStreamTrack) => t.readyState === "live" && !t.muted;
    setRemotePeers((prev) => {
      const next = new Map(prev);
      const map: Record<string, PeerConnState> = {
        new: "new",
        connecting: "connecting",
        connected: "connected",
        disconnected: "disconnected",
        failed: "failed",
        closed: "disconnected",
      };
      next.set(userId, {
        userId,
        stream: rec.remoteStream,
        connState: map[rec.pc.connectionState] ?? "new",
        hasAudio: rec.remoteStream.getAudioTracks().some(isLive),
        hasVideo: rec.remoteStream.getVideoTracks().some(isLive),
      });
      return next;
    });
  }, []);

  const dropPeer = useCallback((userId: string) => {
    const rec = peersRef.current.get(userId);
    if (rec) {
      rec.pc.onicecandidate = null;
      rec.pc.ontrack = null;
      rec.pc.onnegotiationneeded = null;
      rec.pc.onconnectionstatechange = null;
      try {
        rec.pc.close();
      } catch {
        /* noop */
      }
      peersRef.current.delete(userId);
    }
    setRemotePeers((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const bindTransceivers = useCallback((rec: PeerRecord) => {
    for (const t of rec.pc.getTransceivers()) {
      const kind = t.receiver.track?.kind ?? t.sender.track?.kind;
      if (kind === "audio" && !rec.audioTx) rec.audioTx = t;
      if (kind === "video" && !rec.videoTx) rec.videoTx = t;
    }
    const txs = rec.pc.getTransceivers();
    if (!rec.audioTx && txs[0]) rec.audioTx = txs[0];
    if (!rec.videoTx && txs[1]) rec.videoTx = txs[1];
  }, []);

  /** Match the transceivers to whatever local mic/camera we currently have. */
  const syncLocalTracks = useCallback(
    (rec: PeerRecord) => {
      const s = localStreamRef.current;
      for (const kind of ["audio", "video"] as const) {
        const tx = kind === "audio" ? rec.audioTx : rec.videoTx;
        if (!tx) continue;
        const track = trackOfKind(s, kind);
        void tx.sender.replaceTrack(track);
        const want: RTCRtpTransceiverDirection = track ? "sendrecv" : "recvonly";
        if (tx.direction !== want && tx.direction !== "stopped") {
          try {
            tx.direction = want; // may trigger onnegotiationneeded
          } catch {
            /* noop */
          }
        }
      }
    },
    []
  );

  const ensurePeer = useCallback(
    (peerUserId: string): PeerRecord => {
      const existing = peersRef.current.get(peerUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({
        iceServers: cachedIce ?? FALLBACK_ICE,
      });
      const initiator = myUserId < peerUserId;
      const rec: PeerRecord = {
        pc,
        initiator,
        polite: !initiator, // the answerer yields on a collision
        makingOffer: false,
        ignoreOffer: false,
        hasRemote: false,
        iceRestarted: false,
        pendingCandidates: [],
        audioTx: null,
        videoTx: null,
        remoteStream: new MediaStream(),
      };
      peersRef.current.set(peerUserId, rec);

      if (initiator) {
        const haveA = !!trackOfKind(localStreamRef.current, "audio");
        const haveV = !!trackOfKind(localStreamRef.current, "video");
        rec.audioTx = pc.addTransceiver("audio", {
          direction: haveA ? "sendrecv" : "recvonly",
        });
        rec.videoTx = pc.addTransceiver("video", {
          direction: haveV ? "sendrecv" : "recvonly",
        });
        syncLocalTracks(rec);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(peerUserId, { candidate: e.candidate });
      };

      pc.ontrack = (e) => {
        if (!rec.remoteStream.getTracks().includes(e.track)) {
          rec.remoteStream.addTrack(e.track);
        }
        const refresh = () => publish(peerUserId, rec);
        e.track.onended = () => {
          try {
            rec.remoteStream.removeTrack(e.track);
          } catch {
            /* noop */
          }
          refresh();
        };
        e.track.onmute = refresh;
        e.track.onunmute = refresh;
        refresh();
      };

      pc.onconnectionstatechange = () => {
        publish(peerUserId, rec);
      };

      pc.oniceconnectionstatechange = () => {
        // One ICE restart attempt (initiator only), if the path drops.
        if (
          pc.iceConnectionState === "failed" &&
          rec.initiator &&
          !rec.iceRestarted
        ) {
          rec.iceRestarted = true;
          try {
            pc.restartIce();
          } catch {
            /* noop */
          }
        }
      };

      pc.onnegotiationneeded = async () => {
        // Standard perfect-negotiation guard: only offer from a stable state.
        if (pc.signalingState !== "stable") return;
        try {
          rec.makingOffer = true;
          await pc.setLocalDescription();
          sendSignal(peerUserId, { description: pc.localDescription });
        } catch (err) {
          console.error("[rtc] negotiation error", err);
        } finally {
          rec.makingOffer = false;
        }
      };

      return rec;
    },
    [myUserId, sendSignal, publish, syncLocalTracks]
  );

  const flushCandidates = useCallback(async (rec: PeerRecord) => {
    for (const c of rec.pendingCandidates.splice(0)) {
      try {
        await rec.pc.addIceCandidate(c);
      } catch {
        /* noop */
      }
    }
  }, []);

  const handleSignal = useCallback(
    async ({
      fromUserId,
      data,
    }: {
      fromUserId: string;
      data: {
        description?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
      };
    }) => {
      if (fromUserId === myUserId) return;
      knownPeerIds.current.add(fromUserId);
      const rec = ensurePeer(fromUserId);
      const { pc } = rec;

      try {
        if (data.description) {
          // Drop stale answers (e.g. after a duplicate offer): we only accept
          // an answer while we're actually waiting for one.
          if (
            data.description.type === "answer" &&
            pc.signalingState !== "have-local-offer"
          ) {
            return;
          }

          const collision =
            data.description.type === "offer" &&
            (rec.makingOffer || pc.signalingState !== "stable");
          rec.ignoreOffer = !rec.polite && collision;
          if (rec.ignoreOffer) return;

          await pc.setRemoteDescription(data.description);
          rec.hasRemote = true;
          bindTransceivers(rec);
          await flushCandidates(rec);

          if (data.description.type === "offer") {
            // answerer: keep our own media flowing on the negotiated m-lines
            syncLocalTracks(rec);
            await pc.setLocalDescription();
            sendSignal(fromUserId, { description: pc.localDescription });
          }
        } else if (data.candidate) {
          if (!rec.hasRemote) {
            rec.pendingCandidates.push(data.candidate);
          } else {
            try {
              await pc.addIceCandidate(data.candidate);
            } catch (err) {
              if (!rec.ignoreOffer) console.warn("[rtc] addIceCandidate", err);
            }
          }
        }
      } catch (err) {
        console.error("[rtc] signal handling error", err);
      }
    },
    [ensurePeer, myUserId, sendSignal, bindTransceivers, flushCandidates, syncLocalTracks]
  );

  // Local mic/cam changed → reconcile every peer.
  useEffect(() => {
    for (const [, rec] of peersRef.current) syncLocalTracks(rec);
  }, [localStream, syncLocalTracks]);

  // Dev-only debug handle.
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
      return;
    }
    (window as unknown as Record<string, unknown>).__peerMesh = {
      stats: () =>
        [...peersRef.current.entries()].map(([id, r]) => ({
          id,
          initiator: r.initiator,
          connectionState: r.pc.connectionState,
          iceConnectionState: r.pc.iceConnectionState,
          signalingState: r.pc.signalingState,
          transceivers: r.pc
            .getTransceivers()
            .map(
              (t) =>
                `${t.receiver.track?.kind ?? t.sender.track?.kind ?? "?"}:` +
                `${t.currentDirection ?? t.direction}`
            ),
          remoteTracks: r.remoteStream.getTracks().map((t) => t.kind),
        })),
      setLocalTracks: (stream: MediaStream | null) => {
        localStreamRef.current = stream;
        for (const [, r] of peersRef.current) syncLocalTracks(r);
      },
    };
  });

  // Preload the ICE list. If a TURN relay is configured, push it onto any peer
  // that hasn't connected yet and retry ICE (STUN-only stays untouched so a
  // working same-network call isn't disturbed).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadIceServers().then((servers) => {
      if (cancelled || !iceHasTurn) return;
      for (const [, rec] of peersRef.current) {
        try {
          rec.pc.setConfiguration({ iceServers: servers });
          if (
            rec.initiator &&
            rec.pc.connectionState !== "connected" &&
            rec.pc.signalingState === "stable"
          ) {
            rec.pc.restartIce();
          }
        } catch {
          /* setConfiguration unsupported / pc closed */
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Socket wiring + presence.
  useEffect(() => {
    if (!enabled || !gameId || !myUserId) return;
    const socket = getSocket();

    const onPeers = ({ peers }: { peers: string[] }) => {
      peers.forEach((p) => {
        knownPeerIds.current.add(p);
        ensurePeer(p);
      });
    };
    const onPeerJoined = ({ userId }: { userId: string }) => {
      if (userId === myUserId) return;
      knownPeerIds.current.add(userId);
      ensurePeer(userId);
    };
    const onPeerLeft = ({ userId }: { userId: string }) => dropPeer(userId);

    const join = () => socket.emit("webrtc:join", { gameId, userId: myUserId });
    const onReconnect = () => {
      for (const id of [...peersRef.current.keys()]) dropPeer(id);
      join();
    };

    socket.on("webrtc:peers", onPeers);
    socket.on("webrtc:peer-joined", onPeerJoined);
    socket.on("webrtc:peer-left", onPeerLeft);
    socket.on("webrtc:signal", handleSignal);
    socket.on("connect", onReconnect);
    join();

    return () => {
      socket.emit("webrtc:leave", { gameId });
      socket.off("webrtc:peers", onPeers);
      socket.off("webrtc:peer-joined", onPeerJoined);
      socket.off("webrtc:peer-left", onPeerLeft);
      socket.off("webrtc:signal", handleSignal);
      socket.off("connect", onReconnect);
      for (const id of [...peersRef.current.keys()]) dropPeer(id);
      knownPeerIds.current.clear();
    };
  }, [enabled, gameId, myUserId, ensurePeer, dropPeer, handleSignal]);

  return remotePeers;
}
