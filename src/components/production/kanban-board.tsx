"use client";

/**
 * Production Kanban board (Module 7) with drag-and-drop stage moves.
 * Workflow validation happens server-side (moveOrderToStage).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
  closestCorners,
} from "@dnd-kit/core";
import { GripVertical, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { STAGE_ORDER, STAGE_LABELS } from "@/db/schema";
import { moveOrderToStage, type KanbanCard } from "@/server/kanban";
import { daysLeftBadge, daysRemaining, deadlineBand } from "@/lib/deadline";

const PRIORITY_STYLES: Record<string, string> = {
  normal: "bg-slate-100 text-slate-600",
  high: "bg-blue-100 text-blue-700",
  urgent: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

function Card({ card, dragging }: { card: KanbanCard; dragging?: boolean }) {
  const days = daysRemaining(card.deliveryDate, "Asia/Kolkata");
  const band = deadlineBand(days);
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
        dragging && "dragging-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/orders/${card.id}`}
          className="text-sm font-semibold text-blue-600 hover:underline"
        >
          {card.orderNumber}
        </Link>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
            PRIORITY_STYLES[card.priority],
          )}
        >
          {card.priority}
        </span>
      </div>
      <p className="mt-1 truncate text-xs font-medium text-slate-800">
        {card.customerName}
      </p>
      <p className="truncate text-[11px] text-slate-500">{card.garmentSummary}</p>
      {card.employeeName && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
          <User className="h-3 w-3" />
          {card.employeeName}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span
          className={cn(
            "inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            `badge-${band.key.replace(/_/g, "-")}`,
          )}
        >
          {daysLeftBadge(days)}
        </span>
        <span className="text-[10px] text-slate-400">{card.progressPercent}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-400"
          style={{ width: `${card.progressPercent}%` }}
        />
      </div>
    </div>
  );
}

function Column({
  stageKey,
  cards,
  children,
}: {
  stageKey: string;
  cards: KanbanCard[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-xl border bg-slate-50/70 transition-colors",
        isOver ? "border-blue-400 bg-blue-50" : "border-slate-200",
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-700">
          {(STAGE_LABELS as Record<string, string>)[stageKey] ?? stageKey}
        </p>
        <Badge variant="secondary" className="text-[10px]">
          {cards.length}
        </Badge>
      </div>
      <div className="flex max-h-[calc(100vh-16rem)] flex-1 flex-col gap-2 overflow-y-auto p-2">
        {children}
      </div>
    </div>
  );
}

function DraggableCard({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { stageKey: card.currentStageKey },
  });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <div className="group relative">
        <button
          {...listeners}
          {...attributes}
          aria-label={`Drag order ${card.orderNumber}`}
          className="absolute left-1.5 top-1.5 z-10 rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:text-slate-500 group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Card card={card} dragging={isDragging} />
      </div>
    </div>
  );
}

export function KanbanBoard({
  initial,
  canMove,
}: {
  initial: Record<string, KanbanCard[]>;
  canMove: boolean;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState(initial);
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  async function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    for (const cards of Object.values(columns)) {
      const card = cards.find((c) => c.id === id);
      if (card) {
        setActiveCard(card);
        return;
      }
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const cardId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId || !(STAGE_ORDER as readonly string[]).includes(overId)) return;

    // Find the card's current column.
    let card: KanbanCard | null = null;
    for (const cards of Object.values(columns)) {
      const found = cards.find((c) => c.id === cardId);
      if (found) {
        card = found;
        break;
      }
    }
    if (!card || card.currentStageKey === overId) return;
    if (!canMove) return;

    // Optimistic move.
    setColumns((cols) => {
      const next: Record<string, KanbanCard[]> = {};
      for (const [k, v] of Object.entries(cols)) {
        next[k] = v.filter((c) => c.id !== cardId);
      }
      next[overId] = [
        ...next[overId],
        { ...card!, currentStageKey: overId },
      ];
      return next;
    });

    setBusy(true);
    try {
      const result = await moveOrderToStage(cardId, overId);
      if (!result.ok) {
        // Revert on rejection.
        setColumns(initial);
        alert(result.error ?? "Move rejected by workflow rules");
      }
      router.refresh();
    } catch {
      setColumns(initial);
      alert("Network error — move was not saved");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGE_ORDER.map((key) => (
          <Column key={key} stageKey={key} cards={columns[key] ?? []}>
            {(columns[key] ?? []).map((card) => (
              <DraggableCard key={card.id} card={card} />
            ))}
            {(columns[key] ?? []).length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-slate-400">
                No orders
              </p>
            )}
          </Column>
        ))}
      </div>
      <DragOverlay>
        {activeCard && <Card card={activeCard} dragging />}
      </DragOverlay>
      {busy && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving move…
        </div>
      )}
    </DndContext>
  );
}
