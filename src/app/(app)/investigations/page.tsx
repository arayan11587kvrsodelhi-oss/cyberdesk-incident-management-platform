"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link2, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Toolbar, FilterSelect, ResetButton, allOption } from "@/components/data/toolbar";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Pill, SEVERITY_TONE } from "@/components/ui/badge";
import { ErrorCallout, useToast } from "@/components/ui/toast";
import { useList } from "@/components/data/use-list";
import { describe, remove } from "@/components/data/mutations";
import { api, ApiClientError } from "@/lib/client";
import { fmtDateTime } from "@/lib/utils";
import { can, type Role } from "@/lib/permissions";

type Row = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  incidentId: number;
  incidentKey: string;
  incidentTitle: string;
  authorId: number;
  authorName: string;
};

type IncidentOption = { id: number; key: string; title: string };
type Draft = { id?: number; title: string; body: string; incidentId: number | null };

function useDebounced(value: string, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function InvestigationsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const { data, loading, error, params, setParam, setPage, reset, reload, activeFilterCount } = useList<Row>(
    "/api/notes",
    { q: "", incident: "ALL", author: "ALL" },
  );
  const [incidents, setIncidents] = useState<IncidentOption[]>([]);
  const [authors, setAuthors] = useState<{ id: number; name: string }[]>([]);
  const [role, setRole] = useState<Role>("VIEWER");
  const [viewerId, setViewerId] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setParam("q", debounced), [debounced, setParam]);

  const loadOptions = useCallback(() => {
    api<{ incidents: IncidentOption[]; users: { id: number; name: string }[]; viewer: { role: Role; id: number } }>(
      "/api/options",
    )
      .then((r) => {
        setIncidents(r.incidents);
        setAuthors(r.users);
        setRole(r.viewer.role);
        setViewerId(r.viewer.id);
      })
      .catch(() => undefined);
  }, []);
  useEffect(loadOptions, [loadOptions]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove(`/api/notes/${pendingDelete.id}`);
      toast.success("Note deleted");
      setPendingDelete(null);
      reload();
    } catch (err) {
      const d = describe(err);
      toast.error(d.title, d.detail);
    } finally {
      setDeleting(false);
    }
  }

  const canCreate = can(role, "create", "note");
  const canDelete = can(role, "delete", "note");

  return (
    <>
      <PageHeader
        eyebrow="Investigation log"
        title="Investigations"
        description="A chronological, attributable log of what analysts checked and found, each entry attached to an incident."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              onClick={() => {
                setDraft({ title: "", body: "", incidentId: incidents[0]?.id ?? null });
                setFormOpen(true);
              }}
            >
              <Plus size={14} /> New note
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
          searchPlaceholder="Search note title or text…"
          resultLabel={data ? `${data.total} notes` : "…"}
          right={<ResetButton onReset={() => { setSearch(""); reset(); }} count={activeFilterCount} />}
        >
          <FilterSelect
            label="Filter by incident"
            value={params.incident}
            onChange={(v) => setParam("incident", v)}
            options={[allOption("All incidents"), ...incidents.map((i) => ({ value: String(i.id), label: `${i.key} — ${i.title.slice(0, 34)}` }))]}
          />
          <FilterSelect
            label="Filter by author"
            value={params.author}
            onChange={(v) => setParam("author", v)}
            options={[allOption("Any author"), ...authors.map((a) => ({ value: String(a.id), label: a.name }))]}
          />
        </Toolbar>

        {loading ? (
          <div className="divide-y divide-[var(--border)]">
            <TableSkeleton rows={6} cols={3} />
          </div>
        ) : error ? (
          <ErrorState
            title="Investigation notes could not be loaded"
            body={error.message}
            code={error.code}
            action={<Button variant="outline" onClick={reload}>Try again</Button>}
          />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={<NotebookPen size={18} />}
            title={activeFilterCount ? "No notes match your filters" : "No investigation notes yet"}
            body={
              activeFilterCount
                ? "Nothing in the log matches these filters. Try a different incident or author."
                : "Start the log with your first observation — scope, evidence, and what you plan to check next."
            }
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={() => { setSearch(""); reset(); }}>Clear filters</Button>
              ) : canCreate ? (
                <Button variant="primary" onClick={() => setFormOpen(true)}>
                  <Plus size={14} /> Write first note
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ol className="divide-y divide-[var(--border)]">
              {data.rows.map((row) => {
                const expandedRow = expanded === row.id;
                const text = expandedRow || row.body.length <= 320 ? row.body : `${row.body.slice(0, 320)}…`;
                return (
                  <li key={row.id} className="px-4 py-4 transition-colors hover:bg-[var(--hover)]">
                    <article>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-medium leading-snug">{row.title}</h3>
                            <Pill tone="info" dot={false}>
                              {row.incidentKey}
                            </Pill>
                          </div>
                          <p className="mono mt-1 text-[11px] text-[var(--muted-2)]">
                            {row.authorName} · {fmtDateTime(row.createdAt)}
                            {row.updatedAt !== row.createdAt ? " · edited" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {row.body.length > 320 ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpanded(expandedRow ? null : row.id)}
                              aria-expanded={expandedRow}
                            >
                              {expandedRow ? "Collapse" : "Read full"}
                            </Button>
                          ) : null}
                          {canCreate ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDraft({ id: row.id, title: row.title, body: row.body, incidentId: row.incidentId });
                                setFormOpen(true);
                              }}
                              className="rounded-[3px] p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                              aria-label={`Edit note ${row.title}`}
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
                              aria-label={`Delete note ${row.title}`}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2.5 max-w-[86ch] whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--muted)]">
                        {text}
                      </p>
                      <a
                        href={`/incidents/${row.incidentId}`}
                        className="mono mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-[var(--accent-2)] underline-offset-4 hover:underline"
                      >
                        <Link2 size={11} /> {row.incidentTitle.slice(0, 70)}
                      </a>
                    </article>
                  </li>
                );
              })}
            </ol>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} label="notes" />
          </>
        )}
      </Panel>

      <NoteForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        draft={draft}
        incidents={incidents}
        defaultAuthor={viewerId}
        onSaved={() => {
          toast.success(draft?.id ? "Note updated" : "Note added to the log");
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title="Delete this note?"
        body={
          <>
            <span className="text-[var(--text)]">{pendingDelete?.title}</span> will be removed from the
            investigation log. This cannot be undone.
          </>
        }
      />
    </>
  );
}

