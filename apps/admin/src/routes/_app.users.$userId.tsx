import { createFileRoute } from "@tanstack/react-router";
import { UserDetailPage } from "@/features/users/UserDetailPage";

export const Route = createFileRoute("/_app/users/$userId")({
  component: UserDetailRoute,
});

function UserDetailRoute() {
  const { userId } = Route.useParams();
  return <UserDetailPage userId={userId} />;
}
