import { createFileRoute } from "@tanstack/react-router";
import { CompanyPortalDetailPage } from "@/features/customers/CompanyPortalDetailPage";

export const Route = createFileRoute("/_app/customers/company/$companyId")({
  component: CompanyPortalRoute,
});

function CompanyPortalRoute() {
  const { companyId } = Route.useParams();
  return <CompanyPortalDetailPage companyId={companyId} />;
}
