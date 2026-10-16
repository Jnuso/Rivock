import { useEffect, useMemo, useState } from "react";
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

  const wrap = (prefix: string, suffix = prefix) => {
    onChange(`${value}${prefix}text${suffix}`);
  };

  return (
    <div className="stack">
      <div className="row" role="toolbar" aria-label="Markdown formatting">
        <button type="button" className="btn" onClick={() => wrap("**")}>
          Bold
        </button>
        <button type="button" className="btn" onClick={() => wrap("_")}>
          Italic
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onChange(`${value}\n\n- `)}
        >
          List
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onChange(`${value}\n\n> `)}
        >
          Quote
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onChange(`${value}[label](https://)`)}
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
            value={value}
            onChange={(e) => onChange(e.target.value)}
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
