import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // data stays "fresh" for 30 s — no re-fetch on quick navigation
      gcTime: 5 * 60_000,         // garbage-collect unused cache after 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
