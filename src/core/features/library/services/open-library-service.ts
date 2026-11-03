import { api } from "@/core/services/api-service";
export type OpenLibraryItem = {
  id: string;
  kind: "books" | "articles";
  title: string;
  authors: string;
  summary: string;
  url: string;
  coverUrl: string | null;
  year: number | null;
  source: string;
};
export type OpenLibraryResult = {
  kind: "books" | "articles";
  query: string;
  page: number;
  total: number;
  hasNext: boolean;
  source: string;
  degraded?: boolean;
  items: OpenLibraryItem[];
};
export const openLibraryService = {
  search: async (kind: "books" | "articles", search: string, page: number) =>
    (
      await api.get<OpenLibraryResult>("/open-library", {
        params: { kind, search, page },
      })
    ).data,
};
