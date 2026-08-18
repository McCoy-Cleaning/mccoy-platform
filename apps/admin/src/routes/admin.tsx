import { Outlet, createFileRoute } from "@tanstack/react-router";

/** Legacy `/admin` prefix — children redirect to the unprefixed path. */
export const Route = createFileRoute("/admin")({
  component: () => <Outlet />,
});
