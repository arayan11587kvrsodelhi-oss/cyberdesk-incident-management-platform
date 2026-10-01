"use client";

import type { ReactNode } from "react";
import { MobileNav, Sidebar, type Viewer } from "@/components/shell/sidebar";

export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Sidebar viewer={viewer} />
      <MobileNav viewer={viewer} />

      <div className="lg:pl-[248px]">
        <div className="border-b border-[var(--border)] bg-[var(--bg-raise)] px-4 py-2 lg:px-6">
          <p className="mono text-[10px] leading-relaxed tracking-[0.1em] uppercase text-[var(--muted-2)]">
            Simulated demo data — CYBERDESK is a portfolio project. Nothing in this workspace is a real
            incident, customer, or telemetry feed.
          </p>
        </div>
        <main id="main-content" className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
