import { createFileRoute } from "@tanstack/react-router";
import { InquiriesPage, validateInquiriesSearch } from "@/features/inquiries";

export const Route = createFileRoute("/admin/inquiries")({
  validateSearch: validateInquiriesSearch,
  component: InquiriesPage,
});
