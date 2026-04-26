"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface ScreenRecorderProps {
  gameId: string;
}

export default function ScreenRecorder({ gameId }: ScreenRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" } as any,
        audio: true,
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        setRecordedChunks(chunks);
        downloadRecording(blob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Failed to start recording. Please allow screen sharing.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      setMediaRecorder(null);
    }
  };

  const downloadRecording = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ludo-game-${gameId}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareToSocial = async () => {
    if (recordedChunks.length === 0) {
      alert("No recording available. Please record first.");
      return;
    }

    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const file = new File([blob], `ludo-game-${gameId}.webm`, {
      type: "video/webm",
    });

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out my Ludo game!",
          text: "I just played an amazing game of Ludo!",
          files: [file],
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback: copy link or show share options
      alert("Sharing not supported. Please download and share manually.");
    }
  };

  return (
    <button
      onClick={recording ? stopRecording : startRecording}
      className={cn(
        "w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center",
        "transition-all duration-300 shadow-lg hover:scale-110 active:scale-95",
        "backdrop-blur-sm border-2",
        recording
          ? "bg-gradient-to-br from-red-600 to-red-700 border-red-500 text-white animate-pulse"
          : "bg-gradient-to-br from-red-500 to-red-600 border-red-400 text-white"
      )}
      title={recording ? "Stop Recording" : "Record Game"}
    >
      {recording ? (
        <svg
          className="w-6 h-6 md:w-7 md:h-7"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg
          className="w-6 h-6 md:w-7 md:h-7"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="6" />
        </svg>
      )}
    </button>
  );
}
