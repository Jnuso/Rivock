const PREFIX = "rivock.draft.";
const TTL = 24 * 60 * 60 * 1000;

type Draft = { value: string; savedAt: number; persisted?: boolean };
const memory = new Map<string, Draft>();
const discarded = new Set<string>();
let clearStoragePending = false;

// Failed removals stay pending in this tab. Never read old stored text until
// those removals succeed, including after sign-out or an account change.
function flushDiscardedDrafts() {
  try {
    if (clearStoragePending) {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(PREFIX)) keys.push(key);
      }
      for (const key of keys) sessionStorage.removeItem(key);
      clearStoragePending = false;
    }
    for (const key of discarded) {
      sessionStorage.removeItem(PREFIX + key);
      discarded.delete(key);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearDraftMemory() {
  memory.clear();
}

export function clearAllDrafts() {
  memory.clear();
  clearStoragePending = true;
  flushDiscardedDrafts();
}

export function draftPersisted(key: string) {
  return memory.get(key)?.persisted ?? true;
}

export function readDraft(key: string, initial = "") {
  let draft: Draft | undefined = memory.get(key);
  if (!draft) {
    if (!flushDiscardedDrafts()) return initial;
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(PREFIX + key);
    } catch {
      // Inaccessibility does not establish that an existing draft is invalid.
      return initial;
    }
    try {
      if (raw) draft = JSON.parse(raw) as Draft;
    } catch {
      forgetDraft(key);
      return initial;
    }
  }
  if (
    draft &&
    typeof draft.value === "string" &&
    typeof draft.savedAt === "number" &&
    draft.savedAt <= Date.now() &&
    Date.now() - draft.savedAt < TTL
  ) {
    if (!memory.has(key)) memory.set(key, { ...draft, persisted: true });
    return draft.value;
  }
  forgetDraft(key);
  return initial;
}

export function writeDraft(key: string, value: string) {
  const draft: Draft = { value, savedAt: Date.now(), persisted: false };
  memory.set(key, draft);
  if (!flushDiscardedDrafts()) return false;
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(draft));
    draft.persisted = true;
    return true;
  } catch {
    return false;
  }
}

// Retry only the current in-memory draft. A discarded or previous-account copy
// must never be reconstructed from a stale component value.
export function retryDraft(key: string) {
  const draft = memory.get(key);
  return draft ? writeDraft(key, draft.value) : true;
}

export function draftSavedAt(key: string) {
  return memory.get(key)?.savedAt ?? null;
}

export function forgetDraft(key: string) {
  memory.delete(key);
  discarded.add(key);
  flushDiscardedDrafts();
}
