import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { cpLen, LIMITS } from "../lib/limits";
import { More } from "../lib/paging";
import { api, type ThreadSummary } from "../api";
import { Empty, ErrorBox, Loading, QueryError } from "../components/States";
import { useAuth } from "../auth/AuthContext";

export function SavedPage() {
  const { user, signIn, configured, authMessage } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);
  const unsave = useMutation({
    mutationFn: (id: string) => api.unsaveThread(id),
    onSuccess: async () => {
      await qc.invalidateQueries();
    },
  });
  const q = useInfiniteQuery({
    queryKey: ["saved", search],
    enabled: !!user,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.getSaved(pageParam, 20, search.trim()),
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
            else void signIn(location.pathname + location.search);
          }}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Saved</h1>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          if (cpLen(draft) > LIMITS.query) return;
          const next = new URLSearchParams(params);
          if (draft.trim()) next.set("q", draft.trim());
          else next.delete("q");
          setParams(next);
        }}
      >
        <label className="field" htmlFor="saved-search" style={{ flex: 1 }}>
          <span>Search saved conversations</span>
          <input
            id="saved-search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={LIMITS.query * 2}
            aria-invalid={cpLen(draft) > LIMITS.query}
          />
        </label>
        <button
          type="submit"
          className="btn btnPrimary"
          disabled={cpLen(draft) > LIMITS.query}
        >
          Search saved
        </button>
      </form>
      {cpLen(draft) > LIMITS.query && (
        <p role="alert">Use {LIMITS.query} characters or fewer.</p>
      )}
      {search && (
        <button
          type="button"
          className="btn"
          onClick={() => {
            const next = new URLSearchParams(params);
            next.delete("q");
            setParams(next);
          }}
        >
          Clear saved search
        </button>
      )}
      <p className="muted">
        Search covers all your saved conversations, with the most recently saved
        first. Unavailable items appear when the search is clear.
      </p>
      {q.isLoading && <Loading />}
      <QueryError query={q} />
      {unsave.error && <ErrorBox error={unsave.error} />}
      {!q.isLoading && !q.error && !items.length && (
        <Empty>
          {search.trim()
            ? "No saved conversations match your search."
            : "No saved threads."}
        </Empty>
      )}
      {items.map((t) => (
        <article key={t.id} className="card stack">
          {t.state && t.state !== "published" ? (
            <p className="muted">Unavailable saved item</p>
          ) : (
            <>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                <Link
                  to={`/threads/${t.id}`}
                  state={{ feedReturn: location.pathname + location.search }}
                >
                  {t.title}
                </Link>
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
      <More query={q} />
    </div>
  );
}
