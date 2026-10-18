import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DraftRecovery } from "../components/DraftRecovery";
import { api, ApiError } from "../api";
import { MarkdownEditor, useDraft } from "../components/MarkdownEditor";
import { ErrorBox, Loading } from "../components/States";
import { useAuth } from "../auth/AuthContext";
import { cpLen, LIMITS } from "../lib/limits";
import { Markdown } from "../components/Markdown";

const TYPES = ["question", "discussion"] as const;
type Form = {
  title: string;
  body: string;
  type: "question" | "discussion";
  topicId: string;
  baseRevision: number | null;
};
function readForm(raw: string): Form {
  const empty: Form = {
    title: "",
    body: "",
    type: "question",
    topicId: "",
    baseRevision: null,
  };
  try {
    const value = JSON.parse(raw) as Partial<Form>;
    return {
      title: typeof value.title === "string" ? value.title : "",
      body: typeof value.body === "string" ? value.body : "",
      topicId: typeof value.topicId === "string" ? value.topicId : "",
      type: value.type === "discussion" ? "discussion" : "question",
      baseRevision:
        typeof value.baseRevision === "number" &&
        Number.isInteger(value.baseRevision) &&
        value.baseRevision > 0
          ? value.baseRevision
          : null,
    };
  } catch {
    return empty;
  }
}

export function ComposerPage({ mode }: { mode: "new" | "edit" }) {
  const { id = "" } = useParams();
  return <ThreadComposer key={`${mode}:${id}`} mode={mode} id={id} />;
}

