import { createFileRoute, Outlet, redirect, useRouterState, getRouteApi } from "@tanstack/react-router";
import { AccountShell } from "@/components/account/AccountShell";
import { getAccountSession } from "@/lib/api/account.functions";

const accountRoute = getRouteApi("/account");

const PUBLIC_ACCOUNT_PATHS = [
  "/account/login",
  "/account/activate",
  "/account/forgot-password",
  "/account/reset-password",
];

function isPublicAccountPath(pathname: string): boolean {
  return PUBLIC_ACCOUNT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: "Klantenportaal — McCoy" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: async ({ location }) => {
    if (isPublicAccountPath(location.pathname)) {
      return {};
    }
    const res = await getAccountSession();
    if (!res.ok || !res.session) {
      throw redirect({ to: "/account/login" });
    }
    return { accountSession: res.session };
  },
  component: AccountLayout,
});

function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isPublicAccountPath(pathname)) {
    return <Outlet />;
  }

  const { accountSession: session } = accountRoute.useRouteContext();
  return (
    <AccountShell
      companyName={session?.membership.company.displayName ?? session?.membership.company.legalName}
      userName={session?.fullName ?? session?.email}
    >
      <Outlet />
    </AccountShell>
  );
}
