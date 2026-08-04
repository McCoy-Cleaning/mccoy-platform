import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import "@/lib/staff-invite-callback";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Admin routes have no loaders today; intent preload still warms route chunks.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
