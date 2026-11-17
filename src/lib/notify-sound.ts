"use client";

/**
 * Notification sound (Module 4.B) — a short two-tone chime synthesized with
 * the Web Audio API (no asset files, works offline). A longer three-tone
 * chime plays for critical alerts. Users can mute from the bell panel.
 */

const MUTE_KEY = "tailor_mute_sounds";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = ctx ?? new AC();
    return ctx;
  } catch {
    return null;
  }
}

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

/** Play the alert chime. `kind` selects the normal or critical jingle. */
export function playNotificationSound(kind: "normal" | "critical" = "normal"): void {
  if (isSoundMuted()) return;
  const audio = getCtx();
  if (!audio) return;

  // Browsers require a user gesture before audio plays; resuming is a no-op
  // otherwise — the first click on the page unlocks it.
  if (audio.state === "suspended") void audio.resume();

  const tones = kind === "critical" ? [523.25, 659.25, 783.99] : [659.25, 880];
  const start = audio.currentTime;

  tones.forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = start + i * 0.14;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  });
}
