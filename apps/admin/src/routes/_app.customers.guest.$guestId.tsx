import { createFileRoute } from "@tanstack/react-router";
import { GuestCustomerDetailPage } from "@/features/customers";

export const Route = createFileRoute("/_app/customers/guest/$guestId")({
  component: GuestCustomerRoute,
});

function GuestCustomerRoute() {
  const { guestId } = Route.useParams();
  return <GuestCustomerDetailPage guestId={guestId} />;
}
