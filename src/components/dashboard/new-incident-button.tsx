"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IncidentForm, type AssetOption, type Option } from "@/components/incidents/incident-form";
import { api } from "@/lib/client";

/**
 * Dashboard entry point for "Create incident" — reuses the existing IncidentForm
 * dialog (same POST /api/incidents flow, same server-side authorisation).
 */
export function NewIncidentButton({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Option[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);

  useEffect(() => {
    if (!open || users.length) return;
    api<{ users: Option[]; assets: AssetOption[] }>("/api/options")
      .then((res) => {
        setUsers(res.users);
        setAssets(res.assets);
      })
      .catch(() => undefined);
  }, [open, users.length]);

  if (!canCreate) return null;

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus size={14} />
        New incident
      </Button>
      <IncidentForm
        open={open}
        onClose={() => setOpen(false)}
        initial={null}
        options={{ users, assets }}
        onSaved={() => {
          // Same refresh pattern as the rest of the app: revalidate server data
          // without a full document reload (preserves scroll and client state).
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
