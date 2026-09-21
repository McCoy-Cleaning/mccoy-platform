import { createFileRoute } from "@tanstack/react-router";
import { TeammateDetailPage } from "@/features/team/TeammateDetailPage";

export const Route = createFileRoute("/account/company/users/$userId")({
  component: TeammateDetailRoute,
});

function TeammateDetailRoute() {
  const { userId } = Route.useParams();
  return <TeammateDetailPage userId={userId} />;
}
