import { createFileRoute } from "@tanstack/react-router";
import { InquiriesPage, validateInquiriesSearch } from "@/features/inquiries";

export const Route = createFileRoute("/_app/inquiries")({
  validateSearch: validateInquiriesSearch,
  component: InquiriesPage,
});
