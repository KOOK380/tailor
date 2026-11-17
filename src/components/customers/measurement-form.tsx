"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addMeasurement } from "@/server/customers";

const COMMON_FIELDS = [
  "bust",
  "waist",
  "hips",
  "shoulder",
  "sleeve_length",
  "blouse_length",
  "top_length",
  "pant_length",
  "neck_depth",
  "front_neck",
  "back_neck",
  "armhole",
];

export function MeasurementForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [garmentType, setGarmentType] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  function setVal(k: string, v: string) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await addMeasurement(customerId, {
        garmentType,
        label,
        values,
        notes,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setGarmentType("");
      setLabel("");
      setNotes("");
      setValues({});
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Ruler className="mr-2 h-4 w-4" />
            Add Measurement
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Measurements</DialogTitle>
          <DialogDescription>
            Save a new measurement set for this customer (kept as history).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="garmentType">Garment type *</Label>
              <Input
                id="garmentType"
                placeholder="e.g. Designer Blouse"
                value={garmentType}
                onChange={(e) => setGarmentType(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                placeholder="e.g. Nov 2026 set"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Measurements (inches)
            </p>
            <div className="grid grid-cols-3 gap-3">
              {COMMON_FIELDS.map((f) => (
                <div key={f}>
                  <Label htmlFor={f} className="text-[12px] font-medium capitalize text-slate-500">
                    {f.replace(/_/g, " ")}
                  </Label>
                  <Input
                    id={f}
                    className="mt-1"
                    value={values[f] ?? ""}
                    onChange={(e) => setVal(f, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                const k = prompt("Custom measurement name (e.g. dupatta_length)");
                if (k) setVal(k, "");
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add custom field
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mnotes">Notes</Label>
            <Textarea
              id="mnotes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Measurement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
