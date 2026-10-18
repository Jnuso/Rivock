import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export function conversationPath(threadId: string, replyId?: string) {
  return `/threads/${encodeURIComponent(threadId)}${replyId ? `#reply-${encodeURIComponent(replyId)}` : ""}`;
}

export function conversationViewPath(
  threadId: string,
  sort: string,
  replyId?: string,
) {
  const url = new URL(
    conversationPath(threadId, replyId),
    window.location.origin,
  );
  if (sort !== "recommended") url.searchParams.set("reply_sort", sort);
  return url.pathname + url.search + url.hash;
}

export function CopyLink({
  path,
  label,
}: {
  path: string;
  label: "Thread link" | "Reply link";
}) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "manual">(
    "idle",
  );
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const inputId = useId();
  // Build from the public route only: do not copy search terms, tokens or other fragments.
  const url = new URL(path, window.location.origin).href;
  useEffect(() => {
    generation.current++;
    setState("idle");
    return () => {
      generation.current++;
    };
  }, [path]);
  useLayoutEffect(() => {
    if (state === "manual") {
      input.current?.focus();
      input.current?.select();
    }
  }, [state]);
  const copy = async () => {
    const request = generation.current;
    setState("copying");
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      if (generation.current === request) setState("copied");
    } catch {
      if (generation.current === request) setState("manual");
    }
  };
  return (
    <div className="stack copyLink">
      <button
        ref={button}
        type="button"
        className="btn"
        aria-label={`Copy ${label.toLowerCase()}`}
        disabled={state === "copying"}
        onClick={() => void copy()}
      >
        {state === "copying" ? "Copying…" : "Copy link"}
      </button>
      {state === "copying" && (
        <button
          type="button"
          className="btn"
          onClick={() => {
            generation.current++;
            setState("manual");
          }}
        >
          Show link instead
        </button>
      )}
      <span role="status" className="muted">
        {state === "copied"
          ? "Link copied."
          : state === "manual"
            ? "Select and copy the link below."
            : ""}
      </span>
      {state === "manual" && (
        <div className="stack copyLinkFallback">
          <label className="field" htmlFor={inputId}>
            {label}
            <input
              ref={input}
              id={inputId}
              type="text"
              inputMode="url"
              spellCheck={false}
              value={url}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setState("idle");
              button.current?.focus();
            }}
          >
            Close link
          </button>
        </div>
      )}
    </div>
  );
}
