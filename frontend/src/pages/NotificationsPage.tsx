import { Link, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../api";
import { Empty, ErrorBox, Loading, QueryError } from "../components/States";
import { useAuth } from "../auth/AuthContext";
import { SignInGate } from "../components/SignInGate";
import { More } from "../lib/paging";

export function NotificationsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const unreadOnly = params.get("view") === "unread";
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["notifications", unreadOnly],
    initialPageParam: 0,
    enabled: !!user,
    queryFn: ({ pageParam }) =>
      api.getNotifications({ offset: pageParam, unread_only: unreadOnly }),
    getNextPageParam: (page) => page.next_offset ?? undefined,
    refetchInterval: () =>
      document.visibilityState === "visible" ? 30000 : false,
  });
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["notifications"] }),
      qc.invalidateQueries({ queryKey: ["unread"] }),
    ]);
  const mark = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      api.markRead(id, read),
    onSuccess: refresh,
  });
  const all = useMutation({
    mutationFn: () => api.readAll(q.data!.pages[0].as_of),
    onSuccess: refresh,
  });
  if (!user) return <SignInGate title="Notifications" />;
  const seen = new Set<string>();
  const items = (q.data?.pages.flatMap((p) => p.items) ?? []).filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
  return (
    <div className="stack">
      <div className="row">
        <h1>Notifications</h1>
        <button
          className="btn"
          disabled={!items.length || all.isPending || mark.isPending}
          onClick={() => all.mutate()}
        >
          Mark all read
        </button>
      </div>
      <div className="row" role="group" aria-label="Notification filter">
        {[false, true].map((unread) => (
          <button
            key={String(unread)}
            type="button"
            className={unreadOnly === unread ? "btn btnPrimary" : "btn"}
            aria-pressed={unreadOnly === unread}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (unread) next.set("view", "unread");
              else next.delete("view");
              setParams(next);
            }}
          >
            {unread ? "Unread" : "All"}
          </button>
        ))}
      </div>
      <p className="muted">
        Mark all read includes notifications on other pages.
      </p>
      {q.isLoading && <Loading />}
      <QueryError query={q} />
      {(mark.error || all.error) && (
        <ErrorBox error={mark.error || all.error} />
      )}
      {!q.isLoading && !q.error && !items.length && (
        <Empty>
          {unreadOnly ? "You’re all caught up." : "No notifications yet."}
        </Empty>
      )}
      {items.map((n) => (
        <article className="card stack" key={n.id}>
          <p>
            {n.available && n.target_id ? (
              <Link
                to={`/threads/${n.target_id}${n.reply_id ? `#reply-${n.reply_id}` : ""}`}
              >
                {n.summary}
              </Link>
            ) : (
              n.summary
            )}
          </p>
          <div className="row muted">
            <time dateTime={n.created_at}>
              {new Date(n.created_at).toLocaleString()}
            </time>
            <span className={n.read ? "muted" : "badge"}>
              {n.read ? "Read" : "Unread"}
            </span>
            <button
              type="button"
              className="btn"
              disabled={mark.isPending || all.isPending}
              onClick={() => mark.mutate({ id: n.id, read: !n.read })}
            >
              {n.read ? "Mark unread" : "Mark read"}
            </button>
          </div>
        </article>
      ))}
      <More query={q} />
    </div>
  );
}
