import { Link } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { api, type ThreadSummary } from "../api";
import { Empty, ErrorBox, Loading } from "../components/States";
import { useAuth } from "../auth/AuthContext";

export function SavedPage() {
  const { user, signIn, configured, authMessage } = useAuth();
  const qc = useQueryClient();
  const unsave = useMutation({
    mutationFn: (id: string) => api.unsaveThread(id),
    onSuccess: async () => {
      await qc.invalidateQueries();
    },
  });
  const q = useInfiniteQuery({
    queryKey: ["saved"],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.getSaved(pageParam),
    getNextPageParam: (last) => last.next_offset ?? undefined,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: ThreadSummary[] = [];
    for (const page of q.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }, [q.data]);

  if (!user) {
    return (
      <div className="stack">
        <h1>Saved</h1>
        <button
          type="button"
          className="btn btnPrimary"
          onClick={() => {
            if (!configured) window.alert(authMessage);
            else void signIn("/saved");
          }}
        >
          Sign in
        </button>
      </div>
    );
  }

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Saved</h1>
      {unsave.error && <ErrorBox error={unsave.error} />}
      {!items.length && <Empty>No saved threads.</Empty>}
      {items.map((t) => (
        <article key={t.id} className="card stack">
          {t.state && t.state !== "published" ? (
            <p className="muted">Unavailable saved item</p>
          ) : (
            <>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                <Link to={`/threads/${t.id}`}>{t.title}</Link>
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {t.excerpt}
              </p>
            </>
          )}
          <button
            type="button"
            className="btn"
            disabled={unsave.isPending}
            onClick={() => unsave.mutate(t.id)}
          >
            Remove from saved
          </button>
        </article>
      ))}
      {q.hasNextPage && (
        <button
          type="button"
          className="btn"
          onClick={() => void q.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </div>
  );
}
