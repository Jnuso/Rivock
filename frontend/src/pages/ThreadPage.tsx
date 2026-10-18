import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { DraftRecovery } from "../components/DraftRecovery";
import { api, type Reply, ApiError } from "../api";
import { Markdown } from "../components/Markdown";
import { MarkdownEditor, useDraft } from "../components/MarkdownEditor";
import { Empty, ErrorBox, Loading, QueryError } from "../components/States";
import { useAuth } from "../auth/AuthContext";
import { cpLen, LIMITS } from "../lib/limits";
import { usePaged, More } from "../lib/paging";
import { ReportControl } from "../components/ReportControl";
import {
  CopyLink,
  conversationPath,
  conversationViewPath,
} from "../components/CopyLink";
import { readFeedReturn, feedReturnState } from "../lib/feedReturn";

function useRefresh(threadId: string) {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      ["thread", threadId],
      ["replies", threadId],
      ["children"],
      ["reply-context"],
      ["threads"],
      ["saved"],
      ["notifications"],
      ["unread"],
    ])
      void qc.invalidateQueries({ queryKey: key });
  };
}

function Votes({
  score,
  value,
  mine,
  available,
  onVote,
  onClear,
}: {
  score: number | null;
  value: 1 | -1 | null;
  mine: boolean;
  available: boolean;
  onVote: (value: 1 | -1) => Promise<unknown>;
  onClear: () => Promise<unknown>;
}) {
  const { user } = useAuth();
  const mutation = useMutation({
    mutationFn: (next: 1 | -1) => (next === value ? onClear() : onVote(next)),
  });
  if (!available) return null;
  return (
    <div className="stack">
      <div className="row" aria-label="Votes">
        <button
          className="btn"
          disabled={!user || mine || mutation.isPending}
          aria-label="Upvote"
          aria-pressed={value === 1}
          onClick={() => mutation.mutate(1)}
        >
          ↑
        </button>
        <span aria-live="polite">{score ?? "—"}</span>
        <button
          className="btn"
          disabled={!user || mine || mutation.isPending}
          aria-label="Downvote"
          aria-pressed={value === -1}
          onClick={() => mutation.mutate(-1)}
        >
          ↓
        </button>
      </div>
      {mutation.error && <ErrorBox error={mutation.error} />}
    </div>
  );
}

