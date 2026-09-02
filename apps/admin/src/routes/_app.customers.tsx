import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { CustomersPage, validateCustomersSearch } from "@/features/customers";

export const Route = createFileRoute("/_app/customers")({
  validateSearch: validateCustomersSearch,
  component: CustomersRoute,
});

function CustomersRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDetailRoute = /\/customers\/(company|registered|guest)\//.test(pathname);

  if (isDetailRoute) {
    return <Outlet />;
  }

  const search = Route.useSearch();
  return <CustomersPage search={search} />;
}
