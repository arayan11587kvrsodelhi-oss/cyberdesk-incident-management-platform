"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, ListChecks, NotebookPen, Pencil, Plus } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Select, Textarea, Input, Label } from "@/components/ui/field";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Pill, SEVERITY_TONE, INCIDENT_STATUS_TONE, TASK_STATUS_TONE, TASK_PRIORITY_TONE } from "@/components/ui/badge";
import { ErrorCallout, useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { api, ApiClientError } from "@/lib/client";
import { describe } from "@/components/data/mutations";
import { fmtDateTime, fmtRelative, truncate } from "@/lib/utils";
import { can, ROLE_LABEL, type Role } from "@/lib/permissions";

export type DetailIncident = {
  id: number;
  key: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
  assigneeId: number | null;
  assigneeName: string | null;
};

export type Option = { id: number; name: string; role?: string };
export type AssetOption = { id: number; key: string; name: string; type?: string; status?: string; ipAddress?: string | null };
export type NoteRow = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
};
export type TaskRow = {
  id: number;
  key: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string | null;
  assigneeName: string | null;
};
export type AlertRow = {
  id: number;
  key: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  detectedAt: string;
};
export type ActivityRow = {
  id: number;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
};

export function IncidentDetail({
  incident,
  viewer,
  users,
  assets: assetOptions,
  assetIds,
  notes,
  tasks,
  alerts,
  activity,
  affectedAssets,
}: {
  incident: DetailIncident;
  viewer: { id: number; role: Role; name: string };
  users: Option[];
  assets: AssetOption[];
  assetIds: number[];
  notes: NoteRow[];
  tasks: TaskRow[];
  alerts: AlertRow[];
  activity: ActivityRow[];
  affectedAssets: AssetOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(incident.status);
  const [assignee, setAssignee] = useState<number | null>(incident.assigneeId);
  const [savingField, setSavingField] = useState<"status" | "assignee" | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [taskList, setTaskList] = useState(tasks);
  const canEdit = can(viewer.role, "update", "incident");
  const canNote = can(viewer.role, "create", "note");
  const canTask = can(viewer.role, "create", "task");

  useEffect(() => setTaskList(tasks), [tasks]);

  /** Optimistic status/assignee change with rollback on failure. */
  const change = useCallback(
    async (patch: Record<string, unknown>, kind: "status" | "assignee", label: string) => {
      const prevStatus = status;
      const prevAssignee = assignee;
      if (kind === "status") setStatus(String(patch.status));
      if (kind === "assignee") setAssignee((patch.assigneeId as number | null) ?? null);
      setSavingField(kind);
      try {
        await api(`/api/incidents/${incident.id}`, { method: "PATCH", body: patch });
        toast.success(label);
        router.refresh();
      } catch (err) {
        setStatus(prevStatus);
        setAssignee(prevAssignee);
        const d = describe(err);
        toast.error("Change was not saved", d.detail ? `${d.title} ${d.detail}` : d.title);
      } finally {
        setSavingField(null);
      }
    },
    [assignee, incident.id, router, status, toast],
  );

  async function toggleTask(task: TaskRow) {
    const next = task.status === "DONE" ? "TODO" : "DONE";
    const snapshot = taskList;
    setTaskList((list) => list.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: { status: next } });
      toast.success(next === "DONE" ? `${task.key} completed` : `${task.key} reopened`);
      router.refresh();
    } catch (err) {
      setTaskList(snapshot);
      const d = describe(err);
      toast.error("Task update failed", d.title);
    }
  }

  const timeline = useMemo(
    () => [...activity].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [activity],
  );

  return (
    <div className="space-y-4">
      <Link
        href="/incidents"
        className="mono inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={13} /> Back to ledger
      </Link>

      <header className="border-b border-[var(--border)] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-[12px] text-[var(--muted)]">{incident.key}</span>
          <Pill tone={SEVERITY_TONE[incident.severity] ?? "neutral"}>{incident.severity}</Pill>
          <Pill tone={INCIDENT_STATUS_TONE[status] ?? "neutral"}>{status.replace("_", " ")}</Pill>
          {incident.tags ? (
            <span className="mono text-[11px] text-[var(--muted-2)]">
              {incident.tags.split(",").map((t) => t.trim()).join(" · ")}
            </span>
          ) : null}
        </div>
        <h1 className="mt-2.5 max-w-[62ch] text-[26px] leading-[1.14] font-semibold tracking-[-0.025em] sm:text-[32px]">
          {incident.title}
        </h1>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Meta label="Created" value={fmtDateTime(incident.createdAt)} />
          <Meta label="Updated" value={fmtRelative(incident.updatedAt)} />
          <Meta label="Record id" value={`#${incident.id}`} />
        </dl>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Summary"
              action={
                canEdit ? (
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil size={13} /> Edit
                  </Button>
                ) : (
                  <span className="mono text-[10px] text-[var(--muted-2)]">read-only</span>
                )
              }
            />
            <p className="mt-4 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text)]/90">
              {incident.description}
            </p>

            <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="detail-status">Status</Label>
                <Select
                  id="detail-status"
                  value={status}
                  disabled={!canEdit || savingField === "status"}
                  onChange={(e) => change({ status: e.target.value }, "status", `Status set to ${e.target.value.replace("_", " ").toLowerCase()}`)}
                >
                  {["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"].map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="detail-assignee">Assigned analyst</Label>
                <Select
                  id="detail-assignee"
                  value={String(assignee ?? "")}
                  disabled={!canEdit || savingField === "assignee"}
                  onChange={(e) =>
                    change(
                      { assigneeId: e.target.value ? Number(e.target.value) : null },
                      "assignee",
                      e.target.value ? "Assignment updated" : "Incident unassigned",
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {ROLE_LABEL[(u.role ?? "VIEWER") as Role]}
                    </option>
                  ))}
                </Select>
                {!canEdit ? (
                  <p className="mt-1.5 text-[11.5px] text-[var(--muted-2)]">
                    Your role ({ROLE_LABEL[viewer.role]}) cannot change records.
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Investigation notes"
              meta={`${notes.length} entr${notes.length === 1 ? "y" : "ies"} in the chronological log`}
              action={
                canNote ? (
                  <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
                    <NotebookPen size={13} /> Add note
                  </Button>
                ) : undefined
              }
            />
            {notes.length ? (
              <ol className="mt-4 space-y-4 border-l border-[var(--border)] pl-4">
                {notes.map((n) => (
                  <li key={n.id} className="relative">
                    <span
                      className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full border border-[var(--border-strong)] bg-[var(--panel)]"
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-[13.5px] font-medium">{n.title}</h3>
                      <span className="mono text-[10.5px] text-[var(--muted-2)]">
                        {n.authorName} · {fmtDateTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--muted)]">
                      {n.body}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                icon={<NotebookPen size={18} />}
                title="No investigation notes yet"
                body="Record what you checked and what you found. Notes become the audit trail for this incident."
                action={
                  canNote ? (
                    <Button size="sm" variant="primary" onClick={() => setNoteOpen(true)}>
                      Add first note
                    </Button>
                  ) : undefined
                }
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Tasks"
              meta={`${taskList.filter((t) => t.status === "DONE").length} of ${taskList.length} done`}
              action={
                canTask ? (
                  <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
                    <Plus size={13} /> Create task
                  </Button>
                ) : undefined
              }
            />
            {taskList.length ? (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {taskList.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 py-3">
                    {can(viewer.role, "update", "task") ? (
                      <button
                        type="button"
                        onClick={() => toggleTask(t)}
                        aria-label={t.status === "DONE" ? `Reopen ${t.key}` : `Complete ${t.key}`}
                        aria-pressed={t.status === "DONE"}
                        className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors"
                        style={{
                          width: 18,
                          height: 18,
                          borderColor: t.status === "DONE" ? "var(--accent)" : "var(--border-strong)",
                          background: t.status === "DONE" ? "var(--accent)" : "transparent",
                        }}
                      >
                        {t.status === "DONE" ? <Check size={11} color="#04140A" strokeWidth={3} /> : null}
                      </button>
                    ) : (
                      <span className="mt-1 h-4 w-4 shrink-0 rounded-[3px] border border-[var(--border)]" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[13px] leading-snug"
                        style={{
                          textDecoration: t.status === "DONE" ? "line-through" : undefined,
                          color: t.status === "DONE" ? "var(--muted)" : undefined,
                        }}
                      >
                        {t.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="mono text-[10.5px] text-[var(--muted-2)]">{t.key}</span>
                        <Pill tone={TASK_PRIORITY_TONE[t.priority] ?? "neutral"} dot={false}>
                          {t.priority}
                        </Pill>
                        <Pill tone={TASK_STATUS_TONE[t.status] ?? "neutral"} dot={false}>
                          {t.status.replace("_", " ")}
                        </Pill>
                        {t.assigneeName ? (
                          <span className="text-[11.5px] text-[var(--muted-2)]">{t.assigneeName}</span>
                        ) : null}
                        {t.dueDate ? (
                          <span className="mono text-[10.5px] text-[var(--muted-2)]">due {t.dueDate}</span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<ListChecks size={18} />}
                title="No tasks for this incident"
                body="Break the response into owned, dated steps so nothing is lost between shifts."
                action={
                  canTask ? (
                    <Button size="sm" variant="primary" onClick={() => setTaskOpen(true)}>
                      Create first task
                    </Button>
                  ) : undefined
                }
              />
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Affected assets" meta={`${affectedAssets.length} linked`} />
            {affectedAssets.length ? (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {affectedAssets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/assets/${a.id}`}
                        className="block truncate text-[13px] font-medium underline-offset-4 hover:underline"
                      >
                        {a.name}
                      </Link>
                      <p className="mono truncate text-[10.5px] text-[var(--muted-2)]">
                        {a.key}
                        {a.ipAddress ? ` · ${a.ipAddress}` : ""}
                      </p>
                    </div>
                    <Pill
                      tone={
                        a.status === "HEALTHY" ? "positive" : a.status === "WARNING" ? "warn" : a.status === "CRITICAL" ? "critical" : "neutral"
                      }
                      dot={false}
                    >
                      {a.status}
                    </Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Plus size={18} />}
                title="No assets linked"
                body="Link the systems this incident touches so scope stays visible."
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Linked alerts" meta={`${alerts.length} from detection sources`} />
            {alerts.length ? (
              <ul className="mt-3 space-y-3">
                {alerts.map((a) => (
                  <li key={a.id} className="border-l-2 pl-3" style={{ borderColor: a.severity === "CRITICAL" ? "#ef4444" : a.severity === "HIGH" ? "#f97316" : a.severity === "MEDIUM" ? "#f59e0b" : "#38bdf8" }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="mono text-[11px] text-[var(--muted)]">{a.key}</span>
                      <span className="mono text-[10.5px] text-[var(--muted-2)]">{fmtRelative(a.detectedAt)}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug">{truncate(a.title, 90)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill tone={SEVERITY_TONE[a.severity] ?? "neutral"} dot={false}>
                        {a.severity}
                      </Pill>
                      <Pill tone="neutral" dot={false}>
                        {a.source}
                      </Pill>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Plus size={18} />}
                title="No alerts linked"
                body="Detection alerts attached to this incident will appear here."
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Activity" meta="Actor · action · timestamp" />
            {timeline.length ? (
              <ol className="mt-3 space-y-3">
                {timeline.map((a) => (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="grid grid-cols-[52px_1fr] gap-3"
                  >
                    <span className="mono text-[10.5px] text-[var(--muted-2)]">
                      {fmtDateTime(a.createdAt).split(", ")[1] ?? ""}
                    </span>
                    <div className="border-l border-[var(--border)] pl-3">
                      <p className="text-[12.5px] leading-snug break-words">{a.summary}</p>
                      <p className="mono mt-0.5 text-[10px] text-[var(--muted-2)]">
                        {a.actorName} · {a.action} · {fmtDateTime(a.createdAt).split(",")[0]}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={<Plus size={18} />} title="No activity yet" body="Changes to this incident will be recorded here." />
            )}
          </Panel>
        </div>
      </div>

      <NoteDialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        incidentId={incident.id}
        onSaved={() => {
          toast.success("Investigation note added");
          router.refresh();
        }}
      />
      <TaskDialog
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        incidentId={incident.id}
        users={users}
        onSaved={() => {
          toast.success("Task created");
          router.refresh();
        }}
      />
      <EditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        incident={incident}
        users={users}
        assets={assetOptions}
        assetIds={assetIds}
        onSaved={() => {
          toast.success("Incident updated");
          router.refresh();
        }}
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mono mt-1 text-[12.5px]">{value}</dd>
    </div>
  );
}

function NoteDialog({
  open,
  onClose,
  incidentId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  incidentId: number;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setBody("");
      setErrors({});
      setErr(null);
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = "Give the note a short title";
    if (!body.trim()) next.body = "Write the note";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api("/api/notes", { method: "POST", body: { title, body, incidentId } });
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
      title="Add investigation note"
      description="Notes are attributed to you and appended to the incident timeline."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="note-form" loading={busy}>
            Save note
          </Button>
        </>
      }
    >
      <form id="note-form" onSubmit={submit} noValidate className="space-y-4">
        {err ? <ErrorCallout title={err} /> : null}
        <div>
          <Label htmlFor="note-title">Title</Label>
          <Input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            invalid={Boolean(errors.title)}
            placeholder="Initial triage — scope confirmed"
          />
          {errors.title ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.title}</p> : null}
        </div>
        <div>
          <Label htmlFor="note-body">Note</Label>
          <Textarea
            id="note-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            invalid={Boolean(errors.body)}
            className="min-h-[140px]"
            placeholder="What you checked, what you found, and what happens next."
          />
          {errors.body ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.body}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}

function TaskDialog({
  open,
  onClose,
  incidentId,
  users,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  incidentId: number;
  users: Option[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setAssigneeId("");
      setDueDate("");
      setErrors({});
      setErr(null);
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = "Describe the task in a few words";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: {
          title,
          description,
          incidentId,
          priority,
          status: "TODO",
          assigneeId: assigneeId ? Number(assigneeId) : null,
          dueDate: dueDate || null,
        },
      });
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
      title="Create task"
      description="Tasks are owned, dated response steps linked to this incident."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="task-form" loading={busy}>
            Create task
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} noValidate className="space-y-4">
        {err ? <ErrorCallout title={err} /> : null}
        <div>
          <Label htmlFor="task-title">Task title</Label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            invalid={Boolean(errors.title)}
            placeholder="Rotate the demo service account credential"
          />
          {errors.title ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.title}</p> : null}
        </div>
        <div>
          <Label htmlFor="task-desc">Description</Label>
          <Textarea
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Definition of done."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="task-priority">Priority</Label>
            <Select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="task-assignee">Assignee</Label>
            <Select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="task-due">Due date</Label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function EditDialog({
  open,
  onClose,
  incident,
  users,
  assets,
  assetIds,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  incident: DetailIncident;
  users: Option[];
  assets: AssetOption[];
  assetIds: number[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    assigneeId: incident.assigneeId ? String(incident.assigneeId) : "",
    tags: incident.tags,
  });
  const [selected, setSelected] = useState<number[]>(assetIds);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        assigneeId: incident.assigneeId ? String(incident.assigneeId) : "",
        tags: incident.tags,
      });
      setSelected(assetIds);
      setErrors({});
      setErr(null);
    }
  }, [open, incident, assetIds]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.title.trim().length < 3) next.title = "Title must be at least 3 characters";
    if (!form.description.trim()) next.description = "Description is required";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api(`/api/incidents/${incident.id}`, {
        method: "PATCH",
        body: {
          ...form,
          assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
          assetIds: selected,
        },
      });
      onSaved();
      onClose();
      router.refresh();
    } catch (e2) {
      const d = e2 as ApiClientError;
      setErr(d.message);
      setErrors(d.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/incidents/${incident.id}`, { method: "DELETE" });
      window.location.href = "/incidents";
    } catch (e2) {
      setBusy(false);
      setConfirm(false);
      setErr((e2 as ApiClientError).message);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`Edit ${incident.key}`}
        description="Every change is validated server-side and written to the activity log."
        size="lg"
        footer={
          <>
            <Button variant="danger" type="button" onClick={() => setConfirm(true)}>
              Delete
            </Button>
            <span className="flex-1" />
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="edit-incident" loading={busy}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-incident" onSubmit={submit} noValidate className="space-y-4">
          {err ? <ErrorCallout title={err} /> : null}
          <div>
            <Label htmlFor="e-title">Title</Label>
            <Input
              id="e-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              invalid={Boolean(errors.title)}
            />
            {errors.title ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.title}</p> : null}
          </div>
          <div>
            <Label htmlFor="e-desc">Description</Label>
            <Textarea
              id="e-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              invalid={Boolean(errors.description)}
              className="min-h-[130px]"
            />
            {errors.description ? (
              <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.description}</p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="e-sev">Severity</Label>
              <Select
                id="e-sev"
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
              >
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="e-status">Status</Label>
              <Select
                id="e-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="e-assignee">Assigned analyst</Label>
              <Select
                id="e-assignee"
                value={form.assigneeId}
                onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="e-tags" hint="comma separated">
              Tags
            </Label>
            <Input id="e-tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
          </div>
          <fieldset>
            <legend className="label mb-2">Affected assets</legend>
            <div className="grid max-h-[160px] gap-1.5 overflow-y-auto border border-[var(--border)] p-2 sm:grid-cols-2" style={{ borderRadius: 4 }}>
              {assets.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-2 rounded-[3px] px-2 py-1.5 text-[12.5px] hover:bg-[var(--hover)]"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() =>
                      setSelected((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]))
                    }
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  <span className="mono text-[11px] text-[var(--muted-2)]">{a.key}</span>
                  <span className="truncate">{a.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        busy={busy}
        title={`Delete ${incident.key}?`}
        body="This removes the incident and cascades to its investigation notes, tasks and asset links. This cannot be undone."
      />
    </>
  );
}
