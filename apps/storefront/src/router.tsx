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
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 120_000,
    // Soft cross-fade between routes when the browser supports View Transitions.
    defaultViewTransition: true,
  });

  return router;
};
