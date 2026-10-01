import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/server/auth";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: { default: "Overview", template: "%s · CYBERDESK" },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // Server-side check: middleware only checks cookie presence.
  if (!user) redirect("/login");

  return (
    <AppShell
      viewer={{ id: user.id, name: user.name, email: user.email, role: user.role }}
    >
      {children}
    </AppShell>
  );
}
