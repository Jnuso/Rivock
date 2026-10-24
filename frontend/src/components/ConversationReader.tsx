import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Reply } from "../api";

type Reader = {
  collapsed: Set<string>;
  busyRoots: Set<string>;
  registerWriter: (id: string, root: string, writing: boolean) => void;
  toggle: (id: string) => void;
  collapseLoaded: (ids: string[]) => void;
  expandLoaded: (ids: string[]) => void;
  message: string;
  announce: (message: string) => void;
};
const ReaderContext = createContext<Reader | null>(null);

export function ConversationReaderProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [writers, setWriters] = useState<Map<string, string>>(() => new Map());
  const [message, announce] = useState("");
  const busyRoots = useMemo(() => new Set(writers.values()), [writers]);
  const registerWriter = useCallback(
    (id: string, root: string, writing: boolean) => {
      setWriters((previous) => {
        if (writing ? previous.get(id) === root : !previous.has(id))
          return previous;
        const next = new Map(previous);
        if (writing) next.set(id, root);
        else next.delete(id);
        return next;
      });
      if (writing)
        setCollapsed((previous) => {
          if (!previous.has(root)) return previous;
          const next = new Set(previous);
          next.delete(root);
          return next;
        });
    },
    [],
  );
  const expandLoaded = useCallback((ids: string[]) => {
    setCollapsed((previous) => {
      if (!ids.some((id) => previous.has(id))) return previous;
      const next = new Set(previous);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    announce("");
  }, []);
  const collapseLoaded = useCallback(
    (ids: string[]) => {
      setCollapsed(
        (previous) =>
          new Set([...previous, ...ids.filter((id) => !busyRoots.has(id))]),
      );
      announce(
        ids.some((id) => busyRoots.has(id))
          ? "Kept conversations open where you’re writing. Finish or cancel your reply or edit to collapse them."
          : "",
      );
    },
    [busyRoots],
  );
  const toggle = useCallback(
    (id: string) => {
      if (busyRoots.has(id)) return;
      setCollapsed((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      announce("");
    },
    [busyRoots],
  );
  return (
    <ReaderContext.Provider
      value={{
        collapsed,
        busyRoots,
        registerWriter,
        toggle,
        collapseLoaded,
        expandLoaded,
        message,
        announce,
      }}
    >
      {children}
    </ReaderContext.Provider>
  );
}

export function useConversationReader() {
  const value = useContext(ReaderContext);
  if (!value) throw new Error("Conversation reading requires its provider");
  return value;
}

export function ConversationReadingTools({
  replies,
  question,
}: {
  replies: Reply[];
  question: boolean;
}) {
  const reader = useConversationReader();
  if (!replies.length) return null;
  const noun = question ? "answers" : "replies";
  const ids = replies.map((reply) => reply.id);
  const jump = (id: string) => {
    reader.expandLoaded([id]);
    const focus = () => {
      const target = document.getElementById(`reply-${id}`);
      if (!target) {
        reader.announce("That reply is no longer in this view.");
        return;
      }
      target.scrollIntoView?.({ block: "start" });
      target.focus({ preventScroll: true });
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(focus);
    else window.setTimeout(focus, 0);
  };
  return (
    <section className="stack" aria-label="Conversation reading tools">
      <div className="row">
        <button
          type="button"
          className="btn"
          onClick={() => reader.collapseLoaded(ids)}
        >
          Collapse loaded {noun}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => reader.expandLoaded(ids)}
        >
          Expand loaded {noun}
        </button>
      </div>
      <p className="muted">
        {replies.length} loaded{" "}
        {question
          ? replies.length === 1
            ? "answer"
            : "answers"
          : replies.length === 1
            ? "reply"
            : "replies"}
        . Load more below to include more here.
      </p>
      <details className="card answerNavigator">
        <summary>Jump to {question ? "an answer" : "a reply"}</summary>
        <ol>
          {replies.map((reply) => (
            <li key={reply.id}>
              <button
                className="btn"
                type="button"
                onClick={() => jump(reply.id)}
              >
                {reply.state === "published" && reply.author
                  ? `@${reply.author.username}`
                  : `[Unavailable ${question ? "answer" : "reply"}]`}
                {" · "}
                {new Date(reply.published_at).toLocaleString()}
                {reply.is_accepted && " · Accepted answer"}
              </button>
            </li>
          ))}
        </ol>
      </details>
      <div role="status">{reader.message}</div>
    </section>
  );
}