function ThreadComposer({ mode, id }: { mode: "new" | "edit"; id: string }) {
  const { user, configured, signIn, authMessage } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const topics = useQuery({
    queryKey: ["topics"],
    queryFn: () => api.getTopics(false),
  });
  const existing = useQuery({
    queryKey: ["thread", id],
    queryFn: () => api.getThread(id),
    enabled: mode === "edit" && !!id,
  });

  const draft = useDraft(`thread-form:${mode}:${id}`);
  const form = readForm(draft.value);
  const update = (part: Partial<Form>) =>
    draft.set(JSON.stringify({ ...form, ...part }));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && existing.data && form.baseRevision === null) {
      update({
        type: existing.data.type,
        topicId: form.topicId || existing.data.topic.id,
        title: form.title || existing.data.title,
        body: form.body || existing.data.body_markdown || "",
        baseRevision: existing.data.revision,
      });
    }
  }, [existing.data, mode, form.baseRevision]);

  const save = useMutation({
    mutationFn: async () => {
      if (mode === "edit") {
        return api.patchThread(id, {
          base_revision: form.baseRevision!,
          topic_id: form.topicId,
          title: form.title.trim(),
          body_markdown: form.body,
        });
      }
      return api.createThread({
        type: form.type,
        topic_id: form.topicId,
        title: form.title.trim(),
        body_markdown: form.body,
      });
    },
    onSuccess: (res) => {
      draft.clear();
      void qc.invalidateQueries();
      if (res.submission.status === "published" && res.content) {
        navigate(`/threads/${res.content.id}`);
        return;
      }
      navigate(`/submissions/${res.submission.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.body?.error.submission_id) {
        navigate(`/submissions/${e.body.error.submission_id}`);
        return;
      }
      setError(e instanceof Error ? e.message : "Save failed");
      if (
        mode === "edit" &&
        e instanceof ApiError &&
        e.body?.error.code === "revision_conflict"
      )
        void existing.refetch();
    },
  });

  if (!user) {
    return (
      <div className="stack">
        <h1>Compose</h1>
        <button
          type="button"
          className="btn btnPrimary"
          onClick={() => {
            if (!configured) window.alert(authMessage);
            else void signIn(mode === "edit" ? `/threads/${id}/edit` : "/new");
          }}
        >
          Sign in to continue
        </button>
      </div>
    );
  }

  if (mode === "edit" && existing.isLoading) return <Loading />;
  if (topics.isLoading) return <Loading />;
  if (topics.error || existing.error)
    return <ErrorBox error={topics.error || existing.error} />;
  if (mode === "edit" && existing.data?.author?.id !== user.id)
    return <ErrorBox error="Only the author can edit this thread." />;
  if (user.status !== "active")
    return <ErrorBox error="Participation is unavailable for this account." />;

  const titleOk = !!form.title.trim() && cpLen(form.title) <= LIMITS.title;
  const bodyOk = !!form.body.trim() && cpLen(form.body) <= LIMITS.body;
  const conflict =
    mode === "edit" &&
    form.baseRevision !== null &&
    form.baseRevision !== existing.data?.revision;
  const canSubmit =
    titleOk &&
    bodyOk &&
    !!form.topicId &&
    !conflict &&
    (mode === "new" || form.baseRevision !== null);

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>
        {mode === "edit" ? "Edit thread" : "New thread"}
      </h1>
      {mode === "new" && (
        <label className="field" htmlFor="type">
          <span>Type</span>
          <select
            id="type"
            value={form.type}
            onChange={(e) => update({ type: e.target.value as Form["type"] })}
            required
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field" htmlFor="topic">
        <span>Topic</span>
        <select
          id="topic"
          value={form.topicId}
          onChange={(e) => update({ topicId: e.target.value })}
          required
        >
          <option value="">Select a topic</option>
          {topics.data
            ?.filter((t) => t.is_active)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </label>
      <label className="field" htmlFor="title">
        <span id="title-label">Title</span>
        <input
          id="title"
          aria-labelledby="title-label"
          aria-describedby="title-count"
          maxLength={LIMITS.title * 2}
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
          required
          aria-invalid={!titleOk}
        />
        <span className="muted" id="title-count">
          {cpLen(form.title)}/{LIMITS.title}
        </span>
      </label>
      <MarkdownEditor
        id="body"
        label="Body"
        value={form.body}
        onChange={(body) => update({ body })}
      />
      <p className="muted">
        Contributions can be reported for moderator review. Avoid sharing
        personal information in public posts.
      </p>
      {error && <ErrorBox error={error} />}
      <DraftRecovery
        draft={draft}
        hasContent={!!(form.title || form.body)}
        filename="rivock-thread-draft.txt"
        text={[
          "Rivock thread draft",
          "Type: " + form.type,
          "Topic: " +
            (topics.data?.find((topic) => topic.id === form.topicId)?.name ??
              "Not selected"),
          ...(form.baseRevision === null
            ? []
            : ["Original revision: " + form.baseRevision]),
          "",
          form.title,
          "",
          form.body,
        ].join("\n")}
      />
      {mode === "edit" && (
        <button
          className="btn"
          disabled={existing.isFetching}
          onClick={() => void existing.refetch()}
        >
          Check latest version
        </button>
      )}
      {conflict && existing.data && (
        <section className="card stack" aria-label="Compare versions">
          <h2>A newer version is available</h2>
          <p>
            Your draft above uses revision {form.baseRevision}. Review the
            current published revision {existing.data.revision} below before
            continuing.
          </p>
          <h3>{existing.data.title}</h3>
          <Markdown source={existing.data.body_markdown ?? ""} />
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                if (
                  !window.confirm(
                    "Replace your draft with the current published version?",
                  )
                )
                  return;
                update({
                  title: existing.data!.title,
                  body: existing.data!.body_markdown ?? "",
                  topicId: existing.data!.topic.id,
                  baseRevision: existing.data!.revision,
                });
                setError(null);
                save.reset();
              }}
            >
              Load current version
            </button>
            <button
              className="btn"
              onClick={() => {
                update({ baseRevision: existing.data!.revision });
                setError(null);
                save.reset();
              }}
            >
              Keep my draft against current version
            </button>
          </div>
        </section>
      )}
      <button
        type="button"
        className="btn btnPrimary"
        disabled={!canSubmit || save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Submitting…" : "Submit"}
      </button>
      <button
        className="btn"
        onClick={() => {
          draft.clear();
          navigate("/");
        }}
      >
        Discard draft
      </button>
    </div>
  );
}
