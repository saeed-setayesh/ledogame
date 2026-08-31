"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { usePeerMesh, type RemotePeer } from "@/lib/webrtc/use-peer-mesh";

export type LocalVideoState = {
  enabled: boolean;
  stream: MediaStream | null;
};

export type PeerAudioState = {
  userId: string;
  connected: boolean;
  speakingAudio: boolean;
  hasVideo: boolean;
};

interface VideoCallProps {
  gameId: string;
  userId: string;
  players: { id: string; userId: string; username?: string }[];
  /** If true, only render control buttons (for bottom bar). */
  compact?: boolean;
  /** Whether to play incoming voice/video from other players. */
  soundEnabled?: boolean;
  onLocalVideoChange?: (state: LocalVideoState) => void;
  onMicChange?: (on: boolean) => void;
  onPeersChange?: (peers: PeerAudioState[]) => void;
  cameraIconSrc?: string;
  micIconSrc?: string;
}

export default function VideoCall({
  gameId,
  userId,
  players,
  compact,
  soundEnabled = true,
  onLocalVideoChange,
  onMicChange,
  onPeersChange,
  cameraIconSrc = "/game/icons/camera.png",
  micIconSrc = "/game/icons/mic.png",
}: VideoCallProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const remotePeers = usePeerMesh(gameId, userId, localStream, true);

  const notifyVideo = useCallback(
    (enabled: boolean, stream: MediaStream | null) => {
      onLocalVideoChange?.({ enabled, stream });
    },
    [onLocalVideoChange]
  );

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    notifyVideo(isVideoEnabled, isVideoEnabled ? localStream : null);
  }, [isVideoEnabled, localStream, notifyVideo]);

  useEffect(() => {
    onMicChange?.(isAudioEnabled && !!localStream);
  }, [isAudioEnabled, localStream, onMicChange]);

  // Bubble peer audio/video state up so PlayerCards can show a mic indicator.
  useEffect(() => {
    if (!onPeersChange) return;
    onPeersChange(
      [...remotePeers.values()].map((p) => ({
        userId: p.userId,
        connected: p.connState === "connected",
        speakingAudio: p.hasAudio && p.connState === "connected",
        hasVideo: p.hasVideo,
      }))
    );
  }, [remotePeers, onPeersChange]);

  // Acquire / release the local mic+cam whenever the toggles change.
  useEffect(() => {
    let cancelled = false;
    const want = isVideoEnabled || isAudioEnabled;

    if (!want) {
      setLocalStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMediaError("Camera / microphone not available here");
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: isVideoEnabled, audio: isAudioEnabled })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setMediaError(null);
        setLocalStream((prev) => {
          prev?.getTracks().forEach((t) => t.stop());
          return stream;
        });
      })
      .catch((error: DOMException) => {
        if (cancelled) return;
        console.error("Error accessing media devices:", error);
        if (
          error?.name === "NotFoundError" ||
          error?.name === "OverconstrainedError"
        ) {
          setMediaError("No camera / microphone found");
        } else if (error?.name === "NotAllowedError") {
          setMediaError("Permission denied — allow camera/mic access");
        } else {
          setMediaError("Couldn't start camera / microphone");
        }
        setIsVideoEnabled(false);
        setIsAudioEnabled(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isVideoEnabled, isAudioEnabled]);

  useEffect(
    () => () => {
      setLocalStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
    },
    []
  );

  const toggleVideo = () => {
    setMediaError(null);
    setIsVideoEnabled((v) => !v);
  };
  const toggleAudio = () => {
    setMediaError(null);
    setIsAudioEnabled((a) => !a);
  };

  const btnClass = (on: boolean) =>
    cn(
      compact
        ? "min-h-10 min-w-10 h-10 w-10 rounded-xl flex items-center justify-center bg-white shadow-inner"
        : "min-h-12 min-w-12 h-12 w-12 md:h-14 md:w-14 rounded-xl flex items-center justify-center",
      "transition-all duration-300 hover:scale-105 active:scale-95",
      compact
        ? "border border-[#f0cf8c]"
        : "border border-amber-500/35 bg-black/35 backdrop-blur-sm",
      on
        ? compact
          ? "ring-2 ring-[#f5a22b]/80"
          : "ring-2 ring-emerald-500/60 border-2"
        : "opacity-70"
    );

  const remoteList = [...remotePeers.values()];
  const remoteVideos = remoteList.filter((p) => p.hasVideo);
  const connectedCount = remoteList.filter(
    (p) => p.connState === "connected"
  ).length;

  return (
    <div className={cn("flex items-center gap-2", compact && "relative")}>
      {mediaError && (
        <div className="pointer-events-none absolute -top-9 left-0 z-50 whitespace-nowrap rounded bg-red-600/95 px-2 py-1 text-[10px] font-semibold text-white shadow-lg">
          {mediaError}
        </div>
      )}

      <button
        type="button"
        onClick={toggleVideo}
        className={btnClass(isVideoEnabled)}
        title={isVideoEnabled ? "Turn camera off" : "Turn camera on"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cameraIconSrc}
          alt=""
          className={
            compact
              ? "w-6 h-6 object-contain"
              : "w-7 h-7 md:w-8 md:h-8 object-contain"
          }
        />
      </button>

      <button
        type="button"
        onClick={toggleAudio}
        className={cn(btnClass(isAudioEnabled), "relative")}
        title={isAudioEnabled ? "Mute microphone" : "Talk (unmute mic)"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={micIconSrc}
          alt=""
          className={
            compact
              ? "w-6 h-6 object-contain"
              : "w-7 h-7 md:w-8 md:h-8 object-contain"
          }
        />
        {isAudioEnabled && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
        )}
        {connectedCount > 0 && (
          <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2563eb] px-0.5 text-[9px] font-bold text-white ring-2 ring-white">
            {connectedCount}
          </span>
        )}
      </button>

      {/* Hidden audio sinks so remote voices are actually heard. */}
      {remoteList.map((p) => (
        <RemoteAudio key={`a-${p.userId}`} peer={p} muted={!soundEnabled} />
      ))}

      {/* Floating video tiles (self + any remote cameras). */}
      {(isVideoEnabled || remoteVideos.length > 0) && (
        <div
          className={cn(
            "fixed z-50 grid gap-1.5 rounded-lg bg-black/70 p-1.5 shadow-2xl backdrop-blur-sm",
            compact ? "right-2 top-24" : "right-4 top-20",
            remoteVideos.length + (isVideoEnabled ? 1 : 0) > 1
              ? "grid-cols-2"
              : "grid-cols-1"
          )}
        >
          {isVideoEnabled && localStream && (
            <div className="relative">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="h-16 w-24 rounded object-cover"
              />
              <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] text-white">
                You
              </span>
            </div>
          )}
          {remoteVideos.map((p) => (
            <RemoteVideoTile
              key={`v-${p.userId}`}
              peer={p}
              muted={!soundEnabled}
              label={
                players.find((x) => x.userId === p.userId)?.username || "Player"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RemoteAudio({ peer, muted }: { peer: RemotePeer; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== peer.stream) {
      ref.current.srcObject = peer.stream;
    }
  }, [peer.stream]);
  // Only mount when there is (or was) audio; video tiles carry their own audio.
  if (!peer.hasAudio || peer.hasVideo) return null;
  return <audio ref={ref} autoPlay playsInline muted={muted} />;
}

function RemoteVideoTile({
  peer,
  muted,
  label,
}: {
  peer: RemotePeer;
  muted: boolean;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== peer.stream) {
      ref.current.srcObject = peer.stream;
    }
  }, [peer.stream]);
  return (
    <div className="relative">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className="h-16 w-24 rounded object-cover"
      />
      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] text-white">
        {label}
      </span>
    </div>
  );
}
