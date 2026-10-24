import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, type ThreadSummary } from "../api";
import { Empty, Loading, QueryError } from "../components/States";
import { cpLen, LIMITS } from "../lib/limits";
import { SaveThreadButton } from "../components/SaveThreadButton";

function ThreadCard({ t }: { t: ThreadSummary }) {
  const location = useLocation();
  return (
    <article className="card stack readingCard">
      <div className="row muted">
        <span>{t.type}</span>
        <span>·</span>
        <Link to={`/t/${t.topic.slug}`}>{t.topic.name}</Link>
        <span>·</span>
        <span>{t.score ?? "—"} votes</span>
        <span>·</span>
        <span>{t.reply_count} replies</span>
      </div>
      {t.type === "question" && t.has_accepted_answer && (
        <span className="badge" style={{ alignSelf: "flex-start" }}>
          ✓ Accepted answer
        </span>
      )}
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
        <Link
          to={`/threads/${t.id}`}
          state={{ feedReturn: location.pathname + location.search }}
        >
          {t.title}
        </Link>
      </h2>
      <p className="muted readingText readingExcerpt" style={{ margin: 0 }}>
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
      <div className="row">
        <SaveThreadButton
          id={t.id}
          title={t.title ?? "Conversation"}
          saved={t.is_saved}
        />
      </div>
    </article>
  );
}

export function FeedPage() {
  const { topicSlug } = useParams();
  const [sp, setSp] = useSearchParams();
  const topics = useQuery({
    queryKey: ["topics"],
    queryFn: () => api.getTopics(false),
    enabled: !!topicSlug,
  });
  const topicName = topics.data?.find(
    (topic) => topic.slug === topicSlug,
  )?.name;
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? (q.trim() ? "relevance" : "trending");
  const answerStatus = sp.get("answer_status") ?? "";
  const type = sp.get("type") ?? (answerStatus ? "question" : "");
  const filtered = !!(type || answerStatus);
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const query = useInfiniteQuery({
    queryKey: ["threads", topicSlug ?? "", q, sort, type, answerStatus],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api.getThreads({
        topic: topicSlug,
        type: type || undefined,
        answer_status: answerStatus || undefined,
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
        {topicSlug
          ? (topicName ?? "Topic conversations")
          : "Life has questions."}
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
      {q.trim() && (
        <button
          type="button"
          className="btn"
          onClick={() => {
            const next = new URLSearchParams(sp);
            next.delete("q");
            next.delete("sort");
            setSp(next);
          }}
        >
          Clear search
        </button>
      )}
      <div className="row" role="group" aria-label="Filter conversations">
        <label className="field" htmlFor="conversation-type">
          Conversation type
          <select
            id="conversation-type"
            value={type}
            onChange={(event) => {
              const next = new URLSearchParams(sp);
              if (event.target.value) next.set("type", event.target.value);
              else next.delete("type");
              if (event.target.value !== "question")
                next.delete("answer_status");
              setSp(next);
            }}
          >
            <option value="">All conversations</option>
            <option value="question">Questions</option>
            <option value="discussion">Discussions</option>
            {type && !["question", "discussion"].includes(type) && (
              <option value={type}>Unsupported type</option>
            )}
          </select>
        </label>
        {type !== "discussion" && (
          <label className="field" htmlFor="answer-status">
            Answer status
            <select
              id="answer-status"
              value={answerStatus}
              onChange={(event) => {
                const next = new URLSearchParams(sp);
                if (event.target.value) {
                  next.set("answer_status", event.target.value);
                  next.set("type", "question");
                } else next.delete("answer_status");
                setSp(next);
              }}
            >
              <option value="">Any answer status</option>
              <option value="unanswered">Awaiting an answer</option>
              <option value="answered">Has an answer</option>
              <option value="accepted">Accepted answer</option>
              {answerStatus &&
                !["unanswered", "answered", "accepted"].includes(
                  answerStatus,
                ) && (
                  <option value={answerStatus}>
                    Unsupported answer status
                  </option>
                )}
            </select>
          </label>
        )}
        {filtered && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              const next = new URLSearchParams(sp);
              next.delete("type");
              next.delete("answer_status");
              setSp(next);
            }}
          >
            Reset filters
          </button>
        )}
      </div>
      {answerStatus && type !== "discussion" && (
        <p className="muted">
          Only visible answers to the original question count. Replies to other
          answers don’t count.
        </p>
      )}
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
      <QueryError query={query} />
      {!query.isLoading && !query.error && !items.length && (
        <Empty>
          {filtered
            ? "No conversations match these filters."
            : q.trim()
              ? "No conversations match your search."
              : "No threads yet."}
        </Empty>
      )}
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
