export const READING_KEY = "rivock.reading.v1";
export type ReadingPreferences = {
  version: 1;
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  textSize: "normal" | "large" | "extra-large";
};
export const DEFAULT_READING: ReadingPreferences = {
  version: 1,
  theme: "light",
  density: "comfortable",
  textSize: "normal",
};

export function parseReadingPreferences(raw: string | null) {
  if (raw === null) return { preferences: { ...DEFAULT_READING }, saved: true };
  try {
    if (raw.length > 2048) throw new Error("Invalid settings");
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !["light", "dark", "system"].includes(value.theme) ||
      !["comfortable", "compact"].includes(value.density) ||
      !["normal", "large", "extra-large"].includes(value.textSize)
    )
      throw new Error("Invalid settings");
    // Persist only known appearance values, never arbitrary storage properties.
    const preferences: ReadingPreferences = {
      version: 1,
      theme: value.theme,
      density: value.density,
      textSize: value.textSize,
    };
    return { preferences, saved: true };
  } catch {
    return { preferences: { ...DEFAULT_READING }, saved: false };
  }
}

export function readReadingPreferences() {
  try {
    return parseReadingPreferences(localStorage.getItem(READING_KEY));
  } catch {
    return { preferences: { ...DEFAULT_READING }, saved: false };
  }
}

export function saveReadingPreferences(preferences: ReadingPreferences) {
  try {
    localStorage.setItem(READING_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function systemPrefersDark() {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  } catch {
    return false;
  }
}

export function applyReadingPreferences(
  preferences: ReadingPreferences,
  dark = systemPrefersDark(),
) {
  const root = document.documentElement;
  root.dataset.theme =
    preferences.theme === "system"
      ? dark
        ? "dark"
        : "light"
      : preferences.theme;
  root.dataset.readingDensity = preferences.density;
  root.dataset.readingTextSize = preferences.textSize;
}

export function initializeReadingPreferences() {
  applyReadingPreferences(readReadingPreferences().preferences);
}
