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

  const pickMimeType = (): string => {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    if (typeof MediaRecorder === "undefined") return "";
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  };

  const startRecording = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getDisplayMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      alert("Screen recording isn't supported on this device or browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "video/webm",
        });
        downloadRecording(blob);
      };

      // Stop cleanly if the user ends the share from the browser UI.
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => stopRecording();
      });

      recorder.start(1000);
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error) {
      const err = error as DOMException;
      console.error("Error starting recording:", err);
      if (err?.name === "NotAllowedError") {
        // User dismissed the picker — not an error worth an alert.
        return;
      }
      alert("Failed to start recording. Please allow screen sharing.");
    }
  };

  const stopRecording = () => {
    setMediaRecorder((rec) => {
      if (rec) {
        if (rec.state !== "inactive") rec.stop();
        rec.stream.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
    setRecording(false);
  };

  const downloadRecording = (blob: Blob) => {
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ludo-game-${gameId}-${Date.now()}.${ext}`;
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