function ReplyComposer({
  threadId,
  target,
  onDone,
}: {
  threadId: string;
  target?: Reply;
  onDone: () => void;
}) {
  const { user, configured, signIn, authMessage } = useAuth();
  const location = useLocation();
  const draft = useDraft(`reply:${threadId}:${target?.id ?? "direct"}`);
  const navigate = useNavigate();
  const refresh = useRefresh(threadId);
  const mutation = useMutation({
    mutationFn: () =>
      api.createReply(threadId, {
        body_markdown: draft.value,
        response_to_reply_id: target?.id,
      }),
    onSuccess: (result) => {
      draft.clear();
      refresh();
      onDone();
      if (result.submission.status !== "published")
        navigate(`/submissions/${result.submission.id}`);
      else if (result.content)
        navigate(
          conversationViewPath(
            threadId,
            new URLSearchParams(location.search).get("reply_sort") ??
              "recommended",
            result.content.id,
          ),
          {
            state: feedReturnState(readFeedReturn(location.state)),
          },
        );
    },
    onError: (e) => {
      if (e instanceof ApiError && e.body?.error.submission_id)
        navigate(`/submissions/${e.body.error.submission_id}`);
    },
  });
  if (!user)
    return (
      <div className="stack">
        <p className="muted">Sign in to join the conversation.</p>
        <button
          className="btn btnPrimary"
          disabled={!configured}
          onClick={() => void signIn(`/threads/${threadId}`)}
        >
          Sign in to reply
        </button>
        {!configured && <p className="muted">{authMessage}</p>}
      </div>
    );
  if (user.status !== "active")
    return <p>Participation is unavailable for this account.</p>;
  return (
    <div className="stack">
      {target && (
        <p className="muted">
          Replying to @{target.author?.username ?? "unavailable"}
        </p>
      )}
      <MarkdownEditor
        id={`reply-body-${target?.id ?? "direct"}`}
        label="Your reply"
        value={draft.value}
        onChange={draft.set}
        max={LIMITS.reply}
      />
      <p className="muted">
        Replies can be reported for moderator review. Avoid sharing personal
        information.
      </p>
      {mutation.error && <ErrorBox error={mutation.error} />}
      <DraftRecovery
        draft={draft}
        hasContent={!!draft.value}
        filename="rivock-reply-draft.txt"
        text={draft.value}
      />
      <div className="row">
        <button
          className="btn btnPrimary"
          disabled={
            !draft.value.trim() ||
            cpLen(draft.value) > LIMITS.reply ||
            mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Submitting…" : "Submit reply"}
        </button>
        <button
          className="btn"
          onClick={() => {
            draft.clear();
            onDone();
          }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function ReplyNode({
  reply,
  threadId,
  canReply,
  questionOwner,
  acceptedId,
}: {
  reply: Reply;
  threadId: string;
  canReply: boolean;
  questionOwner: boolean;
  acceptedId: string | null;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [responding, setResponding] = useState(false);
  const [editing, setEditing] = useState(false);
  const draft = useDraft(`edit-reply:${reply.id}`, reply.body_markdown ?? "");
  const revisionDraft = useDraft(`edit-reply-base:${reply.id}`);
  const baseRevision = Number(revisionDraft.value) || reply.revision;
  const refresh = useRefresh(threadId);
  const navigate = useNavigate();
  const children = usePaged(
    ["children", reply.id],
    (offset) => api.getChildren(reply.id, offset),
    expanded,
  );
  const mine = user?.id === reply.author?.id;
  const visible = reply.state === "published";
  const changed = async (work: Promise<unknown>) => {
    const result = await work;
    refresh();
    return result;
  };
  const accept = useMutation({
    mutationFn: () =>
      changed(
        acceptedId === reply.id
          ? api.clearAccepted(threadId)
          : api.acceptAnswer(threadId, reply.id),
      ),
  });
  const remove = useMutation({
    mutationFn: () => changed(api.deleteReply(reply.id)),
    onSuccess: () => {
      draft.clear();
      revisionDraft.clear();
      setEditing(false);
    },
  });
  const edit = useMutation({
    mutationFn: () =>
      api.patchReply(reply.id, {
        base_revision: baseRevision,
        body_markdown: draft.value,
      }),
    onSuccess: (result) => {
      draft.clear();
      revisionDraft.clear();
      setEditing(false);
      refresh();
      if (result.submission.status !== "published")
        navigate(`/submissions/${result.submission.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.body?.error.submission_id)
        navigate(`/submissions/${e.body.error.submission_id}`);
      else if (
        e instanceof ApiError &&
        e.body?.error.code === "revision_conflict"
      )
        refresh();
    },
  });
  return (
    <div className="stack" id={`reply-${reply.id}`}>
      <article className="card stack">
        <div className="row muted">
          {reply.author ? (
            <Link to={`/u/${reply.author.username}`}>
              @{reply.author.username}
            </Link>
          ) : (
            <span>[unavailable]</span>
          )}
          {reply.author?.is_bot && (
            <span className="badge">Fictional demo</span>
          )}
          <Link
            to={conversationViewPath(
              threadId,
              new URLSearchParams(location.search).get("reply_sort") ??
                "recommended",
              reply.id,
            )}
            state={feedReturnState(readFeedReturn(location.state))}
            aria-label={
              (reply.author
                ? "Open reply from @" + reply.author.username
                : "Open unavailable reply") +
              ", " +
              new Date(reply.published_at).toLocaleString()
            }
          >
            <time dateTime={reply.published_at}>
              {new Date(reply.published_at).toLocaleString()}
            </time>
          </Link>
          {reply.edited_at && <span>edited</span>}
          {reply.is_accepted && (
            <span className="badge">✓ Accepted answer</span>
          )}
        </div>
        {reply.response_to && (
          <p className="muted">In response to @{reply.response_to.username}</p>
        )}
        {visible && reply.body_markdown ? (
          <Markdown source={reply.body_markdown} />
        ) : (
          <p className="muted">[{reply.state} reply]</p>
        )}
        <div className="row">
          <Votes
            score={reply.score}
            value={reply.my_vote}
            mine={mine}
            available={visible && canReply}
            onVote={(v) => changed(api.voteReply(reply.id, v))}
            onClear={() => changed(api.clearReplyVote(reply.id))}
          />
          {visible && (
            <CopyLink
              path={conversationPath(threadId, reply.id)}
              label="Reply link"
            />
          )}
          {canReply && visible && (
            <button className="btn" onClick={() => setResponding((v) => !v)}>
              Reply
            </button>
          )}
          {questionOwner && reply.depth === 1 && visible && (
            <button
              className="btn"
              disabled={accept.isPending}
              onClick={() => accept.mutate()}
            >
              {acceptedId === reply.id
                ? "Clear accepted answer"
                : "Accept answer"}
            </button>
          )}
          {mine && visible && (
            <>
              <button
                className="btn"
                onClick={() => {
                  if (!editing && !revisionDraft.value) {
                    draft.set(reply.body_markdown ?? "");
                    revisionDraft.set(String(reply.revision));
                  }
                  setEditing((v) => !v);
                }}
              >
                Edit
              </button>
              <button
                className="btn btnDanger"
                disabled={remove.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete your reply text? Other replies will remain.",
                    )
                  )
                    remove.mutate();
                }}
              >
                Delete
              </button>
            </>
          )}
          {user && visible && !mine && (
            <ReportControl target={{ reply_id: reply.id }} />
          )}
        </div>
        {(accept.error || remove.error || edit.error) && (
          <ErrorBox error={accept.error || remove.error || edit.error} />
        )}
        {editing && (
          <div className="stack">
            <MarkdownEditor
              id={`edit-${reply.id}`}
              label="Edit reply"
              value={draft.value}
              onChange={draft.set}
              max={LIMITS.reply}
            />
            <DraftRecovery
              draft={{
                ...draft,
                persisted: draft.persisted && revisionDraft.persisted,
                savedAt: draft.savedAt ?? revisionDraft.savedAt,
                retry: () => {
                  const textSaved = draft.retry();
                  const revisionSaved = revisionDraft.retry();
                  return textSaved && revisionSaved;
                },
              }}
              hasContent={!!draft.value}
              filename="rivock-reply-draft.txt"
              text={[
                "Original revision: " + baseRevision,
                "",
                draft.value,
              ].join("\n")}
            />
            {baseRevision !== reply.revision && (
              <section className="stack" aria-label="Compare reply versions">
                <h3>A newer reply version is available</h3>
                <p>
                  Your draft above uses revision {baseRevision}. The current
                  published revision is {reply.revision}:
                </p>
                <Markdown source={reply.body_markdown ?? ""} />
                <div className="row">
                  <button
                    className="btn"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Replace your reply draft with the current published version?",
                        )
                      )
                        return;
                      draft.set(reply.body_markdown ?? "");
                      revisionDraft.set(String(reply.revision));
                      edit.reset();
                    }}
                  >
                    Load current reply
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      revisionDraft.set(String(reply.revision));
                      edit.reset();
                    }}
                  >
                    Keep my reply draft against current version
                  </button>
                </div>
              </section>
            )}
            <div className="row">
              <button
                className="btn btnPrimary"
                disabled={
                  edit.isPending ||
                  baseRevision !== reply.revision ||
                  !draft.value.trim() ||
                  cpLen(draft.value) > LIMITS.reply
                }
                onClick={() => edit.mutate()}
              >
                Submit edit
              </button>
              <button className="btn" onClick={() => setEditing(false)}>
                Cancel edit
              </button>
              <button className="btn" onClick={refresh}>
                Check latest reply
              </button>
            </div>
          </div>
        )}
        {responding && (
          <ReplyComposer
            threadId={threadId}
            target={reply}
            onDone={() => {
              setResponding(false);
              setExpanded(true);
            }}
          />
        )}
        {reply.child_count > 0 && (
          <button
            className="btn"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide replies" : `Show ${reply.child_count} replies`}
          </button>
        )}
      </article>
      {expanded && (
        <div className="replyBranch stack">
          {children.isLoading && <Loading />}
          <QueryError query={children} />
          {children.items.map((r) => (
            <ReplyNode
              key={r.id}
              reply={r}
              threadId={threadId}
              canReply={canReply}
              questionOwner={questionOwner}
              acceptedId={acceptedId}
            />
          ))}
          <More query={children} />
        </div>
      )}
    </div>
  );
}

function LinkedConversation({
  chain,
  threadId,
  available,
  mine,
  acceptedId,
  question,
  returnTo,
  replySort,
}: {
  chain: Reply[];
  threadId: string;
  available: boolean;
  mine: boolean;
  acceptedId: string | null;
  question: boolean;
  returnTo: string | null;
  replySort: string;
}) {
  const destination = useRef<HTMLDivElement>(null);
  const target = chain[chain.length - 1];
  useEffect(() => {
    destination.current?.scrollIntoView?.({ block: "start" });
    destination.current?.focus({ preventScroll: true });
  }, [target?.id]);
  if (!target) return <Empty>Reply unavailable.</Empty>;
  return (
    <section className="stack" aria-label="Linked conversation">
      <h3>Conversation leading to this reply</h3>
      <p className="muted">
        Parent replies are shown here so you can follow the conversation.
      </p>
      {chain.slice(0, -1).map((parent) => (
        <details className="card" open key={parent.id}>
          <summary>
            Level {parent.depth} · @{parent.author?.username ?? "unavailable"}
          </summary>
          {parent.body_markdown ? (
            <Markdown source={parent.body_markdown} />
          ) : (
            <p className="muted">[{parent.state} reply]</p>
          )}
          <Link
            to={conversationViewPath(threadId, replySort, parent.id)}
            state={feedReturnState(returnTo)}
          >
            Open this reply
          </Link>
        </details>
      ))}
      <div
        ref={destination}
        tabIndex={-1}
        className="linkedReply"
        aria-label="Linked reply"
      >
        <ReplyNode
          key={target.id}
          reply={target}
          threadId={threadId}
          canReply={available}
          questionOwner={mine && available && question}
          acceptedId={acceptedId}
        />
      </div>
      <Link
        className="btn"
        to={conversationViewPath(threadId, replySort)}
        state={feedReturnState(returnTo)}
      >
        Show all {question ? "answers" : "replies"}
      </Link>
    </section>
  );
}

export function ThreadPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const returnTo = readFeedReturn(location.state);
  const [replyParams, setReplyParams] = useSearchParams();
  const replySort = replyParams.get("reply_sort") ?? "recommended";
  const linkedId = /^#reply-([a-f0-9-]{36})$/i.exec(location.hash)?.[1] ?? "";
  const context = useQuery({
    queryKey: ["reply-context", id, linkedId],
    queryFn: () => api.getReplyContext(linkedId),
    enabled: !!linkedId,
  });
  const refresh = useRefresh(id);
  const thread = useQuery({
    queryKey: ["thread", id],
    queryFn: () => api.getThread(id),
    enabled: !!id,
  });
  const replies = usePaged(
    ["replies", id, replySort],
    (offset) => api.getReplies(id, offset, 20, replySort),
    !!id && !linkedId,
  );
  const save = useMutation({
    mutationFn: () =>
      thread.data?.is_saved ? api.unsaveThread(id) : api.saveThread(id),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => api.deleteThread(id),
    onSuccess: refresh,
  });
  if (thread.isLoading) return <Loading />;
  if (thread.error) return <QueryError query={thread} />;
  if (!thread.data) return <Empty>Thread unavailable.</Empty>;
  const t = thread.data,
    mine = user?.id === t.author?.id,
    available = t.state === "published";
  const changed = async (work: Promise<unknown>) => {
    const result = await work;
    refresh();
    return result;
  };
  return (
    <div className="stack">
      <Link to={returnTo ?? "/"}>
        {returnTo ? "← Back to results" : "← All conversations"}
      </Link>
      <p className="muted">
        <Link to={`/t/${t.topic.slug}`}>{t.topic.name}</Link> · {t.type}
      </p>
      <h1>{t.title}</h1>
      <div className="row muted">
        {t.author && (
          <Link to={`/u/${t.author.username}`}>@{t.author.username}</Link>
        )}
        {t.author?.is_bot && <span className="badge">Fictional demo</span>}
        <time dateTime={t.published_at}>
          {new Date(t.published_at).toLocaleString()}
        </time>
        {t.edited_at && <span>edited</span>}
      </div>
      {available && t.type === "question" && t.accepted_reply_id && (
        <aside className="card row acceptedAnswer" aria-label="Accepted answer">
          <span className="badge">✓ Accepted answer</span>
          {linkedId === t.accepted_reply_id ? (
            <span>You’re viewing the accepted answer below.</span>
          ) : (
            <Link
              to={conversationViewPath(id, replySort, t.accepted_reply_id)}
              state={feedReturnState(returnTo)}
            >
              View accepted answer →
            </Link>
          )}
        </aside>
      )}
      {t.body_markdown ? (
        <div className="card">
          <Markdown source={t.body_markdown} />
        </div>
      ) : (
        <Empty>This thread is {t.state}. Other replies remain below.</Empty>
      )}
      <div className="row">
        <Votes
          score={t.score}
          value={t.my_vote}
          mine={mine}
          available={available}
          onVote={(v) => changed(api.voteThread(id, v))}
          onClear={() => changed(api.clearThreadVote(id))}
        />
        {available && (
          <CopyLink path={conversationPath(id)} label="Thread link" />
        )}
        {user && (available || t.is_saved) && (
          <button
            className="btn"
            aria-pressed={t.is_saved}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {t.is_saved ? "Saved ✓" : "Save thread"}
          </button>
        )}
        {mine && available && (
          <>
            <Link className="btn" to={`/threads/${id}/edit`}>
              Edit thread
            </Link>
            <button
              className="btn btnDanger"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Delete your thread text? Other replies will remain.",
                  )
                )
                  remove.mutate();
              }}
            >
              Delete
            </button>
          </>
        )}
        {user && available && !mine && (
          <ReportControl target={{ thread_id: id }} />
        )}
      </div>
      {(save.error || remove.error) && (
        <ErrorBox error={save.error || remove.error} />
      )}
      <h2>
        {t.type === "question" ? "Answers" : "Replies"}{" "}
        <span className="muted">({t.reply_count})</span>
      </h2>
      {!linkedId && (
        <>
          <div className="row" role="group" aria-label="Reply order">
            {[
              ["recommended", "Recommended"],
              ["newest", "Newest"],
              ["oldest", "Oldest"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={replySort === value ? "btn btnPrimary" : "btn"}
                aria-pressed={replySort === value}
                onClick={() => {
                  if (replySort === value) return;
                  const next = new URLSearchParams(replyParams);
                  if (value === "recommended") next.delete("reply_sort");
                  else next.set("reply_sort", value);
                  setReplyParams(next, {
                    state: feedReturnState(returnTo),
                    preventScrollReset: true,
                  });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="muted">
            {t.type === "question" && t.accepted_reply_id
              ? "Accepted answer first. "
              : ""}
            {replySort === "recommended"
              ? "Recommended balances votes and freshness."
              : replySort === "oldest"
                ? "Replies are shown oldest first."
                : replySort === "newest"
                  ? "Replies are shown newest first."
                  : "Choose an order to reset this view."}
          </p>
        </>
      )}
      {linkedId && context.isLoading && <Loading />}
      {linkedId && <QueryError query={context} />}
      {linkedId &&
        context.data &&
        (context.data.thread_id === id ? (
          <LinkedConversation
            chain={context.data.replies}
            threadId={id}
            available={available}
            mine={mine}
            acceptedId={t.accepted_reply_id}
            question={t.type === "question"}
            returnTo={returnTo}
            replySort={replySort}
          />
        ) : (
          <Empty>This reply belongs to another conversation.</Empty>
        ))}
      {linkedId && (context.error || context.data?.thread_id !== id) && (
        <Link
          to={conversationViewPath(id, replySort)}
          state={feedReturnState(returnTo)}
        >
          Show all replies
        </Link>
      )}
      {!linkedId && replies.isLoading && <Loading />}
      {!linkedId && <QueryError query={replies} />}
      {!linkedId &&
        !replies.isLoading &&
        !replies.error &&
        !replies.items.length && (
          <Empty>No replies yet. Start the conversation.</Empty>
        )}
      {!linkedId &&
        replies.items.map((r) => (
          <ReplyNode
            key={r.id}
            reply={r}
            threadId={id}
            canReply={available}
            questionOwner={mine && available && t.type === "question"}
            acceptedId={t.accepted_reply_id}
          />
        ))}
      {!linkedId && <More query={replies} />}
      {available && (
        <section className="card stack">
          <h2>Add a reply</h2>
          <ReplyComposer threadId={id} onDone={() => undefined} />
        </section>
      )}
    </div>
  );
}
