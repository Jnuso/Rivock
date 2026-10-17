import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatMarkdown,
  type MarkdownAction,
  type MarkdownEdit,
} from "../lib/markdownEditing";
import { Markdown } from "./Markdown";
import { cpLen, LIMITS } from "../lib/limits";
import {
  readDraft,
  writeDraft,
  forgetDraft,
  draftPersisted,
} from "../lib/drafts";

export function useDraft(key: string, initial = "") {
  const [value, setValue] = useState(() => readDraft(key, initial));
  const [persisted, setPersisted] = useState(() => draftPersisted(key));
  useEffect(() => {
    setValue(readDraft(key, initial));
    setPersisted(draftPersisted(key));
  }, [key]);
  useEffect(() => {
    if (!value || persisted) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [value, persisted]);
  const set = (next: string) => {
    setValue(next);
    setPersisted(writeDraft(key, next));
  };
  const clear = () => {
    setValue("");
    forgetDraft(key);
    setPersisted(true);
  };
  return { value, set, clear, persisted };
}

export function MarkdownEditor({
  id,
  label,
  value,
  onChange,
  max = LIMITS.body,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const len = useMemo(() => cpLen(value), [value]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<MarkdownEdit | null>(null);
  useLayoutEffect(() => {
    const next = pendingSelection.current;
    if (!next || next.value !== value || !inputRef.current) return;
    pendingSelection.current = null;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(next.start, next.end);
  }, [value]);

  const format = (action: MarkdownAction) => {
    const input = inputRef.current;
    if (!input || tab !== "write") return;
    const edit = formatMarkdown(
      value,
      { start: input.selectionStart, end: input.selectionEnd },
      action,
    );
    pendingSelection.current = edit;
    onChange(edit.value);
  };

  return (
    <div className="stack">
      <div className="row" role="toolbar" aria-label="Markdown formatting">
        <button
          type="button"
          className="btn"
          disabled={tab === "preview"}
          onClick={() => format("bold")}
        >
          Bold
        </button>
        <button
          type="button"
          className="btn"
          disabled={tab === "preview"}
          onClick={() => format("italic")}
        >
          Italic
        </button>
        <button
          type="button"
          className="btn"
          disabled={tab === "preview"}
          onClick={() => format("list")}
        >
          List
        </button>
        <button
          type="button"
          className="btn"
          disabled={tab === "preview"}
          onClick={() => format("quote")}
        >
          Quote
        </button>
        <button
          type="button"
          className="btn"
          disabled={tab === "preview"}
          onClick={() => format("link")}
        >
          Link
        </button>
        <button
          type="button"
          className="btn"
          aria-pressed={tab === "write"}
          onClick={() => setTab("write")}
        >
          Write
        </button>
        <button
          type="button"
          className="btn"
          aria-pressed={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>
      {tab === "write" ? (
        <label className="field" htmlFor={id}>
          <span>{label}</span>
          <textarea
            id={id}
            ref={inputRef}
            value={value}
            onChange={(e) => {
              pendingSelection.current = null;
              onChange(e.target.value);
            }}
            aria-describedby={`${id}-count`}
            aria-invalid={len > max}
            maxLength={max * 2}
          />
        </label>
      ) : (
        <div className="card" aria-live="polite">
          {value.trim() ? (
            <Markdown source={value} />
          ) : (
            <p className="muted">Nothing to preview.</p>
          )}
        </div>
      )}
      <p id={`${id}-count`} className={len > max ? "errorBox" : "muted"}>
        {len}/{max}
      </p>
    </div>
  );
}
