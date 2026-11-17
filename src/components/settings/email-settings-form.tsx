"use client";

/**
 * Email provider setup (Modules 4.G/H) — configure Resend or SMTP directly
 * from Settings, with a test-email button to verify. Env vars override.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Send, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveEmailConfig,
  sendTestEmail,
  type EmailConfigStatus,
} from "@/server/settings";

export function EmailSettingsForm({ status }: { status: EmailConfigStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({
    provider: (status.provider as "none" | "resend" | "smtp") ?? "none",
    from: status.from ?? "",
    apiKey: "",
    smtpHost: status.smtpHost ?? "",
    smtpPort: status.smtpPort ?? 587,
    smtpSecure: status.smtpSecure ?? false,
    smtpUser: status.smtpUser ?? "",
    smtpPassword: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await saveEmailConfig(form);
      if (res.error) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({
        kind: "ok",
        text: "Email settings saved. Use the test button to verify delivery.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await sendTestEmail();
      if (res.ok) {
        setMsg({
          kind: "ok",
          text: `Test email sent via ${res.source === "env" ? "environment config" : "saved settings"} — check your inbox.`,
        });
      } else {
        setMsg({ kind: "err", text: `Test failed: ${res.error}` });
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[13px] font-medium text-slate-600">Email provider</Label>
        <Select
          value={form.provider}
          onValueChange={(v) => set("provider", (v as "none" | "resend" | "smtp") ?? "none")}
        >
          <SelectTrigger className="mt-1">
            <SelectValue>
              {{ none: "Disabled", resend: "Resend (API)", smtp: "SMTP (Gmail, mail host…)" }[
                form.provider
              ] ?? "Disabled"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Disabled</SelectItem>
            <SelectItem value="resend">Resend (API)</SelectItem>
            <SelectItem value="smtp">SMTP (Gmail, mail host…)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.provider !== "none" && (
        <>
          <div>
            <Label className="text-[13px] font-medium text-slate-600">From address *</Label>
            <Input
              className="mt-1"
              type="email"
              placeholder="alerts@yourdomain.com"
              value={form.from}
              onChange={(e) => set("from", e.target.value)}
            />
          </div>

          {form.provider === "resend" && (
            <div>
              <Label className="text-[13px] font-medium text-slate-600">Resend API key *</Label>
              <Input
                className="mt-1"
                type="password"
                placeholder={status.hasApiKey ? "•••••• (saved — leave blank to keep)" : "re_xxxxxxxx"}
                value={form.apiKey}
                onChange={(e) => set("apiKey", e.target.value)}
              />
            </div>
          )}

          {form.provider === "smtp" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[13px] font-medium text-slate-600">SMTP host *</Label>
                  <Input
                    className="mt-1"
                    placeholder="smtp.gmail.com"
                    value={form.smtpHost}
                    onChange={(e) => set("smtpHost", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[13px] font-medium text-slate-600">Port</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    value={form.smtpPort}
                    onChange={(e) => set("smtpPort", Number(e.target.value) || 587)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[13px] font-medium text-slate-600">Username *</Label>
                  <Input
                    className="mt-1"
                    placeholder="alerts@yourdomain.com"
                    value={form.smtpUser}
                    onChange={(e) => set("smtpUser", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[13px] font-medium text-slate-600">Password *</Label>
                  <Input
                    className="mt-1"
                    type="password"
                    placeholder={status.hasSmtpPassword ? "•••••• (saved — leave blank to keep)" : "app password"}
                    value={form.smtpPassword}
                    onChange={(e) => set("smtpPassword", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-medium text-slate-600">Use TLS (port 465)</Label>
                <Switch
                  checked={form.smtpSecure}
                  onCheckedChange={(v) => set("smtpSecure", v)}
                />
              </div>
            </>
          )}
        </>
      )}

      {status.envOverride && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Environment variables (EMAIL_PROVIDER etc.) are configured and
          override these saved settings.
        </p>
      )}

      {msg && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
            msg.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
          )}
        >
          {msg.kind === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          {msg.text}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          Save Email Settings
        </Button>
        <Button
          variant="outline"
          onClick={test}
          disabled={testing || form.provider === "none"}
        >
          {testing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send Test Email
        </Button>
      </div>
    </div>
  );
}
