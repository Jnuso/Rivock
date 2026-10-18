import { useEffect, useRef, useState } from "react";

type RecoveryDraft = {
  persisted: boolean;
  savedAt: number | null;
  retry: () => boolean;
};

export function DraftRecovery({
  draft,
  text,
  filename,
  hasContent,
}: {
  draft: RecoveryDraft;
  text: string;
  filename:
    | "rivock-thread-draft.txt"
    | "rivock-reply-draft.txt"
    | "rivock-profile-draft.txt";
  hasContent: boolean;
}) {
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const pending = useRef<{
    url: string;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const release = () => {
    if (pending.current) {
      clearTimeout(pending.current.timer);
      URL.revokeObjectURL(pending.current.url);
      pending.current = null;
    }
  };
  useEffect(() => () => release(), []);
  useEffect(() => {
    setNotice("");
    setFailed(false);
  }, [text]);
  if (!hasContent) return null;

  const download = () => {
    setNotice("");
    setFailed(false);
    release();
    let url: string | undefined;
    try {
      url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      const active = url;
      pending.current = {
        url,
        timer: setTimeout(() => {
          URL.revokeObjectURL(active);
          if (pending.current?.url === active) pending.current = null;
        }, 1000),
      };
      setNotice("Draft download requested. Check your browser’s downloads.");
    } catch {
      if (url) URL.revokeObjectURL(url);
      setFailed(true);
    }
  };
  return (
    <section className="stack" aria-label="Draft recovery">
      {draft.savedAt !== null && (
        <p className="muted" role="status">
          {draft.persisted
            ? "Draft saved in this tab for up to 24 hours."
            : "Draft recovery is limited to this open tab because browser storage is unavailable. You will be warned before closing it."}
        </p>
      )}
      <div className="row">
        {!draft.persisted && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              const saved = draft.retry();
              setNotice(
                saved
                  ? ""
                  : "Browser saving is still unavailable. Your text remains in this open tab.",
              );
            }}
          >
            Retry saving draft
          </button>
        )}
        <button type="button" className="btn" onClick={download}>
          Download draft
        </button>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Save a text copy on this device. Downloading does not publish or submit
        it.
      </p>
      {notice && <p role="status">{notice}</p>}
      {failed && (
        <p role="alert">
          The draft could not be downloaded. Select and copy your text from the
          editor before leaving this tab.
        </p>
      )}
    </section>
  );
}
