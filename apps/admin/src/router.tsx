import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import "@/lib/staff-invite-callback";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreloadStaleTime: 0,
  });

  return router;
};
