"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2, MonitorSmartphone, Save, UserRound } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input, Label, PasswordInput, Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/badge";
import { ErrorCallout, useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/client";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { fmtDateTime, cn } from "@/lib/utils";
import { ThemeToggle, useTheme } from "@/components/shell/theme-toggle";

type Viewer = { id: number; name: string; email: string; role: Role; title: string | null; createdAt: string };
type SessionRow = { id: number; userAgent: string | null; ip: string | null; createdAt: string; lastSeenAt: string; current: boolean };

type Tab = "profile" | "security" | "preferences";

export default function SettingsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("profile");
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme, setTheme, reduceMotion, setReduce } = useTheme();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api<{ viewer: Viewer }>("/api/settings/viewer")
      .then((r) => setViewer(r.viewer))
      .catch((e: unknown) =>
        setError(e instanceof ApiClientError ? e.message : "Settings could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "preferences", label: "Preferences" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile details, password and session controls, and display preferences for this browser."
      />

      <div role="tablist" aria-label="Settings sections" className="mb-4 flex flex-wrap gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative -mb-px px-4 py-2.5 text-[13px] transition-colors",
              tab === t.id ? "text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            {t.label}
            {tab === t.id ? (
              <span
                className="absolute inset-x-0 bottom-0 h-[2px]"
                style={{ background: "var(--accent)" }}
                aria-hidden
              />
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4" role="status">
          <Panel>
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[13px]">Loading your account…</span>
            </div>
          </Panel>
        </div>
      ) : error ? (
        <Panel>
          <ErrorCallout title="Settings could not be loaded" detail={error} />
          <Button className="mt-3" variant="outline" onClick={load}>
            Try again
          </Button>
        </Panel>
      ) : !viewer ? (
        <Panel>
          <ErrorCallout title="Account not found" detail="Sign in again to manage your settings." />
        </Panel>
      ) : (
        <>
          {tab === "profile" ? <ProfilePanel viewer={viewer} onSaved={(name) => { setViewer({ ...viewer, name }); toast.success("Profile updated"); }} /> : null}
          {tab === "security" ? <SecurityPanel viewer={viewer} /> : null}
          {tab === "preferences" ? (
            <PreferencesPanel theme={theme} setTheme={setTheme} reduce={reduceMotion} setReduce={setReduce} />
          ) : null}
        </>
      )}
    </>
  );
}

