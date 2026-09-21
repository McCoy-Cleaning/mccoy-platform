import { Building2, Package, Settings, Users, type LucideIcon } from "lucide-react";

export type AdminOverviewModule = {
  to: "/customers" | "/users" | "/products" | "/settings";
  label: string;
  desc: string;
  cta: string;
  icon: LucideIcon;
  accent: string;
};

/**
 * Primary Overzicht tiles. Routes already exist; this is surface/navigation only.
 */
export const ADMIN_OVERVIEW_MODULES: readonly AdminOverviewModule[] = [
  {
    to: "/customers",
    label: "Klanten",
    desc: "Geregistreerd en gastkopers",
    cta: "Klanten openen",
    icon: Building2,
    accent: "#22c55e",
  },
  {
    to: "/users",
    label: "Gebruikers",
    desc: "Wie er in het beheer",
    cta: "Gebruikers openen",
    icon: Users,
    accent: "#a78bfa",
  },
  {
    to: "/products",
    label: "Producten",
    desc: "Uw catalogus",
    cta: "Producten openen",
    icon: Package,
    accent: "#f59e0b",
  },
  {
    to: "/settings",
    label: "Instellingen",
    desc: "Algemeen en voorkeuren",
    cta: "Instellingen openen",
    icon: Settings,
    accent: "#94a3b8",
  },
];
