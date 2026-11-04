import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

// Fetcher tunggal — interceptor axios (CSRF header, redirect 401) tetap berlaku.
export const apiGet = (url, params) => api.get(url, { params }).then((r) => r.data);

// Master data (divisions/principals/brands/regions/branches/users): params identik dengan query endpoint.
// Satu hook dipakai banyak tempat (dropdown modal, tab list, filter dashboard) → cache bersama.
export function useMasterList(resource, params = {}, options = {}) {
  return useQuery({
    queryKey: ['master', resource, params],
    queryFn: () => apiGet(`/${resource}`, params),
    staleTime: 60_000,
    ...options,
  });
}

export function useCriteriaList(params = {}, options = {}) {
  return useQuery({
    queryKey: ['criteria', params],
    queryFn: () => apiGet('/criteria-definitions', params),
    staleTime: 30_000,
    ...options,
  });
}

export function useDocumentsList(params = {}, options = {}) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => apiGet('/documents', params),
    staleTime: 15_000,
    ...options,
  });
}

export function useDocument(id, options = {}) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => apiGet(`/documents/${id}`),
    enabled: !!id,
    ...options,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => apiGet('/stats'),
    staleTime: 30_000,
  });
}