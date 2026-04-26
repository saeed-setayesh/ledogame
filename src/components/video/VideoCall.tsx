"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface VideoCallProps {
  gameId: string;
  userId: string;
  players: { id: string; userId: string; username?: string }[];
}

export default function VideoCall({ gameId, userId, players }: VideoCallProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  useEffect(() => {
    if (isVideoEnabled || isAudioEnabled) {
      initializeMedia();
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

      // Create peer connections for other players
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

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(peerUserId, event.streams[0]);
        return newMap;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate via Socket.io
        // This would be implemented with your socket client
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

  return (
    <div className="flex items-center gap-2">
      {/* Video Toggle - Icon Only */}
      <button
        onClick={toggleVideo}
        className={cn(
          "w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center",
          "transition-all duration-300 shadow-lg hover:scale-110 active:scale-95",
          "backdrop-blur-sm border-2",
          isVideoEnabled
            ? "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400 text-white"
            : "bg-white/90 dark:bg-gray-800/90 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
        )}
        title={isVideoEnabled ? "Video On" : "Video Off"}
      >
        {isVideoEnabled ? (
          <svg
            className="w-6 h-6 md:w-7 md:h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6 md:w-7 md:h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>

      {/* Audio Toggle - Icon Only */}
      <button
        onClick={toggleAudio}
        className={cn(
          "w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center",
          "transition-all duration-300 shadow-lg hover:scale-110 active:scale-95",
          "backdrop-blur-sm border-2",
          isAudioEnabled
            ? "bg-gradient-to-br from-green-500 to-green-600 border-green-400 text-white"
            : "bg-white/90 dark:bg-gray-800/90 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
        )}
        title={isAudioEnabled ? "Audio On" : "Audio Off"}
      >
        {isAudioEnabled ? (
          <svg
            className="w-6 h-6 md:w-7 md:h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6 md:w-7 md:h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        )}
      </button>

      {/* Video Preview (if enabled) */}
      {isVideoEnabled && (localStream || remoteStreams.size > 0) && (
        <div className="absolute top-20 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-2 shadow-2xl z-50">
          <div className="grid grid-cols-2 gap-2">
            {isVideoEnabled && localStream && (
              <div className="relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
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
                <div key={peerUserId} className="relative">
                  <video
                    autoPlay
                    srcObject={stream}
                    className="w-24 h-16 object-cover rounded"
                  />
                  <div className="absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1 rounded">
                    {player?.username || "Player"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
