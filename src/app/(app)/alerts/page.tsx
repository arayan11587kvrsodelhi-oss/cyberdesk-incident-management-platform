"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bell, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { TableShell, Th, Td, Spine, spineFor } from "@/components/data/table";
import { Toolbar, FilterSelect, ResetButton, allOption } from "@/components/data/toolbar";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Pill, SEVERITY_TONE, ALERT_STATUS_TONE } from "@/components/ui/badge";
import { ErrorCallout, useToast } from "@/components/ui/toast";
import { useList } from "@/components/data/use-list";
import { describe, remove } from "@/components/data/mutations";
import { api, ApiClientError } from "@/lib/client";
import { fmtDateTime, fmtRelative } from "@/lib/utils";
import { can, type Role } from "@/lib/permissions";

type Row = {
  id: number;
  key: string;
  title: string;
  source: string;
  severity: string;
  status: string;
  detail: string;
  detectedAt: string;
  incidentId: number | null;
  incidentKey: string | null;
  incidentTitle: string | null;
};

type IncidentOption = { id: number; key: string; title: string };

const SOURCES = ["EDR", "NETWORK", "IDENTITY", "CLOUD", "EMAIL", "MANUAL"];
const STATUSES = ["NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED"];
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function useDebounced(value: string, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

type Draft = {
  id?: number;
  key?: string;
  title: string;
  detail: string;
  source: string;
  severity: string;
  status: string;
  incidentId: number | null;
};

export default function AlertsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const { data, loading, error, params, setParam, setPage, reset, reload, activeFilterCount } = useList<Row>(
    "/api/alerts",
    { q: "", severity: "ALL", status: "ALL", source: "ALL" },
  );
  const [incidents, setIncidents] = useState<IncidentOption[]>([]);
  const [role, setRole] = useState<Role>("VIEWER");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ackInFlight, setAckInFlight] = useState<number | null>(null);

  useEffect(() => setParam("q", debounced), [debounced, setParam]);

  const loadOptions = useCallback(() => {
    api<{ incidents: IncidentOption[]; viewer: { role: Role } }>("/api/options")
      .then((r) => {
        setIncidents(r.incidents);
        setRole(r.viewer.role);
      })
      .catch(() => undefined);
  }, []);
  useEffect(loadOptions, [loadOptions]);

  /** Acknowledge: server-verified PATCH, then refresh from the source of truth. */
  async function acknowledge(row: Row) {
    setAckInFlight(row.id);
    try {
      await api(`/api/alerts/${row.id}`, { method: "PATCH", body: { status: "ACKNOWLEDGED" } });
      toast.success(`${row.key} acknowledged`, "Recorded in the activity log.");
      reload();
    } catch (err) {
      const d = describe(err);
      toast.error("Acknowledgement failed", d.title);
      reload();
    } finally {
      setAckInFlight(null);
    }
  }

  async function openEdit(row: Row) {
    setDraft({
      id: row.id,
      key: row.key,
      title: row.title,
      detail: row.detail,
      source: row.source,
      severity: row.severity,
      status: row.status,
      incidentId: row.incidentId,
    });
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove(`/api/alerts/${pendingDelete.id}`);
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

  const canMutate = can(role, "update", "alert");
  const canCreate = can(role, "create", "alert");
  const canDelete = can(role, "delete", "alert");

  return (
    <>
      <PageHeader
        eyebrow="Detection queue"
        title="Alerts"
        description="Signals from simulated detection sources. Acknowledging, linking and resolving are optimistic where safe and always authorised on the server."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              onClick={() => {
                setDraft({ title: "", detail: "", source: "EDR", severity: "MEDIUM", status: "NEW", incidentId: null });
                setFormOpen(true);
              }}
            >
              <Plus size={14} /> Record alert
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
          searchPlaceholder="Search alert title, key or detail…"
          resultLabel={data ? `${data.total} alerts` : "…"}
          right={<ResetButton onReset={() => { setSearch(""); reset(); }} count={activeFilterCount} />}
        >
          <FilterSelect
            label="Filter by severity"
            value={params.severity}
            onChange={(v) => setParam("severity", v)}
            options={[allOption("All severities"), ...SEVERITIES.map((s) => ({ value: s, label: s }))]}
          />
          <FilterSelect
            label="Filter by status"
            value={params.status}
            onChange={(v) => setParam("status", v)}
            options={[allOption("All statuses"), ...STATUSES.map((s) => ({ value: s, label: s }))]}
          />
          <FilterSelect
            label="Filter by source"
            value={params.source}
            onChange={(v) => setParam("source", v)}
            options={[allOption("All sources"), ...SOURCES.map((s) => ({ value: s, label: s }))]}
          />
        </Toolbar>

        {loading ? (
          <TableSkeleton rows={9} cols={7} />
        ) : error ? (
          <ErrorState
            title="Alerts could not be loaded"
            body={error.message}
            code={error.code}
            action={<Button variant="outline" onClick={reload}>Try again</Button>}
          />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={<Bell size={18} />}
            title={activeFilterCount ? "No alerts match your filters" : "No alerts recorded"}
            body={
              activeFilterCount
                ? "No detection records match this combination. Clear the filters to see the full queue."
                : "Nothing has been raised against the demo estate. Record an alert to start triaging."
            }
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={() => { setSearch(""); reset(); }}>Clear filters</Button>
              ) : canCreate ? (
                <Button variant="primary" onClick={() => setFormOpen(true)}>
                  <Plus size={14} /> Record alert
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableShell minWidth={1020}>
              <thead>
                <tr>
                  <th className="w-[3px] border-b border-[var(--border)] bg-[var(--panel-2)] p-0" aria-hidden />
                  <Th>Alert ID</Th>
                  <Th>Title</Th>
                  <Th>Source</Th>
                  <Th>Severity</Th>
                  <Th>Status</Th>
                  <Th>Detected</Th>
                  <Th>Incident</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-[var(--hover)]">
                    <Spine color={spineFor(row.severity, row.status)} />
                    <Td>
                      <span className="mono text-[12px] text-[var(--muted)]">{row.key}</span>
                    </Td>
                    <Td className="max-w-[340px]">
                      <span className="block truncate font-medium" title={row.title}>
                        {row.title}
                      </span>
                      {row.detail ? (
                        <span className="mt-0.5 block truncate text-[11.5px] text-[var(--muted-2)]" title={row.detail}>
                          {row.detail}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Pill tone="neutral" dot={false}>
                        {row.source}
                      </Pill>
                    </Td>
                    <Td>
                      <Pill tone={SEVERITY_TONE[row.severity] ?? "neutral"}>{row.severity}</Pill>
                    </Td>
                    <Td>
                      <Pill tone={ALERT_STATUS_TONE[row.status] ?? "neutral"}>
                        {row.status.replace("_", " ")}
                      </Pill>
                    </Td>
                    <Td className="mono whitespace-nowrap text-[11.5px] text-[var(--muted)]">
                      {fmtDateTime(row.detectedAt)}
                    </Td>
                    <Td className="max-w-[200px]">
                      {row.incidentId ? (
                        <Link
                          href={`/incidents/${row.incidentId}`}
                          className="mono block truncate text-[11.5px] text-[var(--accent-2)] underline-offset-4 hover:underline"
                          title={row.incidentTitle ?? ""}
                        >
                          {row.incidentKey}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted-2)]">unlinked</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {canMutate && row.status === "NEW" ? (
                          <button
                            type="button"
                            onClick={() => acknowledge(row)}
                            disabled={ackInFlight === row.id}
                            className="mono flex h-7 items-center gap-1 rounded-[3px] border border-[var(--border)] px-2 text-[10.5px] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
                            aria-label={`Acknowledge ${row.key}`}
                          >
                            <Check size={11} /> ACK
                          </button>
                        ) : null}
                        {canMutate ? (
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
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
                ))}
              </tbody>
            </TableShell>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} label="alerts" />
          </>
        )}
      </Panel>

      <AlertForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        draft={draft}
        incidents={incidents}
        onSaved={() => {
          toast.success(draft?.id ? "Alert updated" : "Alert recorded");
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title={`Delete ${pendingDelete?.key ?? "alert"}?`}
        body={<>This detection record will be removed from the queue. This cannot be undone.</>}
      />
    </>
  );
}

