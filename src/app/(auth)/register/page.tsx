"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Scissors, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
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
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-12 text-white lg:flex">
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

        <div className="relative">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Start managing your shop the modern way.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-blue-100/90">
            Create your business workspace in seconds — orders, production
            tracking, smart notifications and billing are ready to go.
          </p>
        </div>

        <p className="relative text-xs text-blue-100/70">
          Free to start · Your data stays private to your business
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-white p-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <Scissors className="h-5 w-5" />
            </div>
            <p className="text-lg font-semibold tracking-tight text-slate-900">
              Tailor Management
            </p>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            You&apos;ll be the Super Admin of your business workspace.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="businessName" className="text-[13px] font-medium">
                Business / Shop name
              </Label>
              <Input
                id="businessName"
                placeholder="Royal Tailors"
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-[13px] font-medium">
                Your name
              </Label>
              <Input
                id="fullName"
                placeholder="Amit Verma"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@shop.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[13px] font-medium">
                  Phone (optional)
                </Label>
                <Input
                  id="phone"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
