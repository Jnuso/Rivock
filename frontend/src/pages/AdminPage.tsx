import { type FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Markdown } from "../components/Markdown";
import { Empty, ErrorBox, Loading, QueryError } from "../components/States";
import { More, usePaged } from "../lib/paging";

const REASON_MAX = 1000;
const okReason = (r: string) => {
  const n = [...r.trim()].length;
  return n >= 1 && n <= REASON_MAX;
};
const snapStr = (s: Record<string, unknown> | null | undefined, k: string) =>
  typeof s?.[k] === "string" ? (s[k] as string) : "";

export function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const on = !!user && user.role === "admin" && user.status === "active";
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [repStatus, setRepStatus] = useState("open");
  const [subStatus, setSubStatus] = useState("");
  const [inspect, setInspect] = useState<{
    title: string | null;
    body_markdown: string | null;
    state: string;
  } | null>(null);
  const [targetKind, setTargetKind] = useState<"thread" | "reply" | "user">(
    "thread",
  );
  const [targetId, setTargetId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [topicSlug, setTopicSlug] = useState("");
  const [topicSort, setTopicSort] = useState(0);
  const [editName, setEditName] = useState<Record<string, string>>({});
  const [editSort, setEditSort] = useState<Record<string, number>>({});

  const reports = usePaged(
    ["admin", "reports", repStatus],
    (offset) =>
      api.adminReports({ status: repStatus || undefined, offset, limit: 20 }),
    on,
  );
  const subs = usePaged(
    ["admin", "subs", subStatus],
    (offset) =>
      api.adminSubmissions({
        status: subStatus || undefined,
        offset,
        limit: 20,
      }),
    on,
  );
  const audit = usePaged(
    ["admin", "audit"],
    (offset) => api.adminActions(offset, 20),
    on,
  );
  const statusQ = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => api.adminStatus(),
    enabled: on,
  });
  const topicsQ = useQuery({
    queryKey: ["admin", "topics"],
    queryFn: () => api.getTopics(true),
    enabled: on,
  });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin"] }),
      qc.invalidateQueries({ queryKey: ["topics"] }),
      qc.invalidateQueries({ queryKey: ["thread"] }),
      ...["user", "threads", "replies", "children", "submissions", "saved"].map(
        (k) => qc.invalidateQueries({ queryKey: [k] }),
      ),
    ]);
  };

  const run = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      setErr("");
      setMsg("Done");
      await invalidate();
    },
    onError: (e: Error) => {
      setMsg("");
      setErr(e.message || "Request failed");
    },
  });
  const busy = run.isPending;
  const needReason = () => {
    if (!okReason(reason)) {
      setErr("Reason required (1–1000 characters)");
      return false;
    }
    return true;
  };
  const withReason = (fn: (r: string) => Promise<unknown>) => {
    if (!needReason()) return;
    run.mutate(() => fn(reason.trim()));
  };

  if (!user) return <Empty>Sign in required.</Empty>;
  if (user.role !== "admin" || user.status !== "active")
    return <Empty>Admin access requires an active admin account.</Empty>;

  return (
    <div className="stack">
      <h1>Admin</h1>
      {err && <ErrorBox error={err} />}
      {msg && (
        <p className="badge" role="status">
          {msg}
        </p>
      )}

      <label className="field">
        Audit reason
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={REASON_MAX}
          disabled={busy}
          aria-required
        />
        <span className="muted">
          {[...reason.trim()].length}/{REASON_MAX}
        </span>
      </label>

      <section className="card stack" aria-labelledby="mod-status">
        <h2 id="mod-status">Moderation status</h2>
        {statusQ.isLoading && <Loading />}
        <QueryError query={statusQ} />
        {statusQ.data && (
          <>
            <p className="row">
              <span className="badge">{statusQ.data.moderation_mode}</span>
              <span className="badge">
                {statusQ.data.moderation_mode === "off"
                  ? "AI reviews off"
                  : statusQ.data.ai_paused
                    ? "paused"
                    : "running"}
              </span>
              <span className="muted">queue {statusQ.data.queue_count}</span>
              <span className="muted">
                ${statusQ.data.reserved_or_used_usd.toFixed(2)} / $
                {statusQ.data.monthly_budget_usd.toFixed(2)}
              </span>
            </p>
            <div className="row">
              <button
                type="button"
                className="btn btnPrimary"
                disabled={
                  busy ||
                  statusQ.data.moderation_mode === "off" ||
                  !statusQ.data.ai_paused
                }
                onClick={() => withReason((r) => api.adminPause(false, r))}
              >
                Resume AI
              </button>
              <button
                type="button"
                className="btn btnDanger"
                disabled={
                  busy ||
                  statusQ.data.moderation_mode === "off" ||
                  statusQ.data.ai_paused
                }
                onClick={() => withReason((r) => api.adminPause(true, r))}
              >
                Pause AI
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card stack" aria-labelledby="reports">
        <h2 id="reports">Reports</h2>
        <label className="field">
          Status
          <select
            value={repStatus}
            onChange={(e) => setRepStatus(e.target.value)}
            disabled={busy}
          >
            <option value="open">Open</option>
            <option value="resolved">resolved</option>
            <option value="dismissed">dismissed</option>
          </select>
        </label>
        {reports.isLoading && <Loading />}
        <QueryError query={reports} />
        {!reports.isLoading && !reports.error && !reports.items.length && (
          <Empty>No reports.</Empty>
        )}
        {reports.items.map((r) => (
          <article key={r.id} className="stack">
            <div className="row">
              <span className="badge">{r.status}</span>
              <span className="muted">{r.created_at}</span>
            </div>
            <p>
              <strong>Reason:</strong> {r.reason}
            </p>
            {r.detail && <p className="muted">{r.detail}</p>}
            <p className="muted">
              {r.thread_id && (
                <>
                  thread <code>{r.thread_id}</code>{" "}
                </>
              )}
              {r.reply_id && (
                <>
                  reply <code>{r.reply_id}</code>{" "}
                </>
              )}
              {r.user_id && (
                <>
                  user <code>{r.user_id}</code> (use manual user action; profile
                  needs username)
                </>
              )}
            </p>
            <div className="row">
              {(r.thread_id || r.reply_id) && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    run.mutate(async () => {
                      const kind = r.reply_id
                        ? ("replies" as const)
                        : ("threads" as const);
                      const id = r.reply_id || r.thread_id!;
                      const data = await api.adminInspect(kind, id);
                      setInspect(data);
                      return data;
                    })
                  }
                >
                  Inspect
                </button>
              )}
              <button
                type="button"
                className="btn btnPrimary"
                disabled={busy}
                onClick={() =>
                  withReason((rs) => api.decideReport(r.id, "resolved", rs))
                }
              >
                Resolve
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  withReason((rs) => api.decideReport(r.id, "dismissed", rs))
                }
              >
                Dismiss
              </button>
            </div>
          </article>
        ))}
        <More query={reports} />
        {inspect && (
          <div className="card stack" aria-label="Inspected content">
            <p className="badge">{inspect.state}</p>
            {inspect.title && <h3>{inspect.title}</h3>}
            {inspect.body_markdown != null && (
              <Markdown source={inspect.body_markdown} />
            )}
            <button
              type="button"
              className="btn"
              onClick={() => setInspect(null)}
            >
              Close inspect
            </button>
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="subs">
        <h2 id="subs">Submissions</h2>
        <p className="muted">No auto-approvals. Review each item.</p>
        <label className="field">
          Status
          <select
            value={subStatus}
            onChange={(e) => setSubStatus(e.target.value)}
            disabled={busy}
          >
            <option value="">Open</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="needs_review">needs review</option>
            <option value="published">published</option>
            <option value="cancelled">cancelled</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
        {subs.isLoading && <Loading />}
        <QueryError query={subs} />
        {!subs.isLoading && !subs.error && !subs.items.length && (
          <Empty>No submissions.</Empty>
        )}
        {subs.items.map((s) => {
          const terminal = !["pending", "processing", "needs_review"].includes(
            s.status,
          );
          const title = snapStr(s.snapshot, "title");
          const body =
            snapStr(s.snapshot, "body") || snapStr(s.snapshot, "body_markdown");
          const bio =
            snapStr(s.snapshot, "bio") || snapStr(s.snapshot, "bio_markdown");
          return (
            <article key={s.id} className="stack">
              <div className="row">
                <span className="badge">{s.status}</span>
                <span className="badge">{s.action}</span>
                <span className="muted">{s.reason_code}</span>
              </div>
              <p className="muted">
                content <code>{s.content_id}</code> thread{" "}
                <code>{s.thread_id}</code>
              </p>
              {title && <h3>{title}</h3>}
              {body && <Markdown source={body} />}
              {bio && <Markdown source={bio} />}
              <div className="row">
                <button
                  type="button"
                  className="btn btnPrimary"
                  disabled={busy || terminal}
                  onClick={() =>
                    withReason((rs) => api.adminDecision(s.id, "approve", rs))
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btnDanger"
                  disabled={busy || terminal}
                  onClick={() =>
                    withReason((rs) => api.adminDecision(s.id, "reject", rs))
                  }
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || terminal}
                  onClick={() => run.mutate(() => api.adminRetry(s.id))}
                  title="Retry uses backend default audit reason"
                >
                  Retry
                </button>
              </div>
            </article>
          );
        })}
        <More query={subs} />
      </section>

      <section className="card stack" aria-labelledby="manual">
        <h2 id="manual">Manual actions</h2>
        <div className="row">
          <label className="field">
            Target
            <select
              value={targetKind}
              onChange={(e) =>
                setTargetKind(e.target.value as typeof targetKind)
              }
              disabled={busy}
            >
              <option value="thread">thread</option>
              <option value="reply">reply</option>
              <option value="user">user</option>
            </select>
          </label>
          <label className="field">
            UUID
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={busy}
              aria-required
            />
          </label>
        </div>
        <div className="row">
          {targetKind !== "user" && (
            <>
              <button
                type="button"
                className="btn btnDanger"
                disabled={busy || !targetId.trim()}
                onClick={() =>
                  withReason((r) =>
                    targetKind === "thread"
                      ? api.removeThread(targetId.trim(), r)
                      : api.removeReply(targetId.trim(), r),
                  )
                }
              >
                Remove
              </button>
              <button
                type="button"
                className="btn btnPrimary"
                disabled={busy || !targetId.trim()}
                onClick={() =>
                  withReason((r) =>
                    targetKind === "thread"
                      ? api.restoreThread(targetId.trim(), r)
                      : api.restoreReply(targetId.trim(), r),
                  )
                }
              >
                Restore
              </button>
            </>
          )}
          {targetKind === "user" && (
            <>
              <button
                type="button"
                className="btn btnDanger"
                disabled={busy || !targetId.trim()}
                onClick={() =>
                  withReason((r) => api.suspendUser(targetId.trim(), r))
                }
              >
                Suspend
              </button>
              <button
                type="button"
                className="btn btnPrimary"
                disabled={busy || !targetId.trim()}
                onClick={() =>
                  withReason((r) => api.restoreUser(targetId.trim(), r))
                }
              >
                Restore
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || !targetId.trim()}
                onClick={() =>
                  withReason((r) => api.clearBio(targetId.trim(), r))
                }
              >
                Clear bio
              </button>
            </>
          )}
        </div>
      </section>

      <section className="card stack" aria-labelledby="topics">
        <h2 id="topics">Topics</h2>
        <form
          className="stack"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!topicName.trim() || !topicSlug.trim()) {
              setErr("Topic name and slug required");
              return;
            }
            run.mutate(() =>
              api.createTopic({
                name: topicName.trim(),
                slug: topicSlug.trim(),
                sort_order: topicSort,
              }),
            );
          }}
        >
          <div className="row">
            <label className="field">
              Name
              <input
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                disabled={busy}
                required
              />
            </label>
            <label className="field">
              Slug
              <input
                value={topicSlug}
                onChange={(e) => setTopicSlug(e.target.value)}
                disabled={busy}
                required
              />
            </label>
            <label className="field">
              Sort
              <input
                type="number"
                value={topicSort}
                onChange={(e) => setTopicSort(Number(e.target.value))}
                disabled={busy}
              />
            </label>
            <button type="submit" className="btn btnPrimary" disabled={busy}>
              Add topic
            </button>
          </div>
        </form>
        {topicsQ.isLoading && <Loading />}
        <QueryError query={topicsQ} />
        {topicsQ.data?.map((t) => (
          <div key={t.id} className="row">
            <span className="badge">{t.is_active ? "active" : "archived"}</span>
            <code>{t.slug}</code>
            <label className="field">
              Name
              <input
                value={editName[t.id] ?? t.name}
                disabled={busy}
                onChange={(e) =>
                  setEditName((m) => ({ ...m, [t.id]: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Sort
              <input
                type="number"
                value={editSort[t.id] ?? t.sort_order}
                disabled={busy}
                onChange={(e) =>
                  setEditSort((m) => ({ ...m, [t.id]: Number(e.target.value) }))
                }
              />
            </label>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                run.mutate(() =>
                  api.editTopic(t.id, {
                    name: (editName[t.id] ?? t.name).trim(),
                    sort_order: editSort[t.id] ?? t.sort_order,
                  }),
                )
              }
            >
              Save
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                run.mutate(() =>
                  api.editTopic(t.id, { is_active: !t.is_active }),
                )
              }
            >
              {t.is_active ? "Archive" : "Restore"}
            </button>
          </div>
        ))}
      </section>

      <section className="card stack" aria-labelledby="audit">
        <h2 id="audit">Audit log</h2>
        {audit.isLoading && <Loading />}
        <QueryError query={audit} />
        {!audit.isLoading && !audit.error && !audit.items.length && (
          <Empty>No actions.</Empty>
        )}
        {audit.items.map((a) => (
          <div key={a.id} className="row">
            <span className="badge">{a.action}</span>
            <code>{a.target_id}</code>
            <span className="muted">{a.actor_username}</span>
            <span className="muted">{a.created_at}</span>
            <span>{a.reason}</span>
          </div>
        ))}
        <More query={audit} />
      </section>
    </div>
  );
}
