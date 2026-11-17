import Link from "next/link";
import { listEmployees } from "@/server/employees";
import { EmployeeForm } from "@/components/employees/employee-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function EmployeesPage() {
  const rows = await listEmployees();

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} team member{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <EmployeeForm mode="create" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((emp) => (
          <Card key={emp.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">
                  <Link
                    href={`/employees/${emp.id}`}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {emp.fullName}
                  </Link>
                </CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  {emp.phone ?? emp.email ?? "No contact info"}
                </p>
              </div>
              <EmployeeForm
                mode="edit"
                initial={{
                  id: emp.id,
                  fullName: emp.fullName,
                  phone: emp.phone,
                  email: emp.email,
                  categories: emp.categories,
                  isActive: emp.isActive,
                }}
              />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {(emp.categories as string[]).map((c) => (
                  <Badge key={c} variant="secondary" className="capitalize">
                    {c.replace(/_/g, " ")}
                  </Badge>
                ))}
                {(emp.categories as string[]).length === 0 && (
                  <span className="text-xs text-slate-400">No categories</span>
                )}
              </div>
              {!emp.isActive && (
                <Badge variant="outline" className="mt-2 border-red-200 text-red-600">
                  Inactive
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
