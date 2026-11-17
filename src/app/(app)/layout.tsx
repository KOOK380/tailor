import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationProvider } from "@/components/notifications/notification-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return (
    <NotificationProvider>
      <AppShell
        user={{
          fullName: session.fullName,
          email: session.email,
          role: session.role,
        }}
      >
        {children}
      </AppShell>
    </NotificationProvider>
  );
}
