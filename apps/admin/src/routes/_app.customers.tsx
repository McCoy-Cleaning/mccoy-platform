import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage, validateCustomersSearch } from "@/features/customers";

export const Route = createFileRoute("/_app/customers")({
  validateSearch: validateCustomersSearch,
  component: CustomersRoute,
});

function CustomersRoute() {
  const search = Route.useSearch();
  return <CustomersPage search={search} />;
}