function NoteForm({
  open,
  onClose,
  draft,
  incidents,
  defaultAuthor,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  draft: Draft | null;
  incidents: IncidentOption[];
  defaultAuthor: number;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Draft>({ title: "", body: "", incidentId: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(draft ?? { title: "", body: "", incidentId: incidents[0]?.id ?? null });
      setErrors({});
      setErr(null);
    }
  }, [open, draft, incidents]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.title.trim().length < 3) next.title = "Give the note a title";
    if (!form.body.trim()) next.body = "Write the note";
    if (!form.incidentId) next.incidentId = "Choose an incident";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (form.id) await api(`/api/notes/${form.id}`, { method: "PATCH", body: form });
      else await api("/api/notes", { method: "POST", body: form });
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
      title={form.id ? "Edit investigation note" : "New investigation note"}
      description={`Author: your signed-in account${defaultAuthor ? ` (#${defaultAuthor})` : ""}. Notes are immutable in the activity log once created.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="note-form" loading={busy}>
            {form.id ? "Save changes" : "Add note"}
          </Button>
        </>
      }
    >
      <form id="note-form" onSubmit={submit} noValidate className="space-y-4">
        {err ? <ErrorCallout title={err} /> : null}
        <div>
          <Label htmlFor="n-title">Title</Label>
          <Input
            id="n-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            invalid={Boolean(errors.title)}
            placeholder="Source address clustering"
          />
          {errors.title ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.title}</p> : null}
        </div>
        <div>
          <Label htmlFor="n-incident">Incident</Label>
          <Select
            id="n-incident"
            value={String(form.incidentId ?? "")}
            onChange={(e) => setForm((f) => ({ ...f, incidentId: Number(e.target.value) }))}
            invalid={Boolean(errors.incidentId)}
          >
            <option value="">Choose an incident…</option>
            {incidents.map((i) => (
              <option key={i.id} value={i.id}>
                {i.key} — {i.title.slice(0, 60)}
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
          <Label htmlFor="n-body" hint={`${form.body.length} chars`}>
            Note
          </Label>
          <Textarea
            id="n-body"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            invalid={Boolean(errors.body)}
            className="min-h-[160px]"
            placeholder="What you checked, what you found, and what happens next."
          />
          {errors.body ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.body}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}
