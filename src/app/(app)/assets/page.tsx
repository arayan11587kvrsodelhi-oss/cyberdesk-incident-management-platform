"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { HardDrive, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { TableShell, Th, Td, Spine, spineFor } from "@/components/data/table";
import { Toolbar, FilterSelect, ResetButton, allOption } from "@/components/data/toolbar";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { Pill, ASSET_STATUS_TONE } from "@/components/ui/badge";
import { ErrorCallout, useToast } from "@/components/ui/toast";
import { useList } from "@/components/data/use-list";
import { describe, remove } from "@/components/data/mutations";
import { api, ApiClientError } from "@/lib/client";
import { fmtDateTime, fmtRelative } from "@/lib/utils";
import { can, type Role } from "@/lib/permissions";

type Row = {
  id: number;
  key: string;
  name: string;
  type: string;
  ipAddress: string | null;
  environment: string;
  status: string;
  lastSeen: string | null;
  ownerId: number | null;
  ownerName: string | null;
};

type Owner = { id: number; name: string };
type Draft = {
  id?: number;
  key?: string;
  name: string;
  type: string;
  ipAddress: string;
  environment: string;
  status: string;
  ownerId: number | null;
};

const TYPES = ["SERVER", "LAPTOP", "DATABASE", "API", "CLOUD", "CONTAINER"];
const ENVS = ["PRODUCTION", "STAGING", "DEVELOPMENT"];
const STATUSES = ["HEALTHY", "WARNING", "CRITICAL", "OFFLINE"];

