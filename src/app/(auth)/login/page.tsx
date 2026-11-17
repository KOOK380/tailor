"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Scissors,
  Loader2,
  BellRing,
  Clock,
  KanbanSquare,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FEATURES = [
  {
    icon: BellRing,
    title: "Smart deadline alerts",
    text: "Automatic reminders 7, 5, 3, 2, 1 days before delivery — and daily overdue follow-ups.",
  },
  {
    icon: KanbanSquare,
    title: "Live production board",
    text: "Track every garment through cutting, embroidery, stitching and QC at a glance.",
  },
  {
    icon: Clock,
    title: "Days-left countdown",
    text: "Every order shows exactly how much time is left, colour-coded by urgency.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-indigo-400/20 blur-2xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Scissors className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Tailor Management
            </p>
            <p className="text-xs text-blue-100">Production Suite</p>
          </div>
        </div>

        <div className="relative space-y-8">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Run your entire tailoring business from one dashboard.
          </h2>
          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <f.icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-0.5 max-w-sm text-xs leading-relaxed text-blue-100/90">
                    {f.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-blue-100/70">
          Orders · Production tracking · Smart notifications · Billing
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-white p-6">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <Scissors className="h-5 w-5" />
            </div>
            <p className="text-lg font-semibold tracking-tight text-slate-900">
              Tailor Management
            </p>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in to manage your orders and production.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@shop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New shop?{" "}
            <Link
              href="/register"
              className="font-semibold text-blue-600 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
