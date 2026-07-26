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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOutAdmin, useAdminSession } from "@/lib/admin-auth";
import { getAdminRequestsUnreadCount } from "@/lib/api/admin-requests.functions";
import { NotificationCentre } from "@/components/admin/NotificationCentre";
import { subscribeAdminRequestsUnreadBadge } from "@/lib/requests/unread-badge";
import logoUrl from "@/assets/logo-mccoy.png";

export const Route = createFileRoute("/admin")({
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
  { to: "/admin", label: "Overzicht", icon: LayoutDashboard, hint: "Dashboard" },
  { to: "/admin/website", label: "Website", icon: Globe2, hint: "Content & pagina's" },
  { to: "/admin/inquiries", label: "Aanvragen", icon: Inbox, hint: "Inkomende berichten" },
  { to: "/admin/users", label: "Gebruikers", icon: Users, hint: "Teamleden & rollen" },
  { to: "/admin/products", label: "Producten", icon: Package, hint: "Catalogus" },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginRoute = pathname === "/admin/login";
  const isMfaRoute = pathname === "/admin/mfa";
  const isInviteRoute = pathname === "/admin/invite";
  const isAuthShellRoute = isLoginRoute || isMfaRoute || isInviteRoute;
  const { session, ready } = useAdminSession();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [requestsUnread, setRequestsUnread] = React.useState(0);

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
      navigate({ to: "/admin/login", replace: true });
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
      navigate({ to: "/admin/mfa", replace: true });
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

      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 lg:px-6 lg:py-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl lg:flex">
          <SidebarBrand />
          <NavList pathname={pathname} onNavigate={() => {}} requestsUnread={requestsUnread} />
          <div className="mt-auto">
            <UserCard
              username={session.username}
              onSignOut={() => {
                void signOutAdmin().then(() => navigate({ to: "/admin/login", replace: true }));
              }}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Mobile top bar */}
          <header className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl lg:hidden">
            <SidebarBrand compact />
            <div className="flex items-center gap-2">
              <NotificationCentre />
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Menu openen"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 transition hover:bg-white/10"
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
            "absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col border-r border-white/10 bg-[#0a0a0f] p-4 shadow-2xl transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <SidebarBrand />
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Menu sluiten"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5"
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
                void signOutAdmin().then(() => navigate({ to: "/admin/login", replace: true }));
              }}
            />
          </div>
        </aside>
      </div>

      {/* Mobile bottom dock — always visible for out-of-the-box mobile UX */}
      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/10 bg-black/70 p-1.5 backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-5 gap-1">
          {ADMIN_NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            const badge = item.to === "/admin/inquiries" ? requestsUnread : 0;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition-all",
                    active
                      ? "bg-[#1e88e5] text-white shadow-lg shadow-[#1e88e5]/30"
                      : "text-white/60 hover:text-white",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-4 w-4" />
                    {badge > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-[#ef4444] ring-2 ring-[#0a0a0f]"
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
      <div className="h-20 lg:hidden" />
    </div>
  );
}

function SidebarBrand({ compact }: { compact?: boolean }) {
  return (
    <Link to="/admin" className="mb-6 flex items-center gap-3">
      <img
        src={logoUrl}
        alt="McCoy Cleaning"
        className={cn("w-auto object-contain", compact ? "h-8" : "h-9")}
        draggable={false}
      />
      {!compact && (
        <div className="min-w-0">
          <div className="truncate text-sm font-bold tracking-tight">McCoy Admin</div>
          <div className="truncate text-[11px] text-white/50">Control center</div>
        </div>
      )}
    </Link>
  );
}

function NavList({
  pathname,
  onNavigate,
  requestsUnread = 0,
}: {
  pathname: string;
  onNavigate: () => void;
  requestsUnread?: number;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        const badge = item.to === "/admin/inquiries" ? requestsUnread : 0;
        return (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-gradient-to-r from-[#1e88e5]/20 to-transparent text-white shadow-inner"
                  : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[#1e88e5]" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-110",
                  active && "text-[#1e88e5]",
                )}
              />
              <span className="flex-1 truncate font-medium">{item.label}</span>
              {badge > 0 && (
                <span
                  className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[10px] font-semibold text-white"
                  aria-label={`${badge} ongelezen aanvragen`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserCard({ username, onSignOut }: { username: string; onSignOut: () => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1e88e5] to-[#7c3aed] text-xs font-bold uppercase">
          {username.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{username}</div>
          <div className="truncate text-[11px] text-white/50">Beheerder</div>
        </div>
        <NotificationCentre className="h-8 w-8" />
        <Link
          to="/admin/settings"
          aria-label="Instellingen"
          title="Instellingen"
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          onClick={onSignOut}
          aria-label="Uitloggen"
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
