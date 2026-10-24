import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_READING,
  READING_KEY,
  applyReadingPreferences,
  parseReadingPreferences,
  readReadingPreferences,
  saveReadingPreferences,
  systemPrefersDark,
  type ReadingPreferences,
} from "../lib/readingPreferences";

type ReadingState = ReturnType<typeof readReadingPreferences>;
type ReadingContextValue = ReadingState & {
  update: (part: Partial<Omit<ReadingPreferences, "version">>) => void;
  retry: () => void;
  reset: () => void;
};
const ReadingContext = createContext<ReadingContextValue | null>(null);

export function ReadingPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState(readReadingPreferences);
  const current = useRef(state);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  useLayoutEffect(() => {
    applyReadingPreferences(state.preferences, systemDark);
  }, [state.preferences, systemDark]);
  useEffect(() => {
    let media: MediaQueryList | undefined;
    const changed = () => setSystemDark(media?.matches ?? false);
    try {
      media = window.matchMedia?.("(prefers-color-scheme: dark)");
      changed();
      media?.addEventListener("change", changed);
    } catch {
      /* System theme support is optional. */
    }
    return () => media?.removeEventListener?.("change", changed);
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key !== READING_KEY && event.key !== null) return;
      const next = parseReadingPreferences(event.newValue);
      current.current = next;
      setState(next);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const commit = useCallback((preferences: ReadingPreferences) => {
    const next = { preferences, saved: saveReadingPreferences(preferences) };
    current.current = next;
    setState(next);
  }, []);
  const update = useCallback(
    (part: Partial<Omit<ReadingPreferences, "version">>) => {
      commit({ ...current.current.preferences, ...part });
    },
    [commit],
  );
  const retry = useCallback(
    () => commit(current.current.preferences),
    [commit],
  );
  const reset = useCallback(() => commit({ ...DEFAULT_READING }), [commit]);
  return (
    <ReadingContext.Provider value={{ ...state, update, retry, reset }}>
      {children}
    </ReadingContext.Provider>
  );
}

export function ReadingPreferencesControl() {
  const value = useContext(ReadingContext);
  if (!value) throw new Error("Reading preferences require their provider");
  const { preferences, saved, update, retry, reset } = value;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div
      className="readingPreferences"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        className="btn"
        type="button"
        ref={button}
        aria-expanded={open}
        aria-controls="reading-preferences-panel"
        onClick={() => setOpen(!open)}
      >
        Reading preferences
      </button>
      {open && (
        <section
          className="card stack readingPanel"
          id="reading-preferences-panel"
          aria-label="Reading preferences"
        >
          <p className="muted">
            These choices apply on this device, including when you’re signed
            out.
          </p>
          <fieldset>
            <legend>Theme</legend>
            <div className="row">
              {(["light", "dark", "system"] as const).map((theme) => (
                <label className="readingChoice" key={theme}>
                  <input
                    type="radio"
                    name="reading-theme"
                    value={theme}
                    checked={preferences.theme === theme}
                    onChange={() => update({ theme })}
                  />
                  {theme[0].toUpperCase() + theme.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Layout</legend>
            <div className="row">
              {(["comfortable", "compact"] as const).map((density) => (
                <label className="readingChoice" key={density}>
                  <input
                    type="radio"
                    name="reading-density"
                    value={density}
                    checked={preferences.density === density}
                    onChange={() => update({ density })}
                  />
                  {density[0].toUpperCase() + density.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Post text size</legend>
            <div className="row">
              {(
                [
                  ["normal", "Normal"],
                  ["large", "Large"],
                  ["extra-large", "Extra large"],
                ] as const
              ).map(([textSize, label]) => (
                <label className="readingChoice" key={textSize}>
                  <input
                    type="radio"
                    name="reading-text-size"
                    value={textSize}
                    checked={preferences.textSize === textSize}
                    onChange={() => update({ textSize })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {!saved && (
            <div role="status" className="stack">
              <p>
                These settings work for this visit, but couldn’t be saved on
                this device.
              </p>
              <button type="button" className="btn" onClick={retry}>
                Retry saving preferences
              </button>
            </div>
          )}
          <div className="row">
            <button type="button" className="btn" onClick={reset}>
              Reset reading preferences
            </button>
            <button type="button" className="btn" onClick={close}>
              Close preferences
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
