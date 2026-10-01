"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { TableShell, Th, Td, Spine, spineFor } from "@/components/data/table";
import { Toolbar, FilterSelect, ResetButton, allOption } from "@/components/data/toolbar";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Pill, TASK_STATUS_TONE, TASK_PRIORITY_TONE } from "@/components/ui/badge";
import { ErrorCallout, useToast } from "@/components/ui/toast";
import { useList } from "@/components/data/use-list";
import { describe, remove } from "@/components/data/mutations";
import { api, ApiClientError } from "@/lib/client";
import { fmtRelative, cn } from "@/lib/utils";
import { can, type Role } from "@/lib/permissions";

type Row = {
  id: number;
  key: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string | null;
  updatedAt: string;
  incidentId: number;
  incidentKey: string;
  incidentTitle: string;
  incidentSeverity: string;
  assigneeId: number | null;
  assigneeName: string | null;
};

type IncidentOption = { id: number; key: string; title: string };
type User = { id: number; name: string };
type Draft = {
  id?: number;
  key?: string;
  title: string;
  description: string;
  incidentId: number | null;
  assigneeId: number | null;
  priority: string;
  status: string;
  dueDate: string | null;
};

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function useDebounced(value: string, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function TasksPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const { data, loading, error, params, setParam, setPage, reset, reload, activeFilterCount } = useList<Row>(
    "/api/tasks",
    { q: "", status: "ALL", priority: "ALL", assignee: "ALL", sort: "due" },
  );
  const [incidents, setIncidents] = useState<IncidentOption[]>([]);
  const [assignees, setAssignees] = useState<User[]>([]);
  const [role, setRole] = useState<Role>("VIEWER");
  const [optimistic, setOptimistic] = useState<Record<number, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setParam("q", debounced), [debounced, setParam]);

  const loadOptions = useCallback(() => {
    api<{ incidents: IncidentOption[]; users: User[]; viewer: { role: Role } }>("/api/options")
      .then((r) => {
        setIncidents(r.incidents);
        setAssignees(r.users);
        setRole(r.viewer.role);
      })
      .catch(() => undefined);
  }, []);
  useEffect(loadOptions, [loadOptions]);

  /** Quick status update: optimistic, then verified by the server; rolls back on failure. */
  async function quickStatus(row: Row, status: string) {
    const previous = optimistic[row.id] ?? row.status;
    setOptimistic((o) => ({ ...o, [row.id]: status }));
    try {
      await api(`/api/tasks/${row.id}`, { method: "PATCH", body: { status } });
      toast.success(`${row.key} → ${status.replace("_", " ").toLowerCase()}`);
      reload();
    } catch (err) {
      setOptimistic((o) => ({ ...o, [row.id]: previous }));
      const d = describe(err);
      toast.error("Status change was rolled back", d.title);
      reload();
    } finally {
      setOptimistic((o) => {
        const copy = { ...o };
        delete copy[row.id];
        return copy;
      });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove(`/api/tasks/${pendingDelete.id}`);
      toast.success(`${pendingDelete.key} deleted`);
      setPendingDelete(null);
      reload();
    } catch (err) {
      const d = describe(err);
      toast.error(d.title, d.detail);
    } finally {
      setDeleting(false);
    }
  }

  const canCreate = can(role, "create", "task");
  const canUpdate = can(role, "update", "task");
  const canDelete = can(role, "delete", "task");
  const done = data?.rows.filter((r) => (optimistic[r.id] ?? r.status) === "DONE").length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Response work"
        title="Tasks"
        description="Owned, dated response steps linked to incidents. Status changes are optimistic and roll back loudly if the server refuses."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              onClick={() => {
                setDraft({
                  title: "",
                  description: "",
                  incidentId: incidents[0]?.id ?? null,
                  assigneeId: null,
                  priority: "MEDIUM",
                  status: "TODO",
                  dueDate: null,
                });
                setFormOpen(true);
              }}
            >
              <Plus size={14} /> Create task
            </Button>
          ) : (
            <span className="mono text-[11px] text-[var(--muted-2)]">read-only access</span>
          )
        }
      />

      <Panel bleed>
        <Toolbar
          searchValue={search}
          onSearch={setSearch}
          searchPlaceholder="Search task title or key…"
          resultLabel={data ? `${done}/${data.rows.length} done on page` : "…"}
          right={<ResetButton onReset={() => { setSearch(""); reset(); }} count={activeFilterCount} />}
        >
          <FilterSelect
            label="Filter by status"
            value={params.status}
            onChange={(v) => setParam("status", v)}
            options={[allOption("All statuses"), ...STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))]}
          />
          <FilterSelect
            label="Filter by priority"
            value={params.priority}
            onChange={(v) => setParam("priority", v)}
            options={[allOption("All priorities"), ...PRIORITIES.map((p) => ({ value: p, label: p }))]}
          />
          <FilterSelect
            label="Filter by assignee"
            value={params.assignee}
            onChange={(v) => setParam("assignee", v)}
            options={[allOption("Any assignee"), ...assignees.map((a) => ({ value: String(a.id), label: a.name })), { value: "NONE", label: "Unassigned" }]}
          />
          <FilterSelect
            label="Sort"
            value={params.sort}
            onChange={(v) => setParam("sort", v)}
            options={[
              { value: "due", label: "Sort: due date" },
              { value: "priority", label: "Sort: priority" },
              { value: "status", label: "Sort: status" },
              { value: "created", label: "Sort: newest" },
            ]}
          />
        </Toolbar>

        {loading ? (
          <TableSkeleton rows={9} cols={7} />
        ) : error ? (
          <ErrorState
            title="Tasks could not be loaded"
            body={error.message}
            code={error.code}
            action={<Button variant="outline" onClick={reload}>Try again</Button>}
          />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={18} />}
            title={activeFilterCount ? "No tasks match your filters" : "No tasks yet"}
            body={
              activeFilterCount
                ? "Nothing matches this filter combination."
                : "Break the response into owned steps with a due date so work survives handovers."
            }
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={() => { setSearch(""); reset(); }}>Clear filters</Button>
              ) : canCreate ? (
                <Button variant="primary" onClick={() => setFormOpen(true)}>
                  <Plus size={14} /> Create task
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableShell minWidth={1040}>
              <thead>
                <tr>
                  <th className="w-[3px] border-b border-[var(--border)] bg-[var(--panel-2)] p-0" aria-hidden />
                  <Th>Task</Th>
                  <Th>Title</Th>
                  <Th>Incident</Th>
                  <Th>Assignee</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const status = optimistic[row.id] ?? row.status;
                  const isDone = status === "DONE";
                  const overdue = row.dueDate && !isDone && new Date(row.dueDate) < new Date(new Date().toDateString());
                  return (
                    <tr key={row.id} className={cn("transition-colors hover:bg-[var(--hover)]", isDone && "opacity-70")}>
                      <Spine color={spineFor(status, row.priority === "CRITICAL" ? "CRITICAL" : undefined)} />
                      <Td>
                        <span className="mono text-[12px] text-[var(--muted)]">{row.key}</span>
                      </Td>
                      <Td className="max-w-[320px]">
                        <span className="block truncate font-medium" title={row.title}>
                          {row.title}
                        </span>
                        {row.description ? (
                          <span className="mt-0.5 block truncate text-[11.5px] text-[var(--muted-2)]" title={row.description}>
                            {row.description}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="max-w-[210px]">
                        <Link
                          href={`/incidents/${row.incidentId}`}
                          className="mono block truncate text-[11.5px] text-[var(--accent-2)] underline-offset-4 hover:underline"
                          title={row.incidentTitle}
                        >
                          {row.incidentKey}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {row.assigneeName ?? <span className="text-[var(--muted-2)]">Unassigned</span>}
                      </Td>
                      <Td>
                        <Pill tone={TASK_PRIORITY_TONE[row.priority] ?? "neutral"} dot={false}>
                          {row.priority}
                        </Pill>
                      </Td>
                      <Td>
                        {canUpdate ? (
                          <Select
                            value={status}
                            onChange={(e) => quickStatus(row, e.target.value)}
                            aria-label={`Status for ${row.key}`}
                            className="h-8 min-w-[132px]"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s.replace("_", " ")}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Pill tone={TASK_STATUS_TONE[status] ?? "neutral"} dot={false}>
                            {status.replace("_", " ")}
                          </Pill>
                        )}
                      </Td>
                      <Td className="mono whitespace-nowrap text-[11.5px]">
                        {row.dueDate ? (
                          overdue ? (
                            <span className="inline-flex items-center gap-1" style={{ color: "var(--crit)" }}>
                              {row.dueDate}
                              <span className="sr-only">(overdue)</span>
                              <span aria-hidden className="font-semibold">!</span>
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>{row.dueDate}</span>
                          )
                        ) : (
                          <span className="text-[var(--muted-2)]">—</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && !isDone ? (
                            <button
                              type="button"
                              onClick={() => quickStatus(row, "DONE")}
                              className="mono flex h-7 items-center gap-1 rounded-[3px] border border-[var(--border)] px-2 text-[10.5px] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                              aria-label={`Mark ${row.key} done`}
                            >
                              <Check size={11} /> DONE
                            </button>
                          ) : null}
                          {canUpdate ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDraft({
                                  id: row.id,
                                  key: row.key,
                                  title: row.title,
                                  description: row.description,
                                  incidentId: row.incidentId,
                                  assigneeId: row.assigneeId,
                                  priority: row.priority,
                                  status,
                                  dueDate: row.dueDate,
                                });
                                setFormOpen(true);
                              }}
                              className="rounded-[3px] p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                              aria-label={`Edit ${row.key}`}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => setPendingDelete(row)}
                              className="rounded-[3px] p-1.5 text-[var(--muted)] hover:bg-[color-mix(in_oklab,var(--crit)_16%,transparent)] hover:text-[var(--crit)]"
                              aria-label={`Delete ${row.key}`}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
              <span className="mono text-[11px] text-[var(--muted-2)]">
                {data.rows.filter((r) => r.incidentSeverity === "CRITICAL").length} tied to critical incidents
              </span>
              <PaginationInline page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
            </div>
          </>
        )}
      </Panel>

      <TaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        draft={draft}
        incidents={incidents}
        assignees={assignees}
        onSaved={() => {
          toast.success(draft?.id ? "Task updated" : "Task created");
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title={`Delete ${pendingDelete?.key ?? "task"}?`}
        body={<>This response step will be removed from the incident. This cannot be undone.</>}
      />
    </>
  );
}

function PaginationInline({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        Prev
      </Button>
      <span className="mono text-[11px] text-[var(--muted)]">
        {page} / {pages}
      </span>
      <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        Next
      </Button>
    </div>
  );
}

function TaskForm({
  open,
  onClose,
  draft,
  incidents,
  assignees,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  draft: Draft | null;
  incidents: IncidentOption[];
  assignees: User[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Draft>({
    title: "",
    description: "",
    incidentId: null,
    assigneeId: null,
    priority: "MEDIUM",
    status: "TODO",
    dueDate: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        draft ?? {
          title: "",
          description: "",
          incidentId: incidents[0]?.id ?? null,
          assigneeId: null,
          priority: "MEDIUM",
          status: "TODO",
          dueDate: null,
        },
      );
      setErrors({});
      setErr(null);
    }
  }, [open, draft, incidents]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.title.trim().length < 3) next.title = "Describe the task in a few words";
    if (!form.incidentId) next.incidentId = "Link the task to an incident";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (form.id) await api(`/api/tasks/${form.id}`, { method: "PATCH", body: form });
      else await api("/api/tasks", { method: "POST", body: form });
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
      title={form.id ? `Edit ${form.key}` : "Create task"}
      description="Every task belongs to an incident so response work stays in context."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="task-item-form" loading={busy}>
            {form.id ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form id="task-item-form" onSubmit={submit} noValidate className="space-y-4">
        {err ? <ErrorCallout title={err} /> : null}
        <div>
          <Label htmlFor="t-title">Task title</Label>
          <Input
            id="t-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            invalid={Boolean(errors.title)}
            placeholder="Tune brute-force detection threshold"
          />
          {errors.title ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.title}</p> : null}
        </div>
        <div>
          <Label htmlFor="t-desc">Description</Label>
          <Textarea
            id="t-desc"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Definition of done."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="t-incident">Incident</Label>
            <Select
              id="t-incident"
              value={String(form.incidentId ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, incidentId: Number(e.target.value) }))}
              invalid={Boolean(errors.incidentId)}
            >
              <option value="">Choose an incident…</option>
              {incidents.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.key} — {i.title.slice(0, 55)}
                </option>
              ))}
            </Select>
            {errors.incidentId ? (
              <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">
                {errors.incidentId}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="t-assignee">Assignee</Label>
            <Select
              id="t-assignee"
              value={String(form.assigneeId ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value ? Number(e.target.value) : null }))}
            >
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="t-priority">Priority</Label>
            <Select
              id="t-priority"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="t-status">Status</Label>
            <Select id="t-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="t-due">Due date</Label>
            <Input
              id="t-due"
              type="date"
              value={form.dueDate ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value || null }))}
            />
          </div>
          <div className="flex items-end">
            <p className="mono text-[10.5px] leading-relaxed text-[var(--muted-2)]">
              {form.dueDate ? `due ${fmtRelative(form.dueDate)}` : "no due date set"} · saved after server-side role check
            </p>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
