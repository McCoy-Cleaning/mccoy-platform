import { createFileRoute } from "@tanstack/react-router";
import { RegisteredCustomerDetailPage } from "@/features/customers";

export const Route = createFileRoute("/_app/customers/registered/$customerId")({
  component: RegisteredCustomerRoute,
});

function RegisteredCustomerRoute() {
  const { customerId } = Route.useParams();
  return <RegisteredCustomerDetailPage customerId={customerId} />;
}
