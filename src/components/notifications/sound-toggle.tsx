"use client";

/** Mute/unmute notification sounds (persisted in localStorage). */
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  isSoundMuted,
  setSoundMuted,
  playNotificationSound,
} from "@/lib/notify-sound";

export function SoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isSoundMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
    // Preview the sound when unmuting (also unlocks audio for future plays).
    if (!next) playNotificationSound("normal");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Turn notification sound on" : "Mute notification sound"}
      title={muted ? "Sound is off — click to unmute" : "Sound is on — click to mute"}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}
