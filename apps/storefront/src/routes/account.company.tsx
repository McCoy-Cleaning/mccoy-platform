import { createFileRoute, Link, Outlet, useRouterState, getRouteApi } from "@tanstack/react-router";

const accountRoute = getRouteApi("/account");

export const Route = createFileRoute("/account/company")({
  component: AccountCompanyPage,
});

function AccountCompanyPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isUsersRoute = pathname.endsWith("/users");

  if (isUsersRoute) {
    return <Outlet />;
  }

  const { accountSession } = accountRoute.useRouteContext();
  const company = accountSession?.membership.company;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Bedrijfsgegevens</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Bedrijfsnaam</dt>
            <dd className="font-medium">{company?.legalName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">KvK</dt>
            <dd className="font-medium">{company?.kvkNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">E-mail</dt>
            <dd className="font-medium">{company?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Telefoon</dt>
            <dd className="font-medium">{company?.phone ?? "—"}</dd>
          </div>
        </dl>
        {accountSession?.membership.role === "account_admin" ? (
          <p className="mt-6">
            <Link
              to="/account/company/users"
              className="text-sm font-medium text-sky-700 hover:underline"
            >
              Gebruikers beheren
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
