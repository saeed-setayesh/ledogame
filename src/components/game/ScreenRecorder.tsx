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

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      className={cn(
        "min-h-8 min-w-8 h-8 w-8 rounded-md flex items-center justify-center",
        "transition-all duration-300 hover:scale-105 active:scale-95",
        "bg-transparent",
        recording && "ring-1 ring-red-500/70 animate-pulse"
      )}
      title={recording ? "Stop recording" : "Record screen"}
    >
      {recording ? (
        <span className="w-4 h-4 bg-red-500 rounded-sm" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconSrc} alt="" className="w-7 h-7 object-contain" />
      )}
    </button>
  );
}
