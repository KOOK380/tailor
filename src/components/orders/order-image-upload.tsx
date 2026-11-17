"use client";

/** Upload order reference images (stored in the database — see server/storage). */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderImageUpload({ orderId }: { orderId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("orderId", orderId);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Upload failed" });
        return;
      }
      setMsg({ kind: "ok", text: "Image added" });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Upload failed — please try again" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
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
        Add image
      </Button>
      {msg && (
        <p
          className={
            msg.kind === "ok"
              ? "mt-1.5 flex items-center gap-1 text-[11px] text-green-600"
              : "mt-1.5 text-[11px] text-red-600"
          }
        >
          {msg.kind === "ok" && <ImageIcon className="h-3 w-3" />}
          {msg.text}
        </p>
      )}
    </div>
  );
}
