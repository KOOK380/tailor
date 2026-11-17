"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { formatMoney } from "@/lib/currency";

const COLORS = [
  "#2563eb",
  "#0891b2",
  "#16a34a",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#9333ea",
  "#64748b",
];

export function StageDistributionChart({
  data,
}: {
  data: { stage: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">No active orders</p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="stage"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(entry: unknown) => {
            const e = entry as { stage?: string; count?: number };
            return `${e.stage ?? ""}: ${e.count ?? ""}`;
          }}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Legend />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function WorkloadChart({
  data,
}: {
  data: { name: string; active: number; urgent: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">No employees</p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="active" name="Active tasks" fill="#2563eb" radius={[4, 4, 0, 0]} />
        <Bar dataKey="urgent" name="Urgent" fill="#ea580c" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({
  data,
  currency = "INR",
}: {
  data: { month: string; revenue: number }[];
  currency?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">No payments yet</p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v) => formatMoney(Number(v), currency)}
        />
        <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
