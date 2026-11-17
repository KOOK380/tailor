"use client";

/**
 * Per-user notification category preferences (Module 4.H user settings):
 * choose which categories you receive and on which channels.
 */
import { useEffect, useState } from "react";
import { Bell, Mail, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  getMyNotificationPreferences,
  setCategoryPreference,
  type CategoryPreference,
  type PreferenceChannel,
} from "@/server/notifications/preferences";

const CHANNELS: { key: PreferenceChannel; label: string; Icon: typeof Bell }[] = [
  { key: "inAppEnabled", label: "In-app", Icon: Bell },
  { key: "pushEnabled", label: "Push", Icon: Smartphone },
  { key: "emailEnabled", label: "Email", Icon: Mail },
];

export function PreferencesCard() {
  const [prefs, setPrefs] = useState<CategoryPreference[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getMyNotificationPreferences().then((rows) => {
      setPrefs(rows);
      setLoaded(true);
    });
  }, []);

  async function toggle(category: string, channel: PreferenceChannel, enabled: boolean) {
    setBusy(`${category}:${channel}`);
    // Optimistic update.
    setPrefs((rows) =>
      rows.map((r) => (r.key === category ? { ...r, [channel]: enabled } : r)),
    );
    try {
      await setCategoryPreference(category, channel, enabled);
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) {
    return <p className="text-sm text-slate-400">Loading preferences…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-3">
        <span />
        {CHANNELS.map((c) => (
          <span
            key={c.key}
            className="flex flex-col items-center gap-0.5 text-[10px] font-medium text-slate-400"
          >
            <c.Icon className="h-3.5 w-3.5" />
            {c.label}
          </span>
        ))}
        {prefs.map((cat) => (
          <div key={cat.key} className="contents">
            <Label className="text-sm font-medium text-slate-700">{cat.label}</Label>
            {CHANNELS.map((c) => (
              <div key={c.key} className="flex justify-center">
                <Switch
                  checked={cat[c.key]}
                  disabled={busy === `${cat.key}:${c.key}`}
                  onCheckedChange={(v) => toggle(cat.key, c.key, v)}
                  aria-label={`${c.label} for ${cat.label}`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Email delivery requires a configured email provider (admin setting).
        Critical operational alerts may still follow company-level rules.
      </p>
    </div>
  );
}
