"use client";

/**
 * Business logo upload (Module 10 — GCC invoice design).
 * The logo appears on the printable invoice and the PDF download.
 */
import { useRef, useState } from "react";
import { Upload, Loader2, ImageIcon, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function LogoUploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [version, setVersion] = useState(0); // cache-bust after upload

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/business/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Upload failed" });
        return;
      }
      setMsg({ kind: "ok", text: "Logo saved — it will appear on invoices." });
      setVersion((v) => v + 1);
    } catch {
      setMsg({ kind: "err", text: "Upload failed — please try again" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Label className="text-[13px] font-medium text-slate-600">
        Business logo (shown on invoices)
      </Label>
      <div className="mt-1.5 flex items-center gap-4">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/business/logo?v=${version}`}
            alt="Business logo"
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {busy ? "Uploading…" : "Upload logo"}
          </Button>
          <p className="flex items-center gap-1 text-[11px] text-slate-400">
            <ImageIcon className="h-3 w-3" />
            PNG, JPG, WEBP or SVG — up to 2 MB
          </p>
        </div>
      </div>
      {msg && (
        <p
          className={
            msg.kind === "ok"
              ? "mt-2 flex items-center gap-1.5 text-[11px] text-green-600"
              : "mt-2 text-[11px] text-red-600"
          }
        >
          {msg.kind === "ok" && <CheckCircle2 className="h-3 w-3" />}
          {msg.text}
        </p>
      )}
    </div>
  );
}
