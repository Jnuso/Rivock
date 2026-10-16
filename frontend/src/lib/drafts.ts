const PREFIX = "rivock.draft.";
const TTL = 24 * 60 * 60 * 1000;
type Draft = { value: string; savedAt: number; persisted?: boolean };
const memory = new Map<string, Draft>();

export function clearDraftMemory() {
  memory.clear();
}
export function draftPersisted(key: string) {
  return memory.get(key)?.persisted ?? true;
}

export function readDraft(key: string, initial = "") {
  let draft: Draft | undefined = memory.get(key);
  if (!draft) {
    try {
      const raw = sessionStorage.getItem(PREFIX + key);
      if (raw) draft = JSON.parse(raw) as Draft;
    } catch {
      /* A blocked store falls back to this tab's memory. */
    }
  }
  if (
    draft &&
    typeof draft.value === "string" &&
    typeof draft.savedAt === "number" &&
    draft.savedAt <= Date.now() &&
    Date.now() - draft.savedAt < TTL
  )
    return draft.value;
  forgetDraft(key);
  return initial;
}

export function writeDraft(key: string, value: string) {
  const draft: Draft = { value, savedAt: Date.now(), persisted: false };
  memory.set(key, draft);
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(draft));
    draft.persisted = true;
    return true;
  } catch {
    return false;
  }
}

export function forgetDraft(key: string) {
  memory.delete(key);
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* Memory was still cleared. */
  }
}
