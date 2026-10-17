import { Link, useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Submission, ApiError } from "../api";
import { Empty, ErrorBox, Loading } from "../components/States";
import { useAuth } from "../auth/AuthContext";
import { SignInGate } from "../components/SignInGate";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { usePaged, More } from "../lib/paging";
import { cpLen } from "../lib/limits";
import { SubmissionReview } from "../components/SubmissionReview";

const labels: Record<string, string> = {
  create_thread: "New thread",
  edit_thread: "Thread edit",
  create_reply: "New reply",
  edit_reply: "Reply edit",
  edit_profile: "Profile edit",
};
export function SubmissionsListPage() {
  const { user } = useAuth();
  const q = usePaged(
    ["submissions"],
    (offset) => api.getSubmissions({ offset }),
    !!user,
  );
  if (!user) return <SignInGate title="My submissions" />;
  return (
    <div className="stack">
      <h1>My submissions</h1>
      <p className="muted">
        See the publication status and review history of your contributions.
      </p>
      {q.isLoading && <Loading />}
      {q.error && <ErrorBox error={q.error} />}
      {!q.isLoading && !q.items.length && <Empty>No submissions yet.</Empty>}
      {q.items.map((s) => (
        <Link className="card stack" key={s.id} to={`/submissions/${s.id}`}>
          <strong>{labels[s.action] ?? "Submission"}</strong>
          <span>
            {s.status} · {new Date(s.created_at).toLocaleString()}
          </span>
          <SubmissionReview submission={s} />
        </Link>
      ))}
      <More query={q} />
    </div>
  );
}

function Revise({ submission: s }: { submission: Submission }) {
  const data = s.snapshot ?? {};
  const [body, setBody] = useState(
    String(data.body_markdown ?? data.bio ?? ""),
  );
  const [title, setTitle] = useState(String(data.title ?? ""));
  const [topicId, setTopicId] = useState(String(data.topic_id ?? ""));
  const navigate = useNavigate();
  const isThread = s.action.endsWith("thread"),
    isProfile = s.action === "edit_profile";
  const topics = useQuery({
    queryKey: ["topics"],
    queryFn: () => api.getTopics(),
    enabled: isThread,
  });
  const mutation = useMutation<{ submission: Submission }, Error, void>({
    mutationFn: () => {
      if (s.action === "create_thread")
        return api.createThread({
          type: data.type === "discussion" ? "discussion" : "question",
          topic_id: topicId,
          title,
          body_markdown: body,
        });
      if (s.action === "edit_thread")
        return api.patchThread(s.content_id!, {
          base_revision: Number(data.base_revision),
          topic_id: topicId,
          title,
          body_markdown: body,
        });
      if (s.action === "create_reply")
        return api.createReply(String(data.thread_id), {
          body_markdown: body,
          response_to_reply_id: data.response_to_reply_id
            ? String(data.response_to_reply_id)
            : undefined,
        });
      if (s.action === "edit_reply")
        return api.patchReply(s.content_id!, {
          base_revision: Number(data.base_revision),
          body_markdown: body,
        });
      return api.patchMe({
        base_revision: Number(data.base_revision),
        bio: body,
        avatar_key: String(data.avatar_key) as
          "initials" | "blue" | "sage" | "rose" | "warm",
      });
    },
    onSuccess: (result) => navigate(`/submissions/${result.submission.id}`),
    onError: (e) => {
      if (e instanceof ApiError && e.body?.error.submission_id)
        navigate(`/submissions/${e.body.error.submission_id}`);
    },
  });
  const max = isProfile ? 300 : isThread ? 10000 : 5000;
  return (
    <section className="card stack">
      <h2>Revise your text</h2>
      <p className="muted">
        This sends a new submission. If the published version has changed,
        reopen it and make your edit there.
      </p>
      {isThread && (
        <>
          <label className="field">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            Topic
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
              {topics.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <MarkdownEditor
        id="revise-body"
        label={isProfile ? "Bio" : "Body"}
        value={body}
        onChange={setBody}
        max={max}
      />
      {mutation.error && <ErrorBox error={mutation.error} />}
      <button
        className="btn btnPrimary"
        disabled={
          mutation.isPending ||
          cpLen(body) > max ||
          (!isProfile && !body.trim()) ||
          (isThread && (!title.trim() || cpLen(title) > 200 || !topicId))
        }
        onClick={() => mutation.mutate()}
      >
        Submit revision
      </button>
    </section>
  );
}

export function SubmissionDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["submission", id],
    queryFn: () => api.getSubmission(id),
    enabled: !!user,
    refetchInterval: (query) =>
      document.visibilityState === "visible" &&
      ["pending", "processing"].includes(query.state.data?.status ?? "")
        ? 5000
        : false,
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelSubmission(id),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["submission", id] }),
  });
  if (!user) return <SignInGate title="Submission" />;
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return <Empty>Submission unavailable.</Empty>;
  const s = q.data,
    canCancel = ["pending", "processing", "needs_review"].includes(s.status);
  return (
    <div className="stack">
      <Link to="/submissions">← My submissions</Link>
      <h1>{labels[s.action] ?? "Submission"}</h1>
      <section className="card stack">
        <p role="status">
          Status: <strong>{s.status}</strong>
        </p>
        <SubmissionReview submission={s} detailed />
        {["pending", "processing"].includes(s.status) && (
          <p>
            Your text is private while it waits for a check. You can keep
            browsing.
          </p>
        )}
        {s.status === "needs_review" && (
          <p>This needs an administrator to review it.</p>
        )}
        {s.reason_code && <p>Reason: {s.reason_code.replaceAll("_", " ")}</p>}
        {!s.snapshot_available && (
          <p>The saved draft has expired or was erased.</p>
        )}
        {s.status === "published" && s.content_id && (
          <Link
            to={
              s.action === "edit_profile"
                ? "/settings"
                : `/threads/${s.thread_id ?? s.content_id}`
            }
          >
            Open published content
          </Link>
        )}
        {canCancel && (
          <button
            className="btn btnDanger"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            Cancel submission
          </button>
        )}
        {cancel.error && <ErrorBox error={cancel.error} />}
      </section>
      {s.snapshot && ["rejected", "cancelled"].includes(s.status) && (
        <Revise key={s.id} submission={s} />
      )}
    </div>
  );
}
