"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  KanbanSquare,
  CalendarDays,
  Users,
  UserCog,
  Receipt,
  Bell,
  BarChart3,
  Settings,
  Scissors,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Production",
    items: [
      { href: "/orders", label: "Orders", icon: ClipboardList },
      { href: "/orders/new", label: "New Order", icon: PlusCircle },
      { href: "/production", label: "Production Board", icon: KanbanSquare },
      { href: "/calendar", label: "Delivery Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "People & Billing",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/employees", label: "Employees", icon: UserCog },
      { href: "/billing", label: "Billing", icon: Receipt },
    ],
  },
  {
    label: "Insights & System",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/orders": "Orders",
  "/orders/new": "New Order",
  "/production": "Production Board",
  "/calendar": "Delivery Calendar",
  "/customers": "Customers",
  "/employees": "Employees",
  "/billing": "Billing",
  "/notifications": "Notifications",
  "/reports": "Reports",
  "/settings": "Settings",
};

function pageTitleFor(pathname: string): string {
  if (pathname.startsWith("/orders/") && pathname !== "/orders/new")
    return "Order Details";
  if (pathname.startsWith("/customers/")) return "Customer Details";
  if (pathname.startsWith("/employees/")) return "Employee Details";
  if (pathname.startsWith("/billing/")) return "Invoice";
  return PAGE_TITLES[pathname] ?? "Dashboard";
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { fullName: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = user.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25">
          <Scissors className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
            Tailor Management
          </p>
          <p className="text-[11px] leading-tight text-slate-400">
            Production Suite
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/orders"
                    ? pathname === "/orders" ||
                      (pathname.startsWith("/orders/") && pathname !== "/orders/new")
                    : item.href === "/orders/new"
                      ? pathname === "/orders/new"
                      : pathname === item.href ||
                        (item.href !== "/dashboard" &&
                          pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all",
                      active
                        ? "bg-blue-50 text-blue-700 shadow-xs"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] transition-colors",
                        active
                          ? "text-blue-600"
                          : "text-slate-400 group-hover:text-slate-600",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-900">
              {user.fullName}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {user.role.replace("_", " ")}
            </p>
          </div>
          <button
            aria-label="Sign out"
            onClick={logout}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-red-600 hover:shadow-xs"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f9fc]">
      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 border-r border-slate-200/80 lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[248px] shadow-2xl">
            <button
              aria-label="Close menu"
              className="absolute right-3 top-3 z-10 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-5 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-slate-900">
              {pageTitleFor(pathname)}
            </h1>
            <p className="hidden text-[11px] text-slate-400 sm:block">
              Tailor Management · {user.fullName.split(" ")[0]}
            </p>
          </div>
          <div className="flex-1" />
          {/* Header actions (notification bell mounts here) */}
          <div id="header-actions" />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
