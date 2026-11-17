import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/db/client";
import { businessSettings, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SettingsForm } from "@/components/settings/settings-form";
import { EmailSettingsForm } from "@/components/settings/email-settings-form";
import { PushSettings } from "@/components/notifications/push-settings";
import { getEmailConfigStatus } from "@/server/settings";
import { Mail, Bell, Settings as SettingsIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, session.businessId))
    .limit(1);
  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, session.businessId))
    .limit(1);

  const canManage = session.permissions.manageSettings;
  const emailStatus = canManage ? await getEmailConfigStatus() : null;

  return (
    <div className="p-6">
      <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
        Settings
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Business profile, notifications, email and device push — everything in
        one place.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-[15px]">
              <span className="chip-blue flex h-8 w-8 items-center justify-center rounded-lg">
                <SettingsIcon className="h-4 w-4" />
              </span>
              Business Profile
            </CardTitle>
            <CardDescription>
              Name, timezone, currency, tax and notification schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage && settings ? (
              <SettingsForm
                business={{
                  name: business?.name ?? "",
                  timezone: business?.timezone ?? "Asia/Kolkata",
                  phone: business?.phone ?? "",
                  email: business?.email ?? "",
                  address: business?.address ?? "",
                  currency: business?.currency ?? "INR",
                  trn: business?.trn ?? "",
                }}
                settings={{
                  taxLabel: settings.taxLabel,
                  taxRate: Number(settings.taxRate),
                  dailySummaryEnabled: settings.dailySummaryEnabled,
                  dailySummaryTime: settings.dailySummaryTime,
                  emailSummaryEnabled: settings.emailSummaryEnabled,
                  reminderDays: (settings.reminderDays as number[]) ?? [],
                  overdueAlertsEnabled: settings.overdueAlertsEnabled,
                  delayWarningsEnabled: settings.delayWarningsEnabled,
                  holdAlertDays: settings.holdAlertDays,
                }}
              />
            ) : (
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  <strong>Business:</strong> {business?.name}
                </p>
                <p>
                  <strong>Timezone:</strong> {business?.timezone}
                </p>
                <p>
                  <strong>Currency:</strong> {business?.currency}
                </p>
                <p className="text-xs text-slate-400">
                  Only super admins can edit business settings.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 text-[15px]">
                <span className="chip-green flex h-8 w-8 items-center justify-center rounded-lg">
                  <Mail className="h-4 w-4" />
                </span>
                Email Setup (SMTP / Resend)
              </CardTitle>
              <CardDescription>
                Provider for summaries and alerts — test delivery with one click
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canManage && emailStatus ? (
                <EmailSettingsForm status={emailStatus} />
              ) : (
                <p className="text-xs text-slate-400">
                  Only super admins can configure the email provider.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 text-[15px]">
                <span className="chip-violet flex h-8 w-8 items-center justify-center rounded-lg">
                  <Bell className="h-4 w-4" />
                </span>
                Browser Push
              </CardTitle>
              <CardDescription>
                System notifications on this device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PushSettings />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
