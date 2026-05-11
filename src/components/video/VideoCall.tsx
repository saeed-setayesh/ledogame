"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export type LocalVideoState = {
  enabled: boolean;
  stream: MediaStream | null;
};

interface VideoCallProps {
  gameId: string;
  userId: string;
  players: { id: string; userId: string; username?: string }[];
  /** If true, only render control buttons (for bottom bar). */
  compact?: boolean;
  onLocalVideoChange?: (state: LocalVideoState) => void;
  cameraIconSrc?: string;
  micIconSrc?: string;
}

export default function VideoCall({
  gameId,
  userId,
  players,
  compact,
  onLocalVideoChange,
  cameraIconSrc = "/game/icons/camera.png",
  micIconSrc = "/game/icons/mic.png",
}: VideoCallProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

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
    if (isVideoEnabled || isAudioEnabled) {
      void initializeMedia();
    } else {
      stopMedia();
    }

    return () => {
      stopMedia();
    };
  }, [isVideoEnabled, isAudioEnabled]);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled,
        audio: isAudioEnabled,
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      players.forEach((player) => {
        if (player.userId !== userId) {
          createPeerConnection(player.userId);
        }
      });
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  const stopMedia = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    peerConnections.current.forEach((pc) => {
      pc.close();
    });
    peerConnections.current.clear();
    setRemoteStreams(new Map());
  };

  const createPeerConnection = (peerUserId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(peerUserId, event.streams[0]);
        return newMap;
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // ICE via Socket.io — placeholder
      }
    };

    peerConnections.current.set(peerUserId, pc);
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
  };

  const btnClass = (on: boolean) =>
    cn(
      "min-h-12 min-w-12 h-12 w-12 md:h-14 md:w-14 rounded-xl flex items-center justify-center",
      "transition-all duration-300 shadow-lg hover:scale-105 active:scale-95",
      "border-2 border-white/15 bg-black/35 backdrop-blur-sm",
      on ? "ring-2 ring-emerald-500/60" : "opacity-80"
    );

  return (
    <div className={cn("flex items-center gap-2", compact && "relative")}>
      <button
        type="button"
        onClick={toggleVideo}
        className={btnClass(isVideoEnabled)}
        title={isVideoEnabled ? "Video on" : "Video off"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cameraIconSrc}
          alt=""
          className="w-7 h-7 md:w-8 md:h-8 object-contain"
        />
      </button>

      <button
        type="button"
        onClick={toggleAudio}
        className={btnClass(isAudioEnabled)}
        title={isAudioEnabled ? "Mic on" : "Mic off"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={micIconSrc} alt="" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
      </button>

      {!compact &&
        isVideoEnabled &&
        (localStream || remoteStreams.size > 0) && (
          <div className="fixed top-20 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-2 shadow-2xl z-50">
            <div className="grid grid-cols-2 gap-2">
              {isVideoEnabled && localStream && (
                <div className="relative">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-24 h-16 object-cover rounded"
                  />
                  <div className="absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1 rounded">
                    You
                  </div>
                </div>
              )}
              {Array.from(remoteStreams.entries()).map(([peerUserId, stream]) => {
                const player = players.find((p) => p.userId === peerUserId);
                return (
                  <RemoteVideoTile
                    key={peerUserId}
                    stream={stream}
                    label={player?.username || "Player"}
                  />
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}

function RemoteVideoTile({
  stream,
  label,
}: {
  stream: MediaStream;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative">
      <video
        ref={ref}
        autoPlay
        playsInline
        className="w-24 h-16 object-cover rounded"
      />
      <div className="absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1 rounded">
        {label}
      </div>
    </div>
  );
}
