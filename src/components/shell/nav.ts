import {
  Gauge,
  ShieldAlert,
  Bell,
  Server,
  NotebookPen,
  ListChecks,
  Users,
  Settings2,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export type NavGroup = { label: string; items: NavItem[] };

/** Grouped navigation — same routes as before, better section hierarchy. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: Gauge }],
  },
  {
    label: "Operations",
    items: [
      { href: "/incidents", label: "Incidents", icon: ShieldAlert },
      { href: "/alerts", label: "Alerts", icon: Bell },
      { href: "/assets", label: "Assets", icon: Server },
      { href: "/investigations", label: "Investigations", icon: NotebookPen },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/team", label: "Team", icon: Users },
      { href: "/settings", label: "Settings", icon: Settings2 },
    ],
  },
];

/** Flattened — used anywhere the old flat NAV shape is expected. */
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const WORKSPACE = {
  name: "Nighthawk Systems",
  suffix: "(demo)",
  region: "eu-west-1 · simulated",
};
