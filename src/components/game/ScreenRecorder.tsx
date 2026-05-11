"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ScreenRecorderProps {
  gameId: string;
  iconSrc?: string;
}

export default function ScreenRecorder({
  gameId,
  iconSrc = "/game/icons/record.png",
}: ScreenRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

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
      type="button"
      onClick={recording ? stopRecording : startRecording}
      className={cn(
        "min-h-12 min-w-12 h-12 w-12 md:h-14 md:w-14 rounded-xl flex items-center justify-center",
        "transition-all duration-300 shadow-lg hover:scale-105 active:scale-95",
        "border-2 border-white/15 bg-black/35 backdrop-blur-sm",
        recording && "ring-2 ring-red-500/70 animate-pulse"
      )}
      title={recording ? "Stop recording" : "Record screen"}
    >
      {recording ? (
        <span className="w-4 h-4 bg-red-500 rounded-sm" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconSrc} alt="" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
      )}
    </button>
  );
}
