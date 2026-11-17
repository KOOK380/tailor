import { getKanbanData } from "@/server/kanban";
import { getSession } from "@/lib/auth";
import { KanbanBoard } from "@/components/production/kanban-board";

export default async function ProductionBoardPage() {
  const session = (await getSession())!;
  const columns = await getKanbanData();

  return (
    <div className="flex h-full flex-col p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Production Board</h1>
        <p className="mt-1 text-sm text-slate-500">
          {session.permissions.skipStages
            ? "Drag orders between stages to update production. Workflow rules are validated on drop."
            : "Read-only view — managers and admins can move cards."}
        </p>
      </div>
      <div className="mt-4 flex-1">
        <KanbanBoard initial={columns} canMove={session.permissions.skipStages} />
      </div>
    </div>
  );
}
