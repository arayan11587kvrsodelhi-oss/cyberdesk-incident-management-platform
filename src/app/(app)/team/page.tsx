"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { UserPlus, ShieldCheck, UserX } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, PasswordInput, Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/badge";
import { ErrorCallout, useToast } from "@/components/ui/toast";
import { api, ApiClientError } from "@/lib/client";
import { describe } from "@/components/data/mutations";
import { fmtDate, initials, cn } from "@/lib/utils";
import { ROLE_LABEL, can, type Role } from "@/lib/permissions";

type Member = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "DEACTIVATED";
  title: string | null;
  createdAt: string;
  sessionCount: number;
};

export default function TeamPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Member[] | null>(null);
  const [viewerId, setViewerId] = useState(0);
  const [role, setRole] = useState<Role>("VIEWER");
  const [error, setError] = useState<ApiClientError | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api<{ members: Member[]; viewerId: number }>("/api/team")
      .then((r) => {
        setRows(r.members);
        setViewerId(r.viewerId);
      })
      .catch((e: unknown) => setError(e instanceof ApiClientError ? e : new ApiClientError(500, "ERROR", "Could not load the team.")));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    api<{ viewer: { role: Role } }>("/api/options")
      .then((r) => setRole(r.viewer.role))
      .catch(() => undefined);
  }, []);

  async function changeRole(member: Member, nextRole: Role) {
    const snapshot = rows;
    setRows((r) => r?.map((m) => (m.id === member.id ? { ...m, role: nextRole } : m)) ?? null);
    try {
      await api(`/api/team/${member.id}`, { method: "PATCH", body: { role: nextRole } });
      toast.success(`${member.name} is now ${ROLE_LABEL[nextRole]}`, "Recorded in the activity log.");
      load();
    } catch (err) {
      setRows(snapshot);
      const d = describe(err);
      toast.error("Role change was rolled back", d.title);
    }
  }

  async function deactivate() {
    if (!pendingDeactivate) return;
    setBusy(true);
    try {
      await api(`/api/team/${pendingDeactivate.id}`, { method: "PATCH", body: { status: "DEACTIVATED" } });
      toast.success(`${pendingDeactivate.name} deactivated`, "Their active sessions were revoked.");
      setPendingDeactivate(null);
      load();
    } catch (err) {
      const d = describe(err);
      toast.error(d.title, d.detail);
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = can(role, "update", "user");
  const activeCount = rows?.filter((m) => m.status === "ACTIVE").length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Workspace access"
        title="Team"
        description="Roles decide what the server will accept. Every mutation is authorised again on the server, so hiding a control is never the only protection."
        actions={
          isAdmin ? (
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              <UserPlus size={14} /> Add team member
            </Button>
          ) : (
            <span className="mono text-[11px] text-[var(--muted-2)]">administrator access required</span>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Members" value={rows?.length ?? "—"} />
        <Stat label="Active" value={activeCount} tone="var(--accent)" />
        <Stat label="Administrators" value={rows?.filter((m) => m.role === "ADMIN").length ?? "—"} tone="var(--accent-2)" />
      </div>

      <Panel bleed>
        <PanelHeader
          title="Members"
          meta="Name · email · role · status · joined"
          className="border-b-0 px-4 pb-0 pt-4"
        />
        {!rows && !error ? (
          <div className="px-4 pb-4">
            <TableSkeleton rows={6} cols={5} />
          </div>
        ) : error ? (
          <ErrorState
            title="The team list could not be loaded"
            body={error.message}
            code={error.code}
            action={<Button variant="outline" onClick={load}>Try again</Button>}
          />
        ) : !rows || rows.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={18} />}
            title="No team members"
            body="Add colleagues so incidents, tasks and notes can be attributed to a real person in the workspace."
            action={
              isAdmin ? (
                <Button variant="primary" onClick={() => setInviteOpen(true)}>
                  Add team member
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th className="label border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5 font-medium">
                    Member
                  </th>
                  <th className="label border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2.5 font-medium">
                    Email
                  </th>
                  <th className="label border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2.5 font-medium">
                    Role
                  </th>
                  <th className="label border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th className="label border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2.5 font-medium">
                    Joined
                  </th>
                  <th className="label border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-[var(--hover)]">
                    <td className="border-b border-[var(--border)] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "mono flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border text-[11px] font-semibold",
                            m.status === "ACTIVE"
                              ? "border-[var(--border-strong)] bg-[var(--panel-2)]"
                              : "border-[var(--border)] opacity-50",
                          )}
                        >
                          {initials(m.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">
                            {m.name}
                            {m.id === viewerId ? <span className="ml-1.5 text-[11px] text-[var(--muted-2)]">(you)</span> : null}
                          </p>
                          <p className="truncate text-[11.5px] text-[var(--muted-2)]">{m.title ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="mono border-b border-[var(--border)] px-3 py-3 text-[11.5px] text-[var(--muted)]">
                      {m.email}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      {isAdmin && m.id !== viewerId ? (
                        <Select
                          value={m.role}
                          onChange={(e) => changeRole(m, e.target.value as Role)}
                          aria-label={`Role for ${m.name}`}
                          className="h-8 min-w-[140px]"
                        >
                          {(["ADMIN", "ANALYST", "VIEWER"] as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Pill tone={m.role === "ADMIN" ? "positive" : m.role === "ANALYST" ? "info" : "neutral"} dot={false}>
                          {ROLE_LABEL[m.role]}
                        </Pill>
                      )}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <Pill tone={m.status === "ACTIVE" ? "positive" : "neutral"}>
                        {m.status === "ACTIVE" ? "Active" : "Deactivated"}
                      </Pill>
                    </td>
                    <td className="mono border-b border-[var(--border)] px-3 py-3 text-[11.5px] text-[var(--muted)]">
                      {fmtDate(m.createdAt)}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3 text-right">
                      {isAdmin && m.id !== viewerId && m.status === "ACTIVE" ? (
                        <Button size="sm" variant="danger" onClick={() => setPendingDeactivate(m)}>
                          <UserX size={13} /> Deactivate
                        </Button>
                      ) : m.status === "ACTIVE" ? (
                        <span className="mono text-[10.5px] text-[var(--muted-2)]">
                          {m.sessionCount > 0 ? `${m.sessionCount} session${m.sessionCount === 1 ? "" : "s"}` : "no session"}
                        </span>
                      ) : (
                        <span className="mono text-[10.5px] text-[var(--muted-2)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="mt-4">
        <PanelHeader title="Role capabilities" meta="Enforced in server code on every mutation" />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th className="label border-b border-[var(--border)] px-3 py-2 font-medium">Capability</th>
                <th className="label border-b border-[var(--border)] px-3 py-2 font-medium">Admin</th>
                <th className="label border-b border-[var(--border)] px-3 py-2 font-medium">Analyst</th>
                <th className="label border-b border-[var(--border)] px-3 py-2 font-medium">Viewer</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Create incidents, alerts, assets", "incident", "create"],
                ["Update incidents, alerts, tasks", "incident", "update"],
                ["Delete incidents & assets", "incident", "delete"],
                ["Add notes and tasks", "note", "create"],
                ["Manage team members & roles", "user", "update"],
              ].map(([label, res, action]) => (
                <tr key={label as string}>
                  <td className="border-b border-[var(--border)] px-3 py-2.5 text-[12.5px]">{label}</td>
                  {(["ADMIN", "ANALYST", "VIEWER"] as Role[]).map((r) => (
                    <td key={r} className="border-b border-[var(--border)] px-3 py-2.5">
                      {can(r, action as "create" | "update" | "delete", res as "incident") ? (
                        <span className="mono text-[11px]" style={{ color: "var(--accent)" }}>
                          allowed
                        </span>
                      ) : (
                        <span className="mono text-[11px] text-[var(--muted-2)]">denied</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mono mt-3 flex items-center gap-1.5 text-[10.5px] text-[var(--muted-2)]">
          <ShieldCheck size={12} /> Denials return HTTP 403 with a readable message — no stack traces.
        </p>
      </Panel>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onSaved={() => { load(); }} />
      <ConfirmDialog
        open={Boolean(pendingDeactivate)}
        onClose={() => setPendingDeactivate(null)}
        onConfirm={deactivate}
        busy={busy}
        confirmLabel="Deactivate"
        title={`Deactivate ${pendingDeactivate?.name ?? "member"}?`}
        body={
          <>
            They will be signed out immediately and unable to sign in until reactivated. Their incidents, notes and
            tasks stay attributed to them.
          </>
        }
      />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] px-4 py-3.5" style={{ borderRadius: 4 }}>
      <p className="label">{label}</p>
      <p className="mono mt-1.5 text-[26px] leading-none tabular-nums" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

function InviteDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ANALYST" as Role, title: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: "", email: "", password: "", role: "ANALYST", title: "" });
      setErrors({});
      setErr(null);
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter a full name";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email";
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{10,72}$/.test(form.password)) {
      next.password = "Use 10+ characters with upper, lower, number and symbol";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api("/api/team", { method: "POST", body: form });
      onSaved();
      onClose();
    } catch (e2) {
      const d = e2 as ApiClientError;
      setErr(d.message);
      setErrors(d.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add team member"
      description="Accounts are created directly in the workspace. No email is sent — this demo does not integrate with any mail provider."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="invite-form" loading={busy}>
            Create account
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} noValidate className="space-y-4">
        {err ? <ErrorCallout title={err} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tm-name">Full name</Label>
            <Input
              id="tm-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              invalid={Boolean(errors.name)}
            />
            {errors.name ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.name}</p> : null}
          </div>
          <div>
            <Label htmlFor="tm-email">Email</Label>
            <Input
              id="tm-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              invalid={Boolean(errors.email)}
            />
            {errors.email ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.email}</p> : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tm-role">Role</Label>
            <Select
              id="tm-role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            >
              {(["ADMIN", "ANALYST", "VIEWER"] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tm-title" hint="optional">
              Job title
            </Label>
            <Input
              id="tm-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Incident Responder"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="tm-password" hint="demo-only credential">
            Temporary password
          </Label>
          <PasswordInput
            id="tm-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            invalid={Boolean(errors.password)}
          />
          {errors.password ? (
            <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">
              {errors.password}
            </p>
          ) : null}
          <p className="mt-1.5 text-[11.5px] text-[var(--muted-2)]">
            Store it in your password manager and share it out of band — no email is sent from this demo.
          </p>
        </div>
      </form>
    </Dialog>
  );
}
