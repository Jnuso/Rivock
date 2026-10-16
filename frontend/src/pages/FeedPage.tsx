import { Link, useParams, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, type ThreadSummary } from "../api";
import { Empty, ErrorBox, Loading } from "../components/States";
import { cpLen, LIMITS } from "../lib/limits";

function ThreadCard({ t }: { t: ThreadSummary }) {
  return (
    <article className="card stack">
      <div className="row muted">
        <span>{t.type}</span>
        <span>·</span>
        <Link to={`/t/${t.topic.slug}`}>{t.topic.name}</Link>
        <span>·</span>
        <span>{t.score ?? "—"} votes</span>
        <span>·</span>
        <span>{t.reply_count} replies</span>
      </div>
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
        <Link to={`/threads/${t.id}`}>{t.title}</Link>
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        {t.excerpt}
      </p>
      <p className="muted" style={{ margin: 0 }}>
        {t.author ? (
          <Link to={`/u/${t.author.username}`}>{t.author.username}</Link>
        ) : (
          "[unavailable]"
        )}{" "}
        {t.author?.is_bot && <span className="badge">Fictional demo</span>}·{" "}
        {new Date(t.published_at).toLocaleString()}
      </p>
    </article>
  );
}

export function FeedPage() {
  const { topicSlug } = useParams();
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? (q.trim() ? "relevance" : "trending");
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const query = useInfiniteQuery({
    queryKey: ["threads", topicSlug ?? "", q, sort],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.getThreads({
        topic: topicSlug,
        q: q.trim() || undefined,
        sort,
        offset: pageParam,
        limit: 20,
      }),
    getNextPageParam: (last) => last.next_offset ?? undefined,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: ThreadSummary[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }, [query.data]);

  const sorts = q.trim()
    ? [
        ["relevance", "Relevance"],
        ["newest", "Newest"],
      ]
    : [
        ["trending", "Trending"],
        ["latest", "Latest"],
      ];

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>
        {topicSlug ? topicSlug.replaceAll("-", " ") : "Life has questions."}
      </h1>
      <p className="muted">
        Ask honestly. Share what helped. Find a different perspective.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (cpLen(draft) > LIMITS.query) return;
          const next = new URLSearchParams(sp);
          if (draft.trim()) next.set("q", draft.trim());
          else next.delete("q");
          next.delete("sort");
          setSp(next);
        }}
      >
        <label className="field" style={{ flex: 1 }} htmlFor="search">
          <span className="muted">Search</span>
          <input
            id="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={LIMITS.query * 2}
            aria-invalid={cpLen(draft) > LIMITS.query}
          />
        </label>
        <button type="submit" className="btn btnPrimary">
          Search
        </button>
      </form>
      <div className="row" role="group" aria-label="Sort">
        {sorts.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn ${sort === value ? "btnPrimary" : ""}`}
            aria-pressed={sort === value}
            onClick={() => {
              const next = new URLSearchParams(sp);
              next.set("sort", value);
              setSp(next);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {query.isLoading && <Loading />}
      {query.error && <ErrorBox error={query.error} />}
      {!query.isLoading && !items.length && <Empty>No threads yet.</Empty>}
      {items.map((t) => (
        <ThreadCard key={t.id} t={t} />
      ))}
      {query.hasNextPage && (
        <button
          type="button"
          className="btn"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
