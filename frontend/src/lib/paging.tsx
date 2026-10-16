import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import type { Page } from "../api";
export function usePaged<T extends { id: string }>(
  key: QueryKey,
  fetcher: (offset: number) => Promise<Page<T>>,
  enabled = true,
) {
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetcher(pageParam),
    enabled,
    getNextPageParam: (page) => page.next_offset ?? undefined,
  });
  const seen = new Set<string>();
  const items = (query.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    },
  );
  return { ...query, items };
}
export function More({
  query,
}: {
  query: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
  };
}) {
  return query.hasNextPage ? (
    <button
      className="btn"
      disabled={query.isFetchingNextPage}
      onClick={() => void query.fetchNextPage()}
    >
      {query.isFetchingNextPage ? "Loading…" : "Load more"}
    </button>
  ) : null;
}