function useDebounced(value: string, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function AssetsPage() {
  return (
    <Suspense fallback={null}>
      <AssetsPageInner />
    </Suspense>
  );
}

function AssetsPageInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const { data, loading, error, params, setParam, setPage, reset, reload, activeFilterCount } = useList<Row>(
    "/api/assets",
    { q: "", type: "ALL", environment: "ALL", status: "ALL" },
  );
  const [owners, setOwners] = useState<Owner[]>([]);
  const [role, setRole] = useState<Role>("VIEWER");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Deep link: /assets?edit=<id> opens the edit dialog for that record directly.
  const editParam = Number(searchParams.get("edit") ?? "0") || 0;
  useEffect(() => {
    if (!editParam) return;
    let cancelled = false;
    api<{ asset: Row }>(`/api/assets/${editParam}`)
      .then((res) => {
        if (cancelled) return;
        const a = res.asset;
        setDraft({
          id: a.id,
          key: a.key,
          name: a.name,
          type: a.type,
          ipAddress: a.ipAddress ?? "",
          environment: a.environment,
          status: a.status,
          ownerId: a.ownerId ?? null,
        });
        setFormOpen(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [editParam]);

  useEffect(() => setParam("q", debounced), [debounced, setParam]);

  const loadOptions = useCallback(() => {
    api<{ users: Owner[]; viewer: { role: Role } }>("/api/options")
      .then((r) => {
        setOwners(r.users);
        setRole(r.viewer.role);
      })
      .catch(() => undefined);
  }, []);
  useEffect(loadOptions, [loadOptions]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove(`/api/assets/${pendingDelete.id}`);
      toast.success(`${pendingDelete.key} removed`, "Links to incidents were cleared.");
      setPendingDelete(null);
      reload();
    } catch (err) {
      const d = describe(err);
      toast.error(d.title, d.detail);
    } finally {
      setDeleting(false);
    }
  }

  const canCreate = can(role, "create", "asset");
  const canUpdate = can(role, "update", "asset");
  const canDelete = can(role, "delete", "asset");

  return (
    <>
      <PageHeader
        eyebrow="Asset inventory"
        title="Assets"
        description="Fictional monitored estate across servers, laptops, databases, APIs, cloud resources and containers."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              onClick={() => {
                setDraft({ name: "", type: "SERVER", ipAddress: "", environment: "PRODUCTION", status: "HEALTHY", ownerId: null });
                setFormOpen(true);
              }}
            >
              <Plus size={14} /> Create asset
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
          searchPlaceholder="Search name, key or address…"
          resultLabel={data ? `${data.total} assets` : "…"}
          right={<ResetButton onReset={() => { setSearch(""); reset(); }} count={activeFilterCount} />}
        >
          <FilterSelect
            label="Filter by type"
            value={params.type}
            onChange={(v) => setParam("type", v)}
            options={[allOption("All types"), ...TYPES.map((t) => ({ value: t, label: t }))]}
          />
          <FilterSelect
            label="Filter by environment"
            value={params.environment}
            onChange={(v) => setParam("environment", v)}
            options={[allOption("All environments"), ...ENVS.map((e) => ({ value: e, label: e }))]}
          />
          <FilterSelect
            label="Filter by status"
            value={params.status}
            onChange={(v) => setParam("status", v)}
            options={[allOption("All statuses"), ...STATUSES.map((s) => ({ value: s, label: s }))]}
          />
        </Toolbar>

        {loading ? (
          <TableSkeleton rows={9} cols={7} />
        ) : error ? (
          <ErrorState
            title="Assets could not be loaded"
            body={error.message}
            code={error.code}
            action={<Button variant="outline" onClick={reload}>Try again</Button>}
          />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={<HardDrive size={18} />}
            title={activeFilterCount ? "No assets match your filters" : "No assets have been added"}
            body={
              activeFilterCount
                ? "Nothing in the inventory matches these filters."
                : "Add the systems you want incidents, alerts and tasks to reference."
            }
            action={
              activeFilterCount ? (
                <Button variant="outline" onClick={() => { setSearch(""); reset(); }}>Clear filters</Button>
              ) : canCreate ? (
                <Button variant="primary" onClick={() => setFormOpen(true)}>
                  <Plus size={14} /> Create asset
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableShell minWidth={980}>
              <thead>
                <tr>
                  <th className="w-[3px] border-b border-[var(--border)] bg-[var(--panel-2)] p-0" aria-hidden />
                  <Th>Asset ID</Th>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>IP / Address</Th>
                  <Th>Environment</Th>
                  <Th>Status</Th>
                  <Th>Owner</Th>
                  <Th>Last seen</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-[var(--hover)]">
                    <Spine color={spineFor(row.status)} />
                    <Td>
                      <span className="mono text-[12px] text-[var(--muted)]">{row.key}</span>
                    </Td>
                    <Td className="max-w-[260px]">
                      <Link
                        href={`/assets/${row.id}`}
                        className="block truncate font-medium underline-offset-4 hover:underline"
                        title={row.name}
                      >
                        {row.name}
                      </Link>
                    </Td>
                    <Td>
                      <Pill tone="neutral" dot={false}>
                        {row.type}
                      </Pill>
                    </Td>
                    <Td className="mono whitespace-nowrap text-[11.5px] text-[var(--muted)]">
                      {row.ipAddress ?? "—"}
                    </Td>
                    <Td className="mono text-[11.5px] text-[var(--muted)]">{row.environment}</Td>
                    <Td>
                      <Pill tone={ASSET_STATUS_TONE[row.status] ?? "neutral"}>{row.status}</Pill>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {row.ownerName ?? <span className="text-[var(--muted-2)]">—</span>}
                    </Td>
                    <Td className="mono whitespace-nowrap text-[11.5px] text-[var(--muted)]">
                      {row.lastSeen ? fmtRelative(row.lastSeen) : "—"}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/assets/${row.id}`}
                          className="mono rounded-[3px] px-1.5 py-1 text-[10.5px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                          aria-label={`View ${row.key}`}
                        >
                          VIEW
                        </Link>
                        {canUpdate ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDraft({
                                id: row.id,
                                key: row.key,
                                name: row.name,
                                type: row.type,
                                ipAddress: row.ipAddress ?? "",
                                  environment: row.environment,
                                  status: row.status,
                                  ownerId: row.ownerId,
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
                ))}
              </tbody>
            </TableShell>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} label="assets" />
          </>
        )}
      </Panel>

      <AssetForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        draft={draft}
        owners={owners}
        onSaved={() => {
          toast.success(draft?.id ? "Asset updated" : "Asset created");
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title={`Delete ${pendingDelete?.key ?? "asset"}?`}
        body={
          <>
            <span className="text-[var(--text)]">{pendingDelete?.name}</span> will be removed from the inventory and
            unlinked from any incidents. This cannot be undone.
          </>
        }
      />
    </>
  );
}

function AssetForm({
  open,
  onClose,
  draft,
  owners,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  draft: Draft | null;
  owners: Owner[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Draft>({
    name: "",
    type: "SERVER",
    ipAddress: "",
    environment: "PRODUCTION",
    status: "HEALTHY",
    ownerId: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        draft ?? { name: "", type: "SERVER", ipAddress: "", environment: "PRODUCTION", status: "HEALTHY", ownerId: null },
      );
      setErrors({});
      setErr(null);
    }
  }, [open, draft]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 3) next.name = "Name must be at least 3 characters";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      if (form.id) await api(`/api/assets/${form.id}`, { method: "PATCH", body: form });
      else await api("/api/assets", { method: "POST", body: form });
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
      title={form.id ? `Edit ${form.key}` : "Create asset"}
      description="Inventory entries are fictional demo records stored in PostgreSQL."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="asset-form" loading={busy}>
            {form.id ? "Save changes" : "Create asset"}
          </Button>
        </>
      }
    >
      <form id="asset-form" onSubmit={submit} noValidate className="space-y-4">
        {err ? <ErrorCallout title={err} /> : null}
        <div>
          <Label htmlFor="as-name">Name</Label>
          <Input
            id="as-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            invalid={Boolean(errors.name)}
            placeholder="nws-edge-gw-03"
          />
          {errors.name ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">{errors.name}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="as-type">Type</Label>
            <Select id="as-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="as-ip" hint="optional">
              IP address / endpoint
            </Label>
            <Input
              id="as-ip"
              value={form.ipAddress}
              onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))}
              invalid={Boolean(errors.ipAddress)}
              placeholder="10.42.0.15"
            />
            {errors.ipAddress ? (
              <p role="alert" className="mt-1.5 text-[12px] text-[var(--crit)]">
                {errors.ipAddress}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="as-env">Environment</Label>
            <Select
              id="as-env"
              value={form.environment}
              onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
            >
              {ENVS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="as-status">Status</Label>
            <Select
              id="as-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="as-owner">Owner</Label>
          <Select
            id="as-owner"
            value={String(form.ownerId ?? "")}
            onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">Unassigned</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
        {form.id ? (
          <p className="mono text-[10.5px] text-[var(--muted-2)]">last seen {fmtDateTime(new Date())} · refreshed on save</p>
        ) : null}
      </form>
    </Dialog>
  );
}
