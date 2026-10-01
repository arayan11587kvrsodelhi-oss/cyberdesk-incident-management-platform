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

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/assets", label: "Assets", icon: Server },
  { href: "/investigations", label: "Investigations", icon: NotebookPen },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export const WORKSPACE = {
  name: "Nighthawk Systems",
  suffix: "(demo)",
  region: "eu-west-1 · simulated",
};
