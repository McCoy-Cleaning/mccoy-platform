import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/$")({
  beforeLoad: ({ params, location }) => {
    const rest = params._splat?.replace(/^\/+/, "") ?? "";
    const path = rest ? `/${rest}` : "/";
    throw redirect({
      href: `${path}${location.searchStr ?? ""}${location.hash ?? ""}`,
      replace: true,
      statusCode: 301,
    });
  },
});