function ProfilePanel({ viewer, onSaved }: { viewer: Viewer; onSaved: (name: string) => void }) {
  const [name, setName] = useState(viewer.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ title: string; detail?: string } | null>(null);

  useEffect(() => setName(viewer.name), [viewer.name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2) {
      setErr({ title: "Enter your full name" });
      return;
    }
    setBusy(true);
    try {
      await api("/api/settings/profile", { method: "PATCH", body: { name: name.trim() } });
      onSaved(name.trim());
    } catch (e2) {
      const d = e2 as ApiClientError;
      setErr({ title: d.message, detail: Object.values(d.fields ?? {})[0] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <Panel>
        <PanelHeader title="Profile" meta="How you appear in activity logs and assignments" />
        <form onSubmit={submit} className="mt-4 space-y-4">
          {err ? <ErrorCallout title={err.title} detail={err.detail} /> : null}
          <div>
            <Label htmlFor="pf-name">Full name</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pf-email" hint="fixed">
              Email
            </Label>
            <Input id="pf-email" value={viewer.email} readOnly disabled />
            <p className="mt-1.5 text-[11.5px] text-[var(--muted-2)]">
              Email changes are not part of this demo workspace — ask an administrator instead.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={busy}>
              <Save size={13} /> Save profile
            </Button>
          </div>
        </form>
      </Panel>

      <Panel>
        <PanelHeader title="Account" />
        <div className="mt-4 flex items-center gap-3">
          <span className="mono flex h-11 w-11 items-center justify-center rounded-[4px] border border-[var(--border-strong)] bg-[var(--panel-2)] text-[14px] font-semibold">
            {viewer.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{viewer.name}</p>
            <p className="mono truncate text-[11.5px] text-[var(--muted)]">{viewer.email}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-2.5 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <dt className="label">Role</dt>
            <dd>
              <Pill tone={viewer.role === "ADMIN" ? "positive" : viewer.role === "ANALYST" ? "info" : "neutral"} dot={false}>
                {ROLE_LABEL[viewer.role]}
              </Pill>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="label">Title</dt>
            <dd className="truncate text-[12.5px]">{viewer.title ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="label">Member since</dt>
            <dd className="mono text-[12px]">{fmtDateTime(viewer.createdAt)}</dd>
          </div>
        </dl>
        <p className="mono mt-4 flex items-center gap-1.5 text-[10.5px] text-[var(--muted-2)]">
          <UserRound size={12} /> account #{viewer.id}
        </p>
      </Panel>
    </div>
  );
}

function SecurityPanel({ viewer }: { viewer: Viewer }) {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    api<{ sessions: SessionRow[] }>("/api/settings/sessions")
      .then((r) => setSessions(r.sessions))
      .catch((e: unknown) => setSessionError(e instanceof ApiClientError ? e.message : "Session list unavailable."));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setErr(null);
    const next: Record<string, string> = {};
    if (!form.currentPassword) next.currentPassword = "Enter your current password";
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{10,72}$/.test(form.newPassword)) {
      next.newPassword = "Use 10+ characters with upper, lower, number and symbol";
    }
    if (form.confirmPassword !== form.newPassword) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await api("/api/settings/profile", { method: "PUT", body: form });
      toast.success("Password updated", "Other sessions for this account were revoked.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      api<{ sessions: SessionRow[] }>("/api/settings/sessions")
        .then((r) => setSessions(r.sessions))
        .catch(() => undefined);
    } catch (e2) {
      const d = e2 as ApiClientError;
      setErr(d.message);
      setErrors(d.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <Panel>
        <PanelHeader title="Change password" meta="Hashed with scrypt — plaintext is never stored" />
        <form onSubmit={submit} className="mt-4 space-y-4">
          {err ? <ErrorCallout title={err} /> : null}
          <div>
            <Label htmlFor="sp-current">Current password</Label>
            <PasswordInput
              id="sp-current"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              invalid={Boolean(errors.currentPassword)}
            />
            {errors.currentPassword ? (
              <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">
                {errors.currentPassword}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sp-new">New password</Label>
              <PasswordInput
                id="sp-new"
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                invalid={Boolean(errors.newPassword)}
              />
              {errors.newPassword ? (
                <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">
                  {errors.newPassword}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="sp-confirm">Confirm new password</Label>
              <PasswordInput
                id="sp-confirm"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                invalid={Boolean(errors.confirmPassword)}
              />
              {errors.confirmPassword ? (
                <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">
                  {errors.confirmPassword}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={busy}>
              <KeyRound size={13} /> Update password
            </Button>
          </div>
        </form>
      </Panel>

      <Panel>
        <PanelHeader title="Active sessions" meta={`Signed in as ${viewer.email}`} />
        {sessionError ? (
          <ErrorCallout title="Sessions unavailable" detail={sessionError} className="mt-4" />
        ) : !sessions ? (
          <div className="mt-4 flex items-center gap-2 text-[var(--muted)]">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[13px]">Loading sessions…</span>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="border border-[var(--border)] p-3" style={{ borderRadius: 4 }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="mono flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                    <MonitorSmartphone size={12} /> {s.ip ?? "this device"}
                  </span>
                  {s.current ? <Pill tone="positive">Current</Pill> : <Pill tone="neutral" dot={false}>Other</Pill>}
                </div>
                <p className="mt-2 line-clamp-2 text-[11.5px] break-words text-[var(--muted-2)]">
                  {s.userAgent ?? "Unknown client"}
                </p>
                <p className="mono mt-1 text-[10.5px] text-[var(--muted-2)]">
                  started {fmtDateTime(s.createdAt)} · last seen {fmtDateTime(s.lastSeenAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--muted-2)]">
          Sessions are stored server-side and identified only by a hashed token. Changing your password revokes every
          other session.
        </p>
      </Panel>
    </div>
  );
}

function PreferencesPanel({
  theme,
  setTheme,
  reduce,
  setReduce,
}: {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  reduce: boolean;
  setReduce: (v: boolean) => void;
}) {
  const toast = useToast();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Theme" meta="Dark is the default for low-light operations rooms" />
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium">{theme === "dark" ? "Dark" : "Light"}</p>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              {theme === "dark"
                ? "Chassis black panels, silkscreen labels, status colour only where it means something."
                : "Paper-white panels with the same status palette, tuned for contrast."}
            </p>
          </div>
          <div className="w-[180px] shrink-0">
            <ThemeToggle theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-[var(--border)] pt-4">
          {[
            ["#22C55E", "Nominal"],
            ["#38BDF8", "Info"],
            ["#F59E0B", "Warning"],
            ["#EF4444", "Critical"],
          ].map(([hex, label]) => (
            <div key={hex} className="text-center">
              <span className="mx-auto block h-6 w-full rounded-[3px]" style={{ background: hex }} aria-hidden />
              <span className="mono mt-1.5 block text-[9.5px] text-[var(--muted-2)]">{label}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Reduced motion" meta="Applies immediately and is remembered for this browser" />
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium">{reduce ? "Animations reduced" : "Animations enabled"}</p>
            <p className="mt-0.5 max-w-[46ch] text-[12px] text-[var(--muted)]">
              When reduced, transitions and staged entrances are collapsed to near-instant state changes. Your operating
              system preference is respected automatically either way.
            </p>
          </div>
          <div className="w-[180px] shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={reduce}
              onClick={() => {
                setReduce(!reduce);
                toast.info(!reduce ? "Reduced motion enabled" : "Motion restored");
              }}
              className="flex h-9 w-full items-center justify-between gap-2 rounded-[4px] border border-[var(--border)] px-3 text-[12.5px] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
            >
              {reduce ? "Reduced" : "Full motion"}
              <span
                aria-hidden
                className="flex h-4 w-7 items-center rounded-full border border-[var(--border-strong)] p-[2px]"
                style={{ background: reduce ? "color-mix(in oklab, var(--accent) 30%, transparent)" : "transparent" }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full bg-[var(--muted)] transition-transform duration-200"
                  style={{ transform: reduce ? "translateX(12px)" : "translateX(0)" }}
                />
              </span>
            </button>
          </div>
        </div>
        <p className="mono mt-4 border-t border-[var(--border)] pt-4 text-[10.5px] leading-relaxed text-[var(--muted-2)]">
          Preferences are stored in this browser only. They never leave your machine and are not part of your account
          record.
        </p>
      </Panel>
    </div>
  );
}
