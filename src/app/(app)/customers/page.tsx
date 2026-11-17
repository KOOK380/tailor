import { Search } from "lucide-react";
import Link from "next/link";
import { listCustomers } from "@/server/customers";
import { CustomerForm } from "@/components/customers/customer-form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const rows = await listCustomers(q);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} customer{rows.length === 1 ? "" : "s"} registered
          </p>
        </div>
        <CustomerForm mode="create" />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <form className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name or mobile…"
              className="pl-9"
            />
          </form>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Alt. contact</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                  No customers found. Add your first customer to get started.
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-slate-50">
                <TableCell>
                  <Link
                    href={`/customers/${c.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {c.fullName}
                  </Link>
                </TableCell>
                <TableCell>{c.mobile}</TableCell>
                <TableCell className="text-slate-500">{c.altMobile ?? "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate text-slate-500">
                  {c.address ?? "—"}
                </TableCell>
                <TableCell>
                  {c.notes ? (
                    <Badge variant="secondary" className="truncate">
                      {c.notes.slice(0, 30)}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
