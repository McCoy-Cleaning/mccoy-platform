import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { UsersPage, validateUsersSearch } from "@/features/users";

export const Route = createFileRoute("/_app/users")({
  validateSearch: validateUsersSearch,
  component: UsersRoute,
});

function UsersRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDetailRoute = pathname !== "/users" && pathname.startsWith("/users/");
  if (isDetailRoute) {
    return <Outlet />;
  }
  const search = Route.useSearch();
  return <UsersPage search={search} />;
}
