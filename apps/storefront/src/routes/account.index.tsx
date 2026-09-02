import { createFileRoute, getRouteApi } from "@tanstack/react-router";

const accountRoute = getRouteApi("/account");

export const Route = createFileRoute("/account/")({
  component: AccountHomePage,
});

function AccountHomePage() {
  const { accountSession } = accountRoute.useRouteContext();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">
        Goedemiddag, {accountSession?.fullName?.split(" ")[0] ?? "klant"}
      </h1>
      <p className="mt-2 text-slate-600">
        {accountSession?.membership.company.displayName ??
          accountSession?.membership.company.legalName}
      </p>
      <p className="mt-4 text-sm text-slate-600">
        Welkom in het McCoy klantenportaal. Bestellen en ordergeschiedenis volgen in een latere fase.
      </p>
    </div>
  );
}
