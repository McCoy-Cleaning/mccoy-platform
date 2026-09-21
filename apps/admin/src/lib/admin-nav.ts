import {
  Building2,
  Globe2,
  Inbox,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavTo =
  | "/"
  | "/website"
  | "/inquiries"
  | "/customers"
  | "/users"
  | "/products"
  | "/settings";

export type AdminNavItem = {
  to: AdminNavTo;
  label: string;
  hint: string;
  icon: LucideIcon;
};

/**
 * Desktop sidebar items — previous visual chrome, Dutch titles + subtitles.
 * Keep `to` keys stable so Overzicht tiles and notification destinations stay aligned.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { to: "/", label: "Overzicht", icon: LayoutDashboard, hint: "Start — wat er speelt" },
  { to: "/website", label: "Website", icon: Globe2, hint: "Pagina's, teksten & foto's" },
  { to: "/inquiries", label: "Aanvragen", icon: Inbox, hint: "Berichten van klanten" },
  { to: "/customers", label: "Klanten", icon: Building2, hint: "Geregistreerd en gastkopers" },
  { to: "/users", label: "Gebruikers", icon: Users, hint: "Wie mag er in het beheer" },
  { to: "/products", label: "Producten", icon: Package, hint: "Uw catalogus" },
  { to: "/settings", label: "Instellingen", icon: Settings, hint: "Algemeen en voorkeuren" },
];

/**
 * Compact phone dock — five primaries; Gebruikers and Instellingen stay in the drawer.
 */
export const ADMIN_MOBILE_DOCK: readonly AdminNavItem[] = ADMIN_NAV.filter(
  (item) => item.to !== "/users" && item.to !== "/settings",
);

export function isAdminNavActive(pathname: string, to: AdminNavTo): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}
