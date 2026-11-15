// Hooks for custom pages: listing, detail fetching, query resolution, and SSE events.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

// Types matching the server response shapes
export interface CreatePageInput {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  definition: Record<string, unknown>;
}

export interface CustomPageMeta {
  id: string;
  title: string;
  icon: string;
  description: string | null;
  sortOrder: number;
}

export interface CustomPageFull extends CustomPageMeta {
  definition: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// List all custom pages (sidebar)
export function useCustomPages() {
  return useQuery({
    queryKey: queryKeys.customPages.list(),
    queryFn: () => api.get<CustomPageMeta[]>("/api/v2/pages"),
  });
}

// Get a single page definition
export function useCustomPage(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customPages.detail(id),
    queryFn: () => api.get<CustomPageFull>(`/api/v2/pages/${id}`),
    enabled: !!id && enabled,
    retry: false,
  });
}

// Batch query resolution for widget data
export interface BatchQuery {
  key: string;
  query: Record<string, unknown>;
}

export function useWidgetQueries(
  pageId: string,
  queries: BatchQuery[],
  filters?: Record<string, unknown>,
) {
  return useQuery({
    queryKey: queryKeys.widgetQueries.batch(pageId, filters),
    queryFn: () =>
      api.post<Record<string, unknown>>("/api/v2/query", {
        queries: queries.map((q) => ({
          key: q.key,
          query: filters ? mergeFiltersIntoQuery(q.query, filters) : q.query,
        })),
      }),
    enabled: queries.length > 0,
  });
}

// Merge page-level filter state into a widget's query filters
function mergeFiltersIntoQuery(
  query: Record<string, unknown>,
  pageFilters: Record<string, unknown>,
): Record<string, unknown> {
  const existing = (query.filters ?? {}) as Record<string, unknown>;
  return {
    ...query,
    filters: { ...existing, ...pageFilters },
  };
}

// SSE subscription for page change events
export function usePageEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource("/api/v2/pages/events");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "page_changed") {
          queryClient.invalidateQueries({ queryKey: queryKeys.customPages.list() });
          if (data.id) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.customPages.detail(data.id),
            });
          }
        } else if (data.type === "page_deleted") {
          if (data.id) {
            queryClient.cancelQueries({ queryKey: queryKeys.customPages.detail(data.id) });
            queryClient.setQueryData(queryKeys.customPages.detail(data.id), null);
            queryClient.removeQueries({
              queryKey: queryKeys.customPages.detail(data.id),
            });
          }
          queryClient.invalidateQueries({ queryKey: queryKeys.customPages.list() });
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => eventSource.close();
  }, [queryClient]);
}

// Create a new custom page
export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (page: CreatePageInput) => api.post<CustomPageFull>("/api/v2/pages", page),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customPages.list() });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.customPages.detail(data.id) });
      }
    },
  });
}

// Update a custom page
export function useUpdatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...page }: CreatePageInput & { id: string }) => api.put<CustomPageFull>(`/api/v2/pages/${id}`, page),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customPages.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.customPages.detail(variables.id) });
    },
  });
}

// Delete a custom page
export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v2/pages/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customPages.detail(id) });
      queryClient.setQueryData(queryKeys.customPages.detail(id), null);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.customPages.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customPages.list() });
    },
  });
}
