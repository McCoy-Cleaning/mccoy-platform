import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import * as React from "react";
import {
  LayoutDashboard,
  Globe2,
  Inbox,
  Users,
  Package,
  LogOut,
  Menu,
  X,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { signOutAdmin, useAdminSession } from "@/lib/admin-auth";
import { getAdminRequestsUnreadCount } from "@/lib/api/admin-requests.functions";
import { NotificationCentre } from "@/components/admin/NotificationCentre";
import { subscribeAdminRequestsUnreadBadge } from "@/lib/requests/unread-badge";
import logoUrl from "@/assets/logo-mccoy.png";

export const Route = createFileRoute("/_app")({
  head: () => ({
    meta: [{ title: "Admin — McCoy Cleaning" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
};

export const ADMIN_NAV: NavItem[] = [
  { to: "/", label: "Overzicht", icon: LayoutDashboard, hint: "Start — wat er speelt" },
  { to: "/website", label: "Website", icon: Globe2, hint: "Pagina's, teksten & foto's" },
  { to: "/inquiries", label: "Aanvragen", icon: Inbox, hint: "Berichten van klanten" },
  { to: "/customers", label: "Klanten", icon: Building2, hint: "Geregistreerd en gastkopers" },
  { to: "/users", label: "Gebruikers", icon: Users, hint: "Wie mag er in het beheer" },
  { to: "/products", label: "Producten", icon: Package, hint: "Uw catalogus" },
];

const SIDEBAR_COLLAPSED_KEY = "mccoy-admin-sidebar-collapsed";

/** Expanded: 18rem (288px). Collapsed icon rail: 4.75rem (76px). */
function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") setCollapsedState(true);
  }, []);

  const setCollapsed = React.useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  return { collapsed, toggleCollapsed };
}

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginRoute = pathname === "/login";
  const isMfaRoute = pathname === "/mfa";
  const isInviteRoute = pathname === "/invite";
  const isRecoverMfaRoute = pathname === "/recover-mfa";
  const isAuthShellRoute = isLoginRoute || isMfaRoute || isInviteRoute || isRecoverMfaRoute;
  const { session, ready } = useAdminSession();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [requestsUnread, setRequestsUnread] = React.useState(0);
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();

  React.useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const refresh = () => {
      void getAdminRequestsUnreadCount()
        .then((result) => {
          if (!cancelled && result.ok) setRequestsUnread(result.count);
        })
        .catch(() => {
          /* non-fatal — badge keeps last known count */
        });
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const unsubscribe = subscribeAdminRequestsUnreadBadge(refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      unsubscribe();
    };
  }, [session]);

  React.useEffect(() => {
    if (!ready) return;
    if (!session && !isAuthShellRoute) {
      navigate({ to: "/login", replace: true });
      return;
    }
    // Do not trap aal2 (or MFA-in-progress) users on /invite after a password reset.
    if (
      session &&
      !isInviteRoute &&
      !isMfaRoute &&
      session.status === "invited" &&
      session.aal !== "aal2" &&
      !session.mfaRequired &&
      session.nextStep !== "mfa_enroll" &&
      session.nextStep !== "mfa_verify"
    ) {
      navigate({ to: "/invite", replace: true });
      return;
    }
    if (session && session.status === "invited" && session.aal === "aal2" && !isInviteRoute) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (
      session &&
      !isMfaRoute &&
      !isLoginRoute &&
      !isInviteRoute &&
      (session.mfaRequired ||
        session.nextStep === "mfa_enroll" ||
        session.nextStep === "mfa_verify")
    ) {
      navigate({ to: "/mfa", replace: true });
    }
  }, [ready, session, isAuthShellRoute, isMfaRoute, isLoginRoute, isInviteRoute, navigate]);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isAuthShellRoute) {
    return (
      <div className="admin-shell min-h-screen">
        <Outlet />
      </div>
    );
  }

  if (!ready || !session || session.mfaRequired) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center text-white/60">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  return (
    <div className="admin-shell relative min-h-screen text-white">
      {/* ambient gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-[#1e88e5]/20 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-[#7c3aed]/15 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:32px_32px] opacity-40" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-[2400px] gap-4 px-2 py-3 lg:gap-5 lg:px-4 lg:py-5">
        {/* Desktop sidebar */}
        <TooltipProvider delayDuration={0}>
          <aside
            className={cn(
              "sticky top-5 hidden h-[calc(100vh-2.5rem)] shrink-0 flex-col rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_32px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-[width,padding] duration-200 ease-linear lg:flex",
              collapsed ? "w-[4.75rem] p-2" : "w-72 p-4",
            )}
          >
            <div
              className={cn(
                "mb-4 flex shrink-0",
                collapsed ? "flex-col items-center gap-2" : "items-start justify-between gap-2",
              )}
            >
              <SidebarBrand collapsed={collapsed} />
              <SidebarToggle collapsed={collapsed} onToggle={toggleCollapsed} />
            </div>
            <NavList
              pathname={pathname}
              onNavigate={() => {}}
              requestsUnread={requestsUnread}
              collapsed={collapsed}
            />
            <div className="mt-auto pt-4">
              <UserCard
                username={session.username}
                collapsed={collapsed}
                onSignOut={() => {
                  void signOutAdmin().then(() => navigate({ to: "/login", replace: true }));
                }}
              />
            </div>
          </aside>
        </TooltipProvider>

        <main className="min-w-0 flex-1">
          {/* Mobile top bar */}
          <header className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl lg:hidden">
            <SidebarBrand compact />
            <div className="flex items-center gap-2">
              <NotificationCentre />
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Menu openen"
                className="a-icon-btn"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>

          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity lg:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col border-r border-white/10 bg-[#0a0a0f] p-5 shadow-2xl transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <SidebarBrand />
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Menu sluiten"
              className="a-icon-btn"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <NavList
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
            requestsUnread={requestsUnread}
          />
          <div className="mt-auto">
            <UserCard
              username={session.username}
              onSignOut={() => {
                void signOutAdmin().then(() => navigate({ to: "/login", replace: true }));
              }}
            />
          </div>
        </aside>
      </div>

      {/* Mobile bottom dock — always visible for out-of-the-box mobile UX */}
      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/10 bg-black/80 p-2 backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-5 gap-1">
          {ADMIN_NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            const badge = item.to === "/inquiries" ? requestsUnread : 0;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-semibold transition-all",
                    active
                      ? "bg-[#1e88e5] text-white shadow-lg shadow-[#1e88e5]/30"
                      : "text-white/65 hover:text-white",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {badge > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-[#ef4444] ring-2 ring-[#0a0a0f]"
                      />
                    )}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {badge > 0 && <span className="sr-only">{badge} ongelezen aanvragen</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* padding so content isn't hidden under dock */}
      <div className="h-24 lg:hidden" />
    </div>
  );
}

function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Zijbalk uitklappen" : "Zijbalk inklappen"}
      className={cn(
        "grid shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]/50",
        collapsed ? "h-9 w-9" : "h-9 w-9",
      )}
    >
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </button>
  );
}

