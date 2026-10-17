import { Link } from "react-router-dom";
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
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["notifications"],
    initialPageParam: 0,
    enabled: !!user,
    queryFn: ({ pageParam }) => api.getNotifications({ offset: pageParam }),
    getNextPageParam: (page) => page.next_offset ?? undefined,
    refetchInterval: () =>
      document.visibilityState === "visible" ? 30000 : false,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: ["unread"] });
  };
  const mark = useMutation({
    mutationFn: (id: string) => api.markRead(id),
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
          disabled={!items.length || all.isPending}
          onClick={() => all.mutate()}
        >
          Mark all read
        </button>
      </div>
      {q.isLoading && <Loading />}
      <QueryError query={q} />
      {(mark.error || all.error) && (
        <ErrorBox error={mark.error || all.error} />
      )}
      {!q.isLoading && !q.error && !items.length && (
        <Empty>No notifications yet.</Empty>
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
            <time>{new Date(n.created_at).toLocaleString()}</time>
            {!n.read && (
              <button
                className="btn"
                disabled={mark.isPending}
                onClick={() => mark.mutate(n.id)}
              >
                Mark read
              </button>
            )}
          </div>
        </article>
      ))}
      <More query={q} />
    </div>
  );
}
