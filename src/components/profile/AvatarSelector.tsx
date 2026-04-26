"use client";

import { useState } from "react";
import { User, Check, Image } from "lucide-react";

const AVATAR_OPTIONS = [
  "👤",
  "👨",
  "👩",
  "🧑",
  "👨‍💼",
  "👩‍💼",
  "👨‍🎓",
  "👩‍🎓",
  "👨‍🔬",
  "👩‍🔬",
  "👨‍⚕️",
  "👩‍⚕️",
  "👨‍🎨",
  "👩‍🎨",
  "👨‍🚀",
  "👩‍🚀",
  "🦸",
  "🦸‍♂️",
  "🦸‍♀️",
  "🧙",
  "🧙‍♂️",
  "🧙‍♀️",
  "🧚",
  "🧚‍♂️",
  "🧚‍♀️",
  "🧛",
  "🧛‍♂️",
  "🧛‍♀️",
  "🧜",
  "🧜‍♂️",
  "🧜‍♀️",
  "🧝",
];

interface AvatarSelectorProps {
  currentAvatar: string | null;
  onAvatarChange?: (avatar: string) => void;
}

export default function AvatarSelector({
  currentAvatar,
  onAvatarChange,
}: AvatarSelectorProps) {
  const [selected, setSelected] = useState<string>(
    currentAvatar || AVATAR_OPTIONS[0]
  );
  const [saving, setSaving] = useState(false);

  const handleSelect = (avatar: string) => {
    setSelected(avatar);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: selected }),
      });

      const data = await response.json();
      if (data.success) {
        onAvatarChange?.(selected);
        alert("Avatar updated successfully!");
      } else {
        alert(data.error || "Failed to update avatar");
      }
    } catch (error) {
      console.error("Avatar update error:", error);
      alert("Failed to update avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Image className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-semibold">Avatar Selection</h3>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-20 h-20 rounded-full bg-background border-2 border-primary flex items-center justify-center text-4xl">
          {selected}
        </div>
        <div>
          <p className="font-semibold">Current Avatar</p>
          <p className="text-sm text-foreground/70">Select an avatar below</p>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 mb-4">
        {AVATAR_OPTIONS.map((avatar) => (
          <button
            key={avatar}
            onClick={() => handleSelect(avatar)}
            className={`aspect-square rounded-lg border-2 transition-all min-h-[44px] flex items-center justify-center text-2xl ${
              selected === avatar
                ? "border-primary bg-primary/10 scale-110"
                : "border-border hover:border-primary/50"
            }`}
            aria-label={`Select avatar ${avatar}`}
          >
            {avatar}
            {selected === avatar && (
              <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || selected === currentAvatar}
        className="w-full py-3 bg-primary rounded-lg font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 min-h-[44px]"
      >
        {saving ? (
          "Saving..."
        ) : (
          <>
            <Check className="w-5 h-5" />
            Save Avatar
          </>
        )}
      </button>
    </div>
  );
}
