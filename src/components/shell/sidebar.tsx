"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { Mark, Wordmark } from "@/components/brand/mark";
import { NAV, WORKSPACE } from "@/components/shell/nav";
import { ThemeToggle, useTheme } from "@/components/shell/theme-toggle";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { cn, initials } from "@/lib/utils";

export type Viewer = { id: number; name: string; email: string; role: Role };

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group relative flex h-9 items-center gap-3 rounded-[4px] px-2.5 text-[13px] transition-colors duration-150",
              active
                ? "bg-[var(--hover)] text-[var(--text)]"
                : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full transition-opacity duration-150",
                active ? "opacity-100" : "opacity-0",
              )}
              style={{ background: "var(--accent)" }}
            />
            <Icon size={15} className="shrink-0" />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
            {collapsed ? <span className="sr-only">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountBlock({ viewer, collapsed }: { viewer: Viewer; collapsed: boolean }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
      });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-[var(--border)] pt-3">
        <span
          className="mono flex h-8 w-8 items-center justify-center rounded-[4px] border border-[var(--border-strong)] bg-[var(--panel-2)] text-[11px] font-semibold"
          title={`${viewer.name} · ${ROLE_LABEL[viewer.role]}`}
        >
          {initials(viewer.name)}
        </span>
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          {theme === "dark" ? "☾" : "☀"}
        </button>
        <button
          type="button"
          onClick={logout}
          disabled={busy}
          aria-label="Log out"
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--crit)]"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-3">
      <ThemeToggle theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />
      <div className="flex items-center gap-2.5 px-0.5">
        <span className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border-strong)] bg-[var(--panel-2)] text-[11px] font-semibold">
          {initials(viewer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium leading-tight">{viewer.name}</p>
          <p className="label mt-0.5 truncate" style={{ color: "var(--accent)" }}>
            {ROLE_LABEL[viewer.role]}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={busy}
          aria-label="Log out"
          title="Log out"
          className="shrink-0 rounded-[3px] p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--crit)]"
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ viewer }: { viewer: Viewer }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      aria-label="Workspace navigation"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] transition-[width] duration-200 lg:flex",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-[var(--border)]", collapsed ? "justify-center px-2" : "gap-2.5 px-4")}>
        <Mark size={22} />
        {!collapsed ? <Wordmark /> : <span className="sr-only">CYBERDESK</span>}
      </div>

      <div className={cn("border-b border-[var(--border)] py-3", collapsed ? "px-2" : "px-4")}>
        {collapsed ? (
          <div
            className="mx-auto h-8 w-8 rounded-[3px] border border-[var(--border)] bg-[var(--panel-2)]"
            title={`${WORKSPACE.name} ${WORKSPACE.suffix}`}
          />
        ) : (
          <div>
            <p className="label">Workspace</p>
            <p className="mt-1 truncate text-[12.5px] font-medium">
              {WORKSPACE.name} <span className="text-[var(--muted)]">{WORKSPACE.suffix}</span>
            </p>
            <p className="mono mt-0.5 truncate text-[10px] text-[var(--muted-2)]">{WORKSPACE.region}</p>
          </div>
        )}
      </div>

      <div className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
        <NavList collapsed={collapsed} />
      </div>

      <div className={cn("pb-3", collapsed ? "px-2" : "px-3")}>
        <AccountBlock viewer={viewer} collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "mt-2 flex h-8 w-full items-center gap-2 rounded-[4px] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]",
            collapsed ? "justify-center" : "px-2.5",
          )}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          {!collapsed ? <span className="label">Collapse</span> : null}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Mark size={20} />
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[var(--border)] text-[var(--muted)]"
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={open}
            className="flex h-9 items-center gap-2 rounded-[4px] border border-[var(--border)] px-3 text-[var(--muted)]"
          >
            <span className="flex flex-col gap-[3px]" aria-hidden>
              <span className="block h-[1.5px] w-4 bg-current" />
              <span className="block h-[1.5px] w-4 bg-current" />
              <span className="block h-[1.5px] w-4 bg-current" />
            </span>
            <span className="label">Menu</span>
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-0 bg-[rgba(3,5,7,0.72)]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 left-0 flex w-[80vw] max-w-[300px] flex-col border-r border-[var(--border-strong)] bg-[var(--panel)]"
          >
            <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
              <div className="flex items-center gap-2">
                <Mark size={20} />
                <Wordmark />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-[3px] p-1.5 text-[var(--muted)] hover:bg-[var(--hover)]"
              >
                ✕
              </button>
            </div>
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="label">Workspace</p>
              <p className="mt-1 text-[12.5px] font-medium">
                {WORKSPACE.name} <span className="text-[var(--muted)]">{WORKSPACE.suffix}</span>
              </p>
              <p className="mono mt-0.5 text-[10px] text-[var(--muted-2)]">{WORKSPACE.region}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <NavList collapsed={false} onNavigate={() => setOpen(false)} />
            </div>
            <div className="space-y-2 border-t border-[var(--border)] px-3 py-3">
              <ThemeToggle
                theme={theme}
                onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
              />
              <div className="flex items-center gap-2.5">
                <span className="mono flex h-8 w-8 items-center justify-center rounded-[4px] border border-[var(--border-strong)] bg-[var(--panel-2)] text-[11px] font-semibold">
                  {initials(viewer.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium leading-tight">{viewer.name}</p>
                  <p className="label mt-0.5" style={{ color: "var(--accent)" }}>
                    {ROLE_LABEL[viewer.role]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Log out"
                  className="rounded-[3px] p-2 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--crit)]"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </>
  );
}
