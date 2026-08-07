import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // CMS loaders prefer in-memory pages (instant). Preload on hover/touch.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 300_000,
    // Avoid View Transitions waiting on heavy image pages — swap content immediately.
    defaultViewTransition: false,
  });

  return router;
};
