"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Select, Textarea, Input } from "@/components/ui/field";
import { ErrorCallout } from "@/components/ui/toast";
import { ApiClientError, api } from "@/lib/client";

export type Option = { id: number; name: string };
export type AssetOption = { id: number; key: string; name: string };

export type IncidentDraft = {
  id?: number;
  key?: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  assigneeId: number | null;
  tags: string;
  assetIds?: number[];
};

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"];

export function IncidentForm({
  open,
  onClose,
  initial,
  options,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: IncidentDraft | null;
  options: { users: Option[]; assets: AssetOption[] };
  onSaved: () => void;
}) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState<IncidentDraft>({
    title: "",
    description: "",
    severity: "MEDIUM",
    status: "OPEN",
    assigneeId: null,
    tags: "",
  });
  const [assetIds, setAssetIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    if (initial) {
      setForm({
        title: initial.title,
        description: initial.description,
        severity: initial.severity,
        status: initial.status,
        assigneeId: initial.assigneeId,
        tags: initial.tags,
      });
      setAssetIds(initial.assetIds ?? []);
    } else {
      setForm({ title: "", description: "", severity: "MEDIUM", status: "OPEN", assigneeId: null, tags: "" });
      setAssetIds([]);
    }
  }, [open, initial]);

  function set<K extends keyof IncidentDraft>(key: K, value: IncidentDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const next: Record<string, string> = {};
    if (form.title.trim().length < 3) next.title = "Title must be at least 3 characters";
    if (form.description.trim().length < 1) next.description = "Describe what was observed";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const body = { ...form, assetIds };
      if (editing && initial?.id) {
        await api(`/api/incidents/${initial.id}`, { method: "PATCH", body });
      } else {
        await api("/api/incidents", { method: "POST", body });
      }
      onSaved();
      onClose();
    } catch (err) {
      const e2 = err as ApiClientError;
      setFormError(e2.message);
      setErrors(e2.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  function toggleAsset(id: number) {
    setAssetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${initial?.key ?? "incident"}` : "Create incident"}
      description="Records are written to PostgreSQL. Your role is checked on the server before anything is saved."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="incident-form" loading={busy}>
            {editing ? "Save changes" : "Create incident"}
          </Button>
        </>
      }
    >
      <form id="incident-form" onSubmit={submit} noValidate className="space-y-4">
        {formError ? <ErrorCallout title={formError} /> : null}

        <div>
          <Label htmlFor="inc-title">Title</Label>
          <Input
            id="inc-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            invalid={Boolean(errors.title)}
            placeholder="Short, specific summary of the event"
          />
          <FieldError message={errors.title} />
        </div>

        <div>
          <Label htmlFor="inc-desc">Description</Label>
          <Textarea
            id="inc-desc"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            invalid={Boolean(errors.description)}
            placeholder="What was observed, where, and what is already known."
            className="min-h-[120px]"
          />
          <FieldError message={errors.description} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="inc-sev">Severity</Label>
            <Select id="inc-sev" value={form.severity} onChange={(e) => set("severity", e.target.value)}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="inc-status">Status</Label>
            <Select id="inc-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="inc-assignee">Assigned analyst</Label>
            <Select
              id="inc-assignee"
              value={String(form.assigneeId ?? "")}
              onChange={(e) => set("assigneeId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Unassigned</option>
              {options.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="inc-tags" hint="comma separated">
            Tags
          </Label>
          <Input
            id="inc-tags"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="identity, credential-access"
          />
        </div>

        <fieldset>
          <legend className="label mb-2">Affected assets</legend>
          <div className="grid max-h-[168px] gap-1.5 overflow-y-auto border border-[var(--border)] p-2 sm:grid-cols-2" style={{ borderRadius: 4 }}>
            {options.assets.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 rounded-[3px] px-2 py-1.5 text-[12.5px] transition-colors hover:bg-[var(--hover)]"
              >
                <input
                  type="checkbox"
                  checked={assetIds.includes(a.id)}
                  onChange={() => toggleAsset(a.id)}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                <span className="mono truncate text-[11px] text-[var(--muted-2)]">{a.key}</span>
                <span className="truncate">{a.name}</span>
              </label>
            ))}
            {!options.assets.length ? (
              <p className="col-span-full px-1 py-2 text-[12.5px] text-[var(--muted)]">
                No assets in the inventory yet. Add one on the Assets page first.
              </p>
            ) : null}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
