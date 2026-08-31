"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../socket/client";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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
  isOfferer: boolean;
  audioSender: RTCRtpSender | null;
  videoSender: RTCRtpSender | null;
  hasRemoteDesc: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

function trackOfKind(stream: MediaStream | null, kind: "audio" | "video") {
  return stream?.getTracks().find((t) => t.kind === kind) ?? null;
}

/**
 * Full-mesh WebRTC for a small game room (2–4 humans).
 *
 * To keep it simple and glare-free: for each pair, the peer with the smaller
 * userId is the sole offerer and creates two sendrecv transceivers up front.
 * The other side answers. After that, mic/camera are toggled purely with
 * `replaceTrack` — no renegotiation ever. Signaling is relayed by the socket
 * server (webrtc-handler.ts).
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

  const updateRemote = useCallback(
    (userId: string, patch: Partial<RemotePeer>) => {
      setRemotePeers((prev) => {
        const next = new Map(prev);
        const existing = next.get(userId);
        const stream = patch.stream || existing?.stream || new MediaStream();
        next.set(userId, {
          userId,
          stream,
          connState: patch.connState ?? existing?.connState ?? "new",
          hasAudio: patch.hasAudio ?? existing?.hasAudio ?? false,
          hasVideo: patch.hasVideo ?? existing?.hasVideo ?? false,
        });
        return next;
      });
    },
    []
  );

  const syncLocalTracks = useCallback((rec: PeerRecord) => {
    const s = localStreamRef.current;
    if (rec.audioSender) void rec.audioSender.replaceTrack(trackOfKind(s, "audio"));
    if (rec.videoSender) void rec.videoSender.replaceTrack(trackOfKind(s, "video"));
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

  const ensurePeer = useCallback(
    (peerUserId: string): PeerRecord => {
      const existing = peersRef.current.get(peerUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const isOfferer = myUserId < peerUserId;
      const rec: PeerRecord = {
        pc,
        isOfferer,
        audioSender: null,
        videoSender: null,
        hasRemoteDesc: false,
        pendingCandidates: [],
      };
      peersRef.current.set(peerUserId, rec);

      if (isOfferer) {
        const at = pc.addTransceiver("audio", { direction: "sendrecv" });
        const vt = pc.addTransceiver("video", { direction: "sendrecv" });
        rec.audioSender = at.sender;
        rec.videoSender = vt.sender;
        syncLocalTracks(rec);
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(peerUserId, { candidate: e.candidate });
      };

      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        const isLive = (t: MediaStreamTrack) =>
          t.readyState === "live" && !t.muted;
        const refresh = () =>
          updateRemote(peerUserId, {
            stream,
            hasAudio: stream.getAudioTracks().some(isLive),
            hasVideo: stream.getVideoTracks().some(isLive),
          });
        refresh();
        stream.onaddtrack = refresh;
        stream.onremovetrack = refresh;
        e.track.onmute = refresh;
        e.track.onunmute = refresh;
        e.track.onended = refresh;
      };

      pc.onconnectionstatechange = () => {
        const map: Record<string, PeerConnState> = {
          new: "new",
          connecting: "connecting",
          connected: "connected",
          disconnected: "disconnected",
          failed: "failed",
          closed: "disconnected",
        };
        updateRemote(peerUserId, { connState: map[pc.connectionState] ?? "new" });
        if (pc.connectionState === "failed") {
          try {
            pc.restartIce();
          } catch {
            /* noop */
          }
        }
      };

      pc.onnegotiationneeded = async () => {
        if (!rec.isOfferer) return;
        try {
          await pc.setLocalDescription();
          sendSignal(peerUserId, { description: pc.localDescription });
        } catch (err) {
          console.error("[rtc] negotiation error", err);
        }
      };

      return rec;
    },
    [myUserId, sendSignal, updateRemote, syncLocalTracks]
  );

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
          await pc.setRemoteDescription(data.description);
          rec.hasRemoteDesc = true;
          for (const c of rec.pendingCandidates.splice(0)) {
            try {
              await pc.addIceCandidate(c);
            } catch {
              /* noop */
            }
          }
          if (data.description.type === "offer") {
            // We're the answerer — keep both directions open and bind senders.
            for (const t of pc.getTransceivers()) {
              try {
                t.direction = "sendrecv";
              } catch {
                /* transceiver may be stopped */
              }
              const kind = t.receiver.track?.kind;
              if (kind === "audio") rec.audioSender = t.sender;
              if (kind === "video") rec.videoSender = t.sender;
            }
            const txs = pc.getTransceivers();
            if (!rec.audioSender && txs[0]) rec.audioSender = txs[0].sender;
            if (!rec.videoSender && txs[1]) rec.videoSender = txs[1].sender;
            syncLocalTracks(rec);
            await pc.setLocalDescription();
            sendSignal(fromUserId, { description: pc.localDescription });
          }
        } else if (data.candidate) {
          if (!rec.hasRemoteDesc) {
            rec.pendingCandidates.push(data.candidate);
          } else {
            try {
              await pc.addIceCandidate(data.candidate);
            } catch {
              /* noop */
            }
          }
        }
      } catch (err) {
        console.error("[rtc] signal handling error", err);
      }
    },
    [ensurePeer, myUserId, sendSignal, syncLocalTracks]
  );

  // Push local mic/cam track changes to every peer (no renegotiation).
  useEffect(() => {
    for (const [, rec] of peersRef.current) syncLocalTracks(rec);
  }, [localStream, syncLocalTracks]);

  // Dev-only debug handle (window.__peerMesh) for manual QA.
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
      return;
    }
    (window as unknown as Record<string, unknown>).__peerMesh = {
      stats: () =>
        [...peersRef.current.entries()].map(([id, r]) => ({
          id,
          offerer: r.isOfferer,
          connectionState: r.pc.connectionState,
          iceConnectionState: r.pc.iceConnectionState,
          transceivers: r.pc
            .getTransceivers()
            .map(
              (t) =>
                `${t.receiver.track?.kind ?? t.sender.track?.kind ?? "?"}:${
                  t.currentDirection ?? t.direction
                }`
            ),
        })),
      setLocalTracks: (stream: MediaStream | null) => {
        localStreamRef.current = stream;
        for (const [, r] of peersRef.current) syncLocalTracks(r);
      },
    };
  });

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
