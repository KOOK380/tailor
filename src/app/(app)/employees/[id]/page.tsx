import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { getEmployeeDetail } from "@/server/employees";
import { daysLeftBadge, daysRemaining, deadlineBand } from "@/lib/deadline";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getEmployeeDetail(id);
  if (!detail) notFound();
  const { employee, tasks, completed } = detail;

  return (
    <div className="p-6">
      <Link
        href="/employees"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employees
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          {employee.fullName}
        </h1>
        {(employee.categories as string[]).map((c) => (
          <Badge key={c} variant="secondary" className="capitalize">
            {c.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {employee.phone ?? employee.email ?? "No contact info"}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-blue-600" />
              Pending Tasks ({tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 && (
              <p className="py-4 text-sm text-slate-500">
                No pending tasks assigned.
              </p>
            )}
            {tasks.map(({ stage, order, customerName }) => {
              const days = daysRemaining(order.deliveryDate, "Asia/Kolkata");
              const band = deadlineBand(days);
              return (
                <Link
                  key={stage.id}
                  href={`/orders/${order.id}`}
                  className="block rounded-lg border border-slate-200 p-3 hover:border-blue-200"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">
                      {stage.stageName} — #{order.orderNumber}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        `badge-${band.key.replace(/_/g, "-")}`,
                      )}
                    >
                      {daysLeftBadge(days)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{customerName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize",
                        stage.status === "in_progress"
                          ? "border-blue-300 text-blue-700"
                          : stage.status === "on_hold"
                            ? "border-amber-300 text-amber-700"
                            : "",
                      )}
                    >
                      {stage.status.replace(/_/g, " ")}
                    </Badge>
                    {stage.plannedCompletionDate && (
                      <span className="text-[10px] text-slate-400">
                        planned: {stage.plannedCompletionDate}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Completed Work ({completed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completed.length === 0 && (
              <p className="py-4 text-sm text-slate-500">
                No completed stages yet.
              </p>
            )}
            {completed.slice(0, 12).map(({ stage, order, customerName }) => (
              <div
                key={stage.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <div>
                  <p className="text-sm text-slate-700">
                    {stage.stageName} — #{order.orderNumber}
                  </p>
                  <p className="text-xs text-slate-400">{customerName}</p>
                </div>
                <span className="text-xs text-slate-400">
                  {stage.actualCompletedAt
                    ? stage.actualCompletedAt.toISOString().slice(0, 10)
                    : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
