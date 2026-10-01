"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2, ShieldAlert } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { TableShell, Th, Td, Spine, spineFor } from "@/components/data/table";
import { Toolbar, FilterSelect, ResetButton, allOption } from "@/components/data/toolbar";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Pill, SEVERITY_TONE, INCIDENT_STATUS_TONE, Tag } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useList } from "@/components/data/use-list";
import { describe, remove } from "@/components/data/mutations";
import { api } from "@/lib/client";
import { fmtDateTime, fmtRelative } from "@/lib/utils";
import { IncidentForm, type IncidentDraft, type AssetOption, type Option } from "@/components/incidents/incident-form";
import { can, type Role } from "@/lib/permissions";

type Row = {
  id: number;
  key: string;
  title: string;
  severity: string;
  status: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
  assigneeId: number | null;
  assigneeName: string | null;
  assets: string[];
};

function useDebounced(value: string, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function IncidentsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const { data, loading, error, params, setParam, setPage, reset, reload, activeFilterCount } = useList<Row>(
    "/api/incidents",
    { q: "", severity: "ALL", status: "ALL", assignee: "ALL", sort: "updated" },
  );
  const [members, setMembers] = useState<Option[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [role, setRole] = useState<Role>("VIEWER");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IncidentDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setParam("q", debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const loadOptions = useCallback(() => {
    api<{ users: Option[]; assets: AssetOption[]; viewer: { role: Role } }>("/api/options")
      .then((res) => {
        setMembers(res.users);
        setAssets(res.assets);
        setRole(res.viewer.role);
      })
      .catch(() => undefined);
  }, []);

  useEffect(loadOptions, [loadOptions]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  async function openEdit(row: Row) {
    try {
      const res = await api<{ incident: Row & { description: string }; assetIds: number[] }>(
        `/api/incidents/${row.id}`,
      );
      setEditing({
        id: row.id,
        key: row.key,
        title: res.incident.title,
        description: res.incident.description,
        severity: row.severity,
        status: row.status,
        assigneeId: row.assigneeId,
        tags: row.tags,
        assetIds: res.assetIds,
      });
      setFormOpen(true);
    } catch (err) {
      const d = describe(err);
      toast.error(d.title, d.detail);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove(`/api/incidents/${pendingDelete.id}`);
      toast.success(`${pendingDelete.key} deleted`, "Linked alerts, notes and tasks were removed with it.");
      setPendingDelete(null);
      reload();
    } catch (err) {
      const d = describe(err);
      toast.error(d.title, d.detail);
    } finally {
      setDeleting(false);
    }
  }

  const canCreate = can(role, "create", "incident");
  const canDelete = can(role, "delete", "incident");

  return (
    <>
      <PageHeader
        eyebrow="Incident ledger"
        title="Incidents"
        description="Every record below is a row in PostgreSQL with severity, ownership, affected assets and a full activity trail."
        actions={
          canCreate ? (
            <Button variant="primary" onClick={openCreate}>
              <Plus size={14} />
              Create incident
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
          searchPlaceholder="Search title, key or tag…"
          resultLabel={data ? `${data.total} records` : "…"}
          right={<ResetButton onReset={() => { setSearch(""); reset(); }} count={activeFilterCount} />}
        >
          <FilterSelect
            label="Filter by severity"
            value={params.severity}
            onChange={(v) => setParam("severity", v)}
            options={[allOption("All severities"), ...["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => ({ value: s, label: s }))]}
          />
          <FilterSelect
            label="Filter by status"
            value={params.status}
            onChange={(v) => setParam("status", v)}
            options={[allOption("All statuses"), ...["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"].map((s) => ({ value: s, label: s.replace("_", " ") }))]}
          />
          <FilterSelect
            label="Filter by assignee"
            value={params.assignee}
            onChange={(v) => setParam("assignee", v)}
            options={[allOption("Any assignee"), ...members.map((m) => ({ value: String(m.id), label: m.name })), { value: "NONE", label: "Unassigned" }]}
          />
          <FilterSelect
            label="Sort"
            value={params.sort}
            onChange={(v) => setParam("sort", v)}
            options={[
              { value: "updated", label: "Sort: recently updated" },
              { value: "created", label: "Sort: newest first" },
              { value: "severity", label: "Sort: severity" },
            ]}
          />
        </Toolbar>

        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <ErrorState
            title="Incidents could not be loaded"
            body={error.message}
            code={error.code}
            action={
              <Button variant="outline" onClick={reload}>
                Try again
              </Button>
            }
          />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert size={18} />}
            title={activeFilterCount ? "No incidents match your filters" : "No open incidents"}
            body={
              activeFilterCount
                ? "Nothing in the ledger matches this combination of search text and filters. Widen the filters to see more."
                : "The demo ledger is empty. Create the first incident to start a timeline, attach assets and assign an analyst."
            }
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={() => { setSearch(""); reset(); }}>
                  Clear filters
                </Button>
              ) : canCreate ? (
                <Button variant="primary" onClick={openCreate}>
                  <Plus size={14} />
                  Create incident
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableShell minWidth={980}>
              <thead>
                <tr>
                  <SpineHeader />
                  <Th scope="col">ID</Th>
                  <Th scope="col">Title</Th>
                  <Th scope="col">Severity</Th>
                  <Th scope="col">Status</Th>
                  <Th scope="col">Assigned to</Th>
                  <Th scope="col">Asset</Th>
                  <Th scope="col">Created</Th>
                  <Th scope="col">Updated</Th>
                  <Th scope="col" className="text-right">
                    Actions
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className="group transition-colors hover:bg-[var(--hover)]"
                    style={{ animation: `fade-in 260ms ease both`, animationDelay: `${i * 18}ms` }}
                  >
                    <Spine color={spineFor(row.severity, row.status)} />
                    <Td>
                      <span className="mono text-[12px] text-[var(--muted)]">{row.key}</span>
                    </Td>
                    <Td className="max-w-[340px]">
                      <Link
                        href={`/incidents/${row.id}`}
                        className="block truncate font-medium underline-offset-4 hover:underline"
                        title={row.title}
                      >
                        {row.title}
                      </Link>
                      {row.tags ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {row.tags.split(",").slice(0, 3).map((t) => (
                            <Tag key={t}>{t.trim()}</Tag>
                          ))}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Pill tone={SEVERITY_TONE[row.severity] ?? "neutral"}>{row.severity}</Pill>
                    </Td>
                    <Td>
                      <Pill tone={INCIDENT_STATUS_TONE[row.status] ?? "neutral"}>{row.status.replace("_", " ")}</Pill>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {row.assigneeName ?? <span className="text-[var(--muted-2)]">Unassigned</span>}
                    </Td>
                    <Td className="max-w-[180px]">
                      {row.assets.length ? (
                        <span className="mono block truncate text-[11.5px] text-[var(--muted)]" title={row.assets.join(", ")}>
                          {row.assets[0]}
                          {row.assets.length > 1 ? ` +${row.assets.length - 1}` : ""}
                        </span>
                      ) : (
                        <span className="text-[var(--muted-2)]">—</span>
                      )}
                    </Td>
                    <Td className="mono whitespace-nowrap text-[11.5px] text-[var(--muted)]">{fmtDateTime(row.createdAt)}</Td>
                    <Td className="mono whitespace-nowrap text-[11.5px] text-[var(--muted)]">{fmtRelative(row.updatedAt)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/incidents/${row.id}`}
                          className="rounded-[3px] p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
                          aria-label={`View ${row.key}`}
                          title="View"
                        >
                          <Eye size={14} />
                        </Link>
                        {can(role, "update", "incident") ? (
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="rounded-[3px] p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
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
                            className="rounded-[3px] p-1.5 text-[var(--muted)] transition-colors hover:bg-[color-mix(in_oklab,var(--crit)_16%,transparent)] hover:text-[var(--crit)]"
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
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} label="incidents" />
          </>
        )}
      </Panel>

      <IncidentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        options={{ users: members, assets }}
        onSaved={() => {
          toast.success(editing ? "Incident updated" : "Incident created", "The ledger and activity log are up to date.");
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title={`Delete ${pendingDelete?.key ?? "incident"}?`}
        body={
          <>
            <span className="text-[var(--text)]">{pendingDelete?.title}</span> will be removed along with its
            investigation notes, tasks and asset links. Alert associations are kept but cleared. This cannot be undone.
          </>
        }
      />
    </>
  );
}

function SpineHeader() {
  return <th className="w-[3px] border-b border-[var(--border)] bg-[var(--panel-2)] p-0" aria-hidden />;
}
