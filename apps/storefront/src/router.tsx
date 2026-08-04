import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // CMS page loaders hit server fns (not React Query). Preload on hover/touch so
    // nav clicks reuse cached loader data instead of blocking on a cold round-trip.
    // Keep the default 30s preload cache — staleTime: 0 is only for Query-backed loaders.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
