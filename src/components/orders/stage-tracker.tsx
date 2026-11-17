"use client";

/**
 * Production workflow viewer (Module 2) — redesigned for clarity:
 *
 *   1. Journey strip   — one look: where the garment is in the 8 stages
 *   2. "Now" hero card — the current stage with its main action
 *   3. Checklist       — every stage in plain language with quick actions
 *
 * Advanced controls (notes, reassign, planned dates, skip/reset) live in a
 * per-stage "Details" panel so first-time users see a simple picture.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Clock,
  PauseCircle,
  SkipForward,
  Loader2,
  UserRound,
  Play,
  Check,
  RotateCcw,
  ChevronDown,
  Scissors,
  Paintbrush,
  Sparkles,
  Gem,
  Hammer,
  Shirt,
  PackageCheck,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateStage, assignStage } from "@/server/workflow";

interface StageRow {
  id: string;
  orderItemId: string;
  stageKey: string;
  stageName: string;
  sequence: number;
  status: string;
  assignedEmployeeId: string | null;
  plannedStartDate: string | null;
  plannedCompletionDate: string | null;
  actualStartedAt: string | null;
  actualCompletedAt: string | null;
  estimatedDurationHours: number | null;
  notes: string | null;
}

interface EmployeeOption {
  id: string;
  fullName: string;
}

const STAGE_ICONS: Record<string, LucideIcon> = {
  order_created: ClipboardList,
  cutting: Scissors,
  designing: Paintbrush,
  embroidery: Sparkles,
  stone_crystals: Gem,
  hand_work: Hammer,
  stitching: Shirt,
  finished: PackageCheck,
};

const SHORT_LABELS: Record<string, string> = {
  order_created: "Order",
  cutting: "Cutting",
  designing: "Design",
  embroidery: "Embroidery",
  stone_crystals: "Stones",
  hand_work: "Handwork",
  stitching: "Stitching",
  finished: "Finished",
};

/** Plain-language status for first-time users. */
const STATUS_VIEW: Record<
  string,
  { label: string; pill: string; icon: LucideIcon }
