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
        video: { mediaSource: "screen" } as MediaTrackConstraints & {
          mediaSource?: string;
        },
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
      alert("Sharing not supported. Please download and share manually.");
    }
  };

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      className={cn(
        "min-h-10 min-w-10 h-10 w-10 rounded-lg flex items-center justify-center",
        "transition-all duration-300 hover:scale-105 active:scale-95",
        "border border-amber-500/35 bg-black/35 backdrop-blur-sm",
        recording && "ring-1 ring-red-500/70 animate-pulse"
      )}
      title={recording ? "Stop recording" : "Record screen"}
    >
      {recording ? (
        <span className="w-4 h-4 bg-red-500 rounded-sm" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconSrc} alt="" className="w-6 h-6 object-contain" />
      )}
    </button>
  );
}