function AlertForm({
  open,
  onClose,
  draft,
  incidents,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  draft: Draft | null;
  incidents: IncidentOption[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Draft>({ title: "", detail: "", source: "EDR", severity: "MEDIUM", status: "NEW", incidentId: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(draft ?? { title: "", detail: "", source: "EDR", severity: "MEDIUM", status: "NEW", incidentId: null });
      setErrors({});
      setErr(null);
    }
  }, [open, draft]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.title.trim().length < 3) next.title = "Title must be at least 3 characters";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (form.id) {
        await api(`/api/alerts/${form.id}`, { method: "PATCH", body: form });
      } else {
        await api("/api/alerts", { method: "POST", body: form });
      }
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
      title={form.id ? `Edit ${form.key}` : "Record alert"}
      description="Simulated detection record — this workspace contains no real telemetry."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="alert-form" loading={busy}>
            {form.id ? "Save changes" : "Record alert"}
          </Button>
        </>
      }
    >
      <form id="alert-form" onSubmit={submit} noValidate className="space-y-4">
        {err ? <ErrorCallout title={err} /> : null}
        <div>
          <Label htmlFor="a-title">Title</Label>
          <Input
            id="a-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            invalid={Boolean(errors.title)}
            placeholder="Brute-force pattern detected on identity endpoint"
          />
          {errors.title ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.title}</p> : null}
        </div>
        <div>
          <Label htmlFor="a-detail">Detail</Label>
          <Textarea
            id="a-detail"
            value={form.detail}
            onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
            placeholder="What the simulated rule observed."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="a-source">Source</Label>
            <Select id="a-source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="a-sev">Severity</Label>
            <Select
              id="a-sev"
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="a-status">Status</Label>
            <Select
              id="a-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="a-incident">Associated incident</Label>
          <Select
            id="a-incident"
            value={String(form.incidentId ?? "")}
            onChange={(e) => setForm((f) => ({ ...f, incidentId: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">Not linked</option>
            {incidents.map((i) => (
              <option key={i.id} value={i.id}>
                {i.key} — {i.title.slice(0, 60)}
              </option>
            ))}
          </Select>
        </div>
        <p className="mono text-[10.5px] text-[var(--muted-2)]">
          detected {fmtRelative(new Date().toISOString())} · saved server-side after role check
        </p>
      </form>
    </Dialog>
  );
}
