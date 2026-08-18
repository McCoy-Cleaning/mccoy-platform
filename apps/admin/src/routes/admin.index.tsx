import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  beforeLoad: ({ location }) => {
    throw redirect({
      href: `/${location.searchStr ?? ""}${location.hash ?? ""}`,
      replace: true,
      statusCode: 301,
    });
  },
});
