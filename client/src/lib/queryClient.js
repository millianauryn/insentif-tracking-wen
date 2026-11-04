import { QueryClient, keepPreviousData } from '@tanstack/react-query';

// Kontrak queryKey — konsisten agar invalidasi prefix bekerja:
//   ['master', resource, params]  → divisions/principals/brands/regions/branches/users (dropdown & tab)
//   ['criteria', params]          → list criteria
//   ['documents', params]         → list documents
//   ['stats']                     → ringkasan dashboard
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
    },
  },
});

export default queryClient;