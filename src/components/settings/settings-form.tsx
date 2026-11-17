"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSettings } from "@/server/settings";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import { LogoUploader } from "./logo-uploader";

const REMINDER_OPTIONS = [7, 5, 3, 2, 1, 0];

/** Common business timezones (days-left countdown + summary time use these). */
const TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Colombo",
  "Asia/Kathmandu",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Jakarta",
  "Asia/Bangkok",
  "Asia/Manila",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
  "UTC",
];

export function SettingsForm({
  business,
  settings,
}: {
  business: {
    name: string;
    timezone: string;
    phone: string;
    email: string;
    address: string;
    currency: string;
    trn: string;
  };
  settings: {
    taxLabel: string;
    taxRate: number;
    dailySummaryEnabled: boolean;
    dailySummaryTime: string;
    emailSummaryEnabled: boolean;
    reminderDays: number[];
    overdueAlertsEnabled: boolean;
    delayWarningsEnabled: boolean;
    holdAlertDays: number;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...business,
    trn: business.trn ?? "",
    taxLabel: settings.taxLabel,
    taxRate: settings.taxRate,
    dailySummaryEnabled: settings.dailySummaryEnabled,
    dailySummaryTime: settings.dailySummaryTime,
    emailSummaryEnabled: settings.emailSummaryEnabled,
    reminderDays: settings.reminderDays.length
      ? settings.reminderDays
      : [7, 5, 3, 2, 1],
    overdueAlertsEnabled: settings.overdueAlertsEnabled,
    delayWarningsEnabled: settings.delayWarningsEnabled,
    holdAlertDays: settings.holdAlertDays,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleReminder(day: number) {
    setForm((f) => ({
      ...f,
      reminderDays: f.reminderDays.includes(day)
        ? f.reminderDays.filter((d) => d !== day)
        : [...f.reminderDays, day].sort((a, b) => b - a),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await updateSettings(form);
      setMsg(res.error ?? "Settings saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label className="text-[13px] font-medium text-slate-600">Business name</Label>
        <Input
          className="mt-1"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div>
        <Label className="text-[13px] font-medium text-slate-600">
          TRN (Tax Registration Number — shown on invoices)
        </Label>
        <Input
          className="mt-1"
          placeholder="e.g. 100000000000003"
          value={form.trn}
          onChange={(e) => set("trn", e.target.value)}
        />
      </div>
      <LogoUploader />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[13px] font-medium text-slate-600">Timezone</Label>
          <Select
            value={form.timezone}
            onValueChange={(v) => set("timezone", v ?? "Asia/Kolkata")}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(TIMEZONE_OPTIONS.includes(form.timezone)
                ? TIMEZONE_OPTIONS
                : [form.timezone, ...TIMEZONE_OPTIONS]
              ).map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[13px] font-medium text-slate-600">Currency</Label>
          <Select
            value={form.currency}
            onValueChange={(v) => set("currency", v ?? "INR")}
          >
            <SelectTrigger className="mt-1">
              <SelectValue>
                {CURRENCY_OPTIONS.find((c) => c.code === form.currency)?.label ??
                  form.currency}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[13px] font-medium text-slate-600">Daily summary time</Label>
          <Input
            className="mt-1"
            type="time"
            value={form.dailySummaryTime}
            onChange={(e) => set("dailySummaryTime", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[13px] font-medium text-slate-600">Tax label</Label>
          <Input
            className="mt-1"
            value={form.taxLabel}
            onChange={(e) => set("taxLabel", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-[13px] font-medium text-slate-600">Tax rate %</Label>
          <Input
            className="mt-1"
            type="number"
            min={0}
            step={0.001}
            value={form.taxRate}
            onChange={(e) => set("taxRate", Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div>
        <Label className="text-[13px] font-medium text-slate-600">Deadline reminder days</Label>
        <div className="mt-2 flex flex-wrap gap-3">
          {REMINDER_OPTIONS.map((day) => (
            <label
              key={day}
              className="flex items-center gap-1.5 text-sm text-slate-600"
            >
              <Checkbox
                checked={form.reminderDays.includes(day)}
                onCheckedChange={() => toggleReminder(day)}
              />
              {day === 0 ? "Delivery day" : `${day} day${day === 1 ? "" : "s"} before`}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-[13px] font-medium text-slate-600">Daily summary notifications</Label>
          <Switch
            checked={form.dailySummaryEnabled}
            onCheckedChange={(v) => set("dailySummaryEnabled", v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[13px] font-medium text-slate-600">Overdue alerts</Label>
          <Switch
            checked={form.overdueAlertsEnabled}
            onCheckedChange={(v) => set("overdueAlertsEnabled", v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-[13px] font-medium text-slate-600">Production delay warnings</Label>
          <Switch
            checked={form.delayWarningsEnabled}
            onCheckedChange={(v) => set("delayWarningsEnabled", v)}
          />
        </div>
      </div>

      {/* Email delivery (Module 4.G/H) */}
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-500" />
            <Label className="text-[13px] font-medium text-slate-600">Email daily summary &amp; critical alerts</Label>
          </div>
          <Switch
            checked={form.emailSummaryEnabled}
            onCheckedChange={(v) => set("emailSummaryEnabled", v)}
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          Company rule — emails the daily summary and critical alerts to their
          recipients. Set up the provider in the Email Setup card below; users
          can also opt in to email per category in Notifications.
        </p>
      </div>

      <div>
        <Label className="text-[13px] font-medium text-slate-600">Hold alert after (days)</Label>
        <Input
          className="mt-1 w-28"
          type="number"
          min={1}
          value={form.holdAlertDays}
          onChange={(e) => set("holdAlertDays", Number(e.target.value) || 3)}
        />
      </div>

      {msg && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {msg}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save Settings
      </Button>
    </form>
  );
}