function SidebarBrand({ compact, collapsed }: { compact?: boolean; collapsed?: boolean }) {
  const brand = (
    <Link
      to="/"
      className={cn(
        "flex items-center",
        collapsed ? "justify-center" : compact ? "gap-3" : "min-w-0 flex-1 gap-3",
      )}
    >
      <img
        src={logoUrl}
        alt="McCoy Cleaning"
        className={cn("w-auto shrink-0 object-contain", compact || collapsed ? "h-11" : "h-14")}
        draggable={false}
      />
      {!compact && !collapsed && (
        <div className="min-w-0">
          <div className="text-base font-bold tracking-tight">McCoy Beheer</div>
          <div className="text-xs text-white/55">Uw website & aanvragen</div>
        </div>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{brand}</TooltipTrigger>
        <TooltipContent side="right" className="border-white/10 bg-[#0a0a0f] text-white">
          McCoy Beheer
        </TooltipContent>
      </Tooltip>
    );
  }

  return brand;
}

function NavList({
  pathname,
  onNavigate,
  requestsUnread = 0,
  collapsed = false,
}: {
  pathname: string;
  onNavigate: () => void;
  requestsUnread?: number;
  collapsed?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        const badge = item.to === "/inquiries" ? requestsUnread : 0;

        const link = (
          <Link
            to={item.to}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? `${item.label} — ${item.hint}` : undefined}
            className={cn(
              "group relative flex items-center rounded-2xl transition-all",
              collapsed ? "justify-center px-2 py-2.5" : "gap-3.5 px-3.5 py-3",
              active
                ? "bg-gradient-to-r from-[#1e88e5]/25 via-[#1e88e5]/10 to-transparent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "text-white/65 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            {active && !collapsed && (
              <span className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-[#2f9ff0]" />
            )}
            <span
              className={cn(
                "relative grid shrink-0 place-items-center rounded-xl transition",
                collapsed ? "h-10 w-10" : "h-10 w-10",
                active
                  ? "bg-[#1e88e5] text-white shadow-lg shadow-[#1e88e5]/40"
                  : "bg-white/[0.06] text-white/60 group-hover:text-white",
              )}
            >
              <Icon className="h-5 w-5" />
              {collapsed && badge > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#ef4444] ring-2 ring-[#0a0a0f]"
                />
              )}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-white/45">{item.hint}</span>
                </span>
                {badge > 0 && (
                  <span
                    className="ml-auto inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-xs font-bold text-white"
                    aria-label={`${badge} ongelezen aanvragen`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </>
            )}
            {collapsed && badge > 0 && (
              <span className="sr-only">{badge} ongelezen aanvragen</span>
            )}
          </Link>
        );

        return (
          <li key={item.to}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="max-w-xs border-white/10 bg-[#0a0a0f] text-white"
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-white/60">{item.hint}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
          </li>
        );
      })}
    </ul>
  );
}

function UserCard({
  username,
  onSignOut,
  collapsed = false,
}: {
  username: string;
  onSignOut: () => void;
  collapsed?: boolean;
}) {
  const avatar = (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1e88e5] to-[#7c3aed] text-sm font-bold uppercase shadow-lg shadow-[#1e88e5]/25">
      {username.slice(0, 2)}
    </div>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{avatar}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="border-white/10 bg-[#0a0a0f] text-white">
            <p className="font-semibold">{username}</p>
            <p className="text-white/60">Beheerder</p>
          </TooltipContent>
        </Tooltip>
        <NotificationCentre className="h-9 w-9" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/settings"
              aria-label="Instellingen"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white/85 transition hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]/50"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="border-white/10 bg-[#0a0a0f] text-white">
            Instellingen
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Uitloggen"
              className="grid h-9 w-9 place-items-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-200 transition hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="border-white/10 bg-[#0a0a0f] text-white">
            Uitloggen
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{username}</div>
          <div className="truncate text-xs text-white/50">Beheerder</div>
        </div>
        <NotificationCentre className="h-11 w-11" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/settings"
          aria-label="Instellingen"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
        >
          <Settings className="h-4 w-4" />
          Instellingen
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Uitloggen"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 text-sm font-semibold text-red-200 transition hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-100"
        >
          <LogOut className="h-4 w-4" />
          Uitloggen
        </button>
      </div>
    </div>
  );
}