> = {
  completed: {
    label: "Done",
    pill: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  in_progress: {
    label: "In progress",
    pill: "bg-blue-100 text-blue-700",
    icon: Clock,
  },
  not_started: {
    label: "Upcoming",
    pill: "bg-slate-100 text-slate-500",
    icon: Circle,
  },
  on_hold: {
    label: "On hold",
    pill: "bg-amber-100 text-amber-700",
    icon: PauseCircle,
  },
  skipped: {
    label: "Skipped",
    pill: "bg-slate-100 text-slate-400 line-through",
    icon: SkipForward,
  },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return d.length > 10 ? new Date(d).toLocaleDateString() : d;
}

export function StageTracker({
  stages,
  employees,
  canManage,
}: {
  stages: StageRow[];
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openDetails, setOpenDetails] = useState<string | null>(null);

  // Group by garment item.
  const byItem = new Map<string, StageRow[]>();
  for (const s of stages) {
    const arr = byItem.get(s.orderItemId) ?? [];
    arr.push(s);
    byItem.set(s.orderItemId, arr);
  }

  async function act(stageId: string, action: string) {
    setBusy(stageId);
    try {
      await updateStage({
        stageId,
        action,
        notes: notes[stageId] || undefined,
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function reassign(stageId: string, employeeId: string | null) {
    setBusy(stageId);
    try {
      await assignStage(stageId, !employeeId || employeeId === "none" ? null : employeeId);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      {/* Legend — one line explaining every state */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Done
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-600" /> In progress
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Circle className="h-3.5 w-3.5 text-slate-400" /> Upcoming
        </span>
        <span className="inline-flex items-center gap-1.5">
          <PauseCircle className="h-3.5 w-3.5 text-amber-500" /> On hold
        </span>
        <span className="inline-flex items-center gap-1.5">
          <SkipForward className="h-3.5 w-3.5 text-slate-400" /> Skipped (not needed)
        </span>
      </div>

      {[...byItem.entries()].map(([itemId, rows], gi) => {
        const sorted = [...rows].sort((a, b) => a.sequence - b.sequence);
        const active = sorted.find(
          (s) => s.status !== "completed" && s.status !== "skipped",
        );
        const doneCount = sorted.filter((s) => s.status === "completed").length;
        const applicable = sorted.filter((s) => s.status !== "skipped").length;
        const pct = applicable ? Math.round((doneCount / applicable) * 100) : 100;

        return (
          <div key={itemId}>
            {byItem.size > 1 && (
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Garment {gi + 1}
              </h3>
            )}

            {/* 1 — Journey strip */}
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  Production journey
                </p>
                <p className="text-xs text-slate-500">
                  {doneCount} of {applicable} steps done · {pct}%
                </p>
              </div>
              <div className="mt-4 flex items-start overflow-x-auto pb-1">
                {sorted.map((s, i) => {
                  const Icon = STAGE_ICONS[s.stageKey] ?? ClipboardList;
                  const view = STATUS_VIEW[s.status] ?? STATUS_VIEW.not_started;
                  const isCurrent = active?.id === s.id;
                  return (
                    <div key={s.id} className="flex flex-col items-center">
                      <div className="flex items-center">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                            s.status === "completed" &&
                              "border-green-500 bg-green-500 text-white",
                            s.status === "skipped" &&
                              "border-dashed border-slate-300 bg-white text-slate-300",
                            isCurrent &&
                              "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100",
                            s.status === "on_hold" &&
                              "border-amber-400 bg-amber-50 text-amber-600",
                            !isCurrent &&
                              s.status === "not_started" &&
                              "border-slate-200 bg-white text-slate-400",
                          )}
                        >
                          {s.status === "completed" ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <Icon className="h-4.5 w-4.5" />
                          )}
                        </div>
                        {i < sorted.length - 1 && (
                          <div
                            className={cn(
                              "mx-1 h-0.5 w-7 shrink-0",
                              s.status === "completed" ? "bg-green-400" : "bg-slate-200",
                            )}
                          />
                        )}
                      </div>
                      <span
                        className={cn(
                          "mt-2 w-16 text-center text-[10.5px] leading-tight",
                          isCurrent
                            ? "font-semibold text-blue-700"
                            : s.status === "skipped"
                              ? "text-slate-400"
                              : "text-slate-500",
                        )}
                      >
                        {SHORT_LABELS[s.stageKey] ?? s.stageName}
                      </span>
                      {isCurrent && (
                        <span className="mt-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                          NOW
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2 — Now hero card */}
            {active ? (
              <div className="mt-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                      Happening now
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {active.stageName}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" />
                        {active.assignedEmployeeId
                          ? (employees.find((e) => e.id === active.assignedEmployeeId)
                              ?.fullName ?? "Assigned")
                          : "Not assigned yet"}
                      </span>
                      {active.actualStartedAt && (
                        <span>Started {fmtDate(active.actualStartedAt)}</span>
                      )}
                      {active.plannedCompletionDate && (
                        <span>Planned by {fmtDate(active.plannedCompletionDate)}</span>
                      )}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      {active.status === "not_started" && (
                        <Button
                          size="sm"
                          disabled={busy === active.id}
                          onClick={() => act(active.id, "start")}
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                          Start this stage
                        </Button>
                      )}
                      {active.status === "in_progress" && (
                        <Button
                          size="sm"
                          disabled={busy === active.id}
                          onClick={() => act(active.id, "complete")}
                        >
                          {busy === active.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Mark as done
                        </Button>
                      )}
                      {active.status === "on_hold" && (
                        <Button
                          size="sm"
                          disabled={busy === active.id}
                          onClick={() => act(active.id, "resume")}
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                          Resume work
                        </Button>
                      )}
                      {active.status === "in_progress" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === active.id}
                          onClick={() => act(active.id, "hold")}
                        >
                          Put on hold
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {active.notes && (
                  <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
                    📝 {active.notes}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
                <PackageCheck className="mx-auto h-7 w-7 text-green-600" />
                <p className="mt-2 text-sm font-semibold text-green-800">
                  All production stages complete 🎉
                </p>
                <p className="mt-1 text-xs text-green-700">
                  This garment is ready for delivery.
                </p>
              </div>
            )}

            {/* 3 — Checklist */}
            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white shadow-soft">
              <div className="border-b border-slate-100 px-5 py-3">
                <p className="text-sm font-semibold text-slate-800">All stages</p>
              </div>
              <div className="divide-y divide-slate-50">
                {sorted.map((s) => {
                  const view = STATUS_VIEW[s.status] ?? STATUS_VIEW.not_started;
                  const StatusIcon = view.icon;
                  const isCurrent = active?.id === s.id;
                  const detailsOpen = openDetails === s.id;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "px-5 py-3",
                        isCurrent && "bg-blue-50/50",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        {/* number + name */}
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                              s.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : isCurrent
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-500",
                            )}
                          >
                            {s.sequence}
                          </span>
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "truncate text-sm",
                                s.status === "skipped"
                                  ? "text-slate-400 line-through"
                                  : "font-medium text-slate-800",
                              )}
                            >
                              {s.stageName}
                            </p>
                            <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3 w-3" />
                                {s.assignedEmployeeId
                                  ? (employees.find((e) => e.id === s.assignedEmployeeId)
                                      ?.fullName ?? "Assigned")
                                  : "Unassigned"}
                              </span>
                              {s.status === "completed" && s.actualCompletedAt && (
                                <span>· done {fmtDate(s.actualCompletedAt)}</span>
                              )}
                              {s.status !== "completed" && s.plannedCompletionDate && (
                                <span>· planned by {fmtDate(s.plannedCompletionDate)}</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* status pill */}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
                            view.pill,
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {view.label}
                        </span>

                        {/* quick actions */}
                        {canManage && (
                          <div className="flex items-center gap-1.5">
                            {s.status === "not_started" && (
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={busy === s.id}
                                onClick={() => act(s.id, "start")}
                              >
                                <Play className="mr-1 h-3 w-3" />
                                Start
                              </Button>
                            )}
                            {s.status === "in_progress" && (
                              <Button
                                size="xs"
                                disabled={busy === s.id}
                                onClick={() => act(s.id, "complete")}
                              >
                                <Check className="mr-1 h-3 w-3" />
                                Done
                              </Button>
                            )}
                            {s.status === "on_hold" && (
                              <Button
                                size="xs"
                                disabled={busy === s.id}
                                onClick={() => act(s.id, "resume")}
                              >
                                <Play className="mr-1 h-3 w-3" />
                                Resume
                              </Button>
                            )}
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-slate-400"
                              onClick={() =>
                                setOpenDetails(detailsOpen ? null : s.id)
                              }
                            >
                              Details
                              <ChevronDown
                                className={cn(
                                  "ml-1 h-3 w-3 transition-transform",
                                  detailsOpen && "rotate-180",
                                )}
                              />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Details panel — advanced controls */}
                      {detailsOpen && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-4">
                          <div className="grid gap-3 text-xs sm:grid-cols-2">
                            <div>
                              <p className="text-slate-400">Planned window</p>
                              <p className="mt-0.5 text-slate-700">
                                {fmtDate(s.plannedStartDate) || "—"} →{" "}
                                {fmtDate(s.plannedCompletionDate) || "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">Actual</p>
                              <p className="mt-0.5 text-slate-700">
                                {s.actualStartedAt
                                  ? `started ${fmtDate(s.actualStartedAt)}`
                                  : "not started"}
                                {s.actualCompletedAt
                                  ? `, done ${fmtDate(s.actualCompletedAt)}`
                                  : ""}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-400">Estimated duration</p>
                              <p className="mt-0.5 text-slate-700">
                                {s.estimatedDurationHours ?? "—"} hours
                              </p>
                            </div>
                            {canManage && (
                              <div>
                                <p className="text-slate-400">Assign to</p>
                                <Select
                                  value={s.assignedEmployeeId ?? "none"}
                                  onValueChange={(v) => reassign(s.id, v)}
                                  disabled={busy === s.id}
                                >
                                  <SelectTrigger className="mt-1 h-8">
                                    <SelectValue>
                                      {s.assignedEmployeeId
                                        ? (employees.find(
                                            (e) => e.id === s.assignedEmployeeId,
                                          )?.fullName ?? "Assigned")
                                        : "Unassigned"}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {employees.map((e) => (
                                      <SelectItem key={e.id} value={e.id}>
                                        {e.fullName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          {canManage && (
                            <div className="mt-3 space-y-2">
                              <Textarea
                                placeholder="Add a note about this stage…"
                                rows={2}
                                value={notes[s.id] ?? ""}
                                onChange={(e) =>
                                  setNotes((n) => ({ ...n, [s.id]: e.target.value }))
                                }
                              />
                              <div className="flex flex-wrap gap-2">
                                {s.status === "in_progress" && (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    disabled={busy === s.id}
                                    onClick={() => act(s.id, "hold")}
                                  >
                                    Put on hold
                                  </Button>
                                )}
                                {(s.status === "not_started" ||
                                  s.status === "on_hold") &&
                                  s.stageKey !== "order_created" &&
                                  s.stageKey !== "finished" && (
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      className="text-slate-500"
                                      disabled={busy === s.id}
                                      onClick={() => act(s.id, "skip")}
                                    >
                                      <SkipForward className="mr-1 h-3 w-3" />
                                      Skip (not needed)
                                    </Button>
                                  )}
                                {s.status === "completed" && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    disabled={busy === s.id}
                                    onClick={() => act(s.id, "reset")}
                                  >
                                    <RotateCcw className="mr-1 h-3 w-3" />
                                    Reopen stage
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
