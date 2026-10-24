import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ReadingPreferencesControl,
  ReadingPreferencesProvider,
} from "./ReadingPreferences";
import {
  DEFAULT_READING,
  READING_KEY,
  initializeReadingPreferences,
  parseReadingPreferences,
} from "../lib/readingPreferences";
import { clearRivockDrafts } from "../auth/AuthContext";

const show = () =>
  render(
    <ReadingPreferencesProvider>
      <ReadingPreferencesControl />
    </ReadingPreferencesProvider>,
  );
const open = () =>
  fireEvent.click(screen.getByRole("button", { name: "Reading preferences" }));
beforeEach(() => {
  localStorage.removeItem(READING_KEY);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.removeItem(READING_KEY);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-reading-density");
  document.documentElement.removeAttribute("data-reading-text-size");
});

it("starts with the existing light appearance and persists only selected device settings across remounts", () => {
  localStorage.setItem("unrelated", "keep");
  const first = show();
  open();
  expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Comfortable" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Normal" })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
  fireEvent.click(screen.getByRole("radio", { name: "Extra large" }));
  expect(document.documentElement.dataset).toMatchObject({
    theme: "dark",
    readingDensity: "compact",
    readingTextSize: "extra-large",
  });
  expect(JSON.parse(localStorage.getItem(READING_KEY)!)).toEqual({
    version: 1,
    theme: "dark",
    density: "compact",
    textSize: "extra-large",
  });
  first.unmount();
  show();
  open();
  expect(screen.getByRole("radio", { name: "Extra large" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(localStorage.getItem("unrelated")).toBe("keep");
  localStorage.removeItem("unrelated");
});

it("applies saved appearance before rendering the app", () => {
  localStorage.setItem(
    READING_KEY,
    JSON.stringify({ ...DEFAULT_READING, theme: "dark", textSize: "large" }),
  );
  initializeReadingPreferences();
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.readingTextSize).toBe("large");
});

it("keeps choices in memory when saving fails and retries the latest choices after recovery", () => {
  const setter = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("blocked");
    });
  show();
  open();
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  fireEvent.click(screen.getByRole("radio", { name: "Large" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(screen.getByRole("status")).toHaveTextContent("couldn’t be saved");
  fireEvent.click(
    screen.getByRole("button", { name: "Retry saving preferences" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent("couldn’t be saved");
  setter.mockRestore();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry saving preferences" }),
  );
  expect(screen.queryByText(/couldn’t be saved/)).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(READING_KEY)!)).toMatchObject({
    theme: "dark",
    textSize: "large",
  });
});

it("survives denied reads and a reset whose save fails without claiming persistence", () => {
  localStorage.setItem(
    READING_KEY,
    JSON.stringify({ ...DEFAULT_READING, theme: "dark" }),
  );
  const getter = vi
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(() => {
      throw new Error("blocked");
    });
  show();
  open();
  expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  getter.mockRestore();
  const setter = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("blocked");
    });
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Reset reading preferences" }),
  );
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(screen.getByRole("status")).toHaveTextContent("couldn’t be saved");
  setter.mockRestore();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry saving preferences" }),
  );
  expect(JSON.parse(localStorage.getItem(READING_KEY)!)).toEqual(
    DEFAULT_READING,
  );
});

it("responds to System changes only when System is selected and releases its listener", () => {
  let listener: (() => void) | undefined;
  const media = {
    matches: true,
    addEventListener: vi.fn((_name, handler) => {
      listener = handler;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  const page = show();
  open();
  expect(document.documentElement.dataset.theme).toBe("light");
  fireEvent.click(screen.getByRole("radio", { name: "System" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  media.matches = false;
  act(() => listener?.());
  expect(document.documentElement.dataset.theme).toBe("light");
  fireEvent.click(screen.getByRole("radio", { name: "Light" }));
  media.matches = true;
  act(() => listener?.());
  expect(document.documentElement.dataset.theme).toBe("light");
  fireEvent.click(screen.getByRole("radio", { name: "System" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  page.unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith("change", listener);
});

it("handles missing System support, Escape focus, outside clicks and focus leaving the panel", () => {
  vi.stubGlobal("matchMedia", undefined);
  show();
  open();
  const light = screen.getByRole("radio", { name: "Light" });
  light.focus();
  fireEvent.keyDown(light, { key: "Escape" });
  const button = screen.getByRole("button", { name: "Reading preferences" });
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute("aria-expanded", "false");
  open();
  fireEvent.click(screen.getByRole("radio", { name: "System" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  fireEvent.pointerDown(document.body);
  expect(button).toHaveAttribute("aria-expanded", "false");
  open();
  fireEvent.blur(button, { relatedTarget: document.body });
  expect(button).toHaveAttribute("aria-expanded", "false");
});

it("resets only appearance preferences and synchronizes its own storage events", () => {
  localStorage.setItem("rivock.draft.sample", "private draft");
  show();
  open();
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Reset reading preferences" }),
  );
  expect(JSON.parse(localStorage.getItem(READING_KEY)!)).toEqual(
    DEFAULT_READING,
  );
  expect(localStorage.getItem("rivock.draft.sample")).toBe("private draft");
  fireEvent(
    window,
    new StorageEvent("storage", { key: "other", newValue: "bad" }),
  );
  expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  fireEvent(
    window,
    new StorageEvent("storage", {
      key: READING_KEY,
      newValue: JSON.stringify({ ...DEFAULT_READING, theme: "dark" }),
    }),
  );
  expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  fireEvent(
    window,
    new StorageEvent("storage", { key: READING_KEY, newValue: null }),
  );
  expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  localStorage.removeItem("rivock.draft.sample");
});

it.each([
  "null",
  "[]",
  "invalid",
  JSON.stringify({ ...DEFAULT_READING, version: 2 }),
  JSON.stringify({ ...DEFAULT_READING, theme: "url(evil)" }),
  JSON.stringify({ ...DEFAULT_READING, textSize: 20 }),
  JSON.stringify({ ...DEFAULT_READING, density: "tiny" }),
  "x".repeat(2049),
])("falls back safely for invalid stored settings: %s", (raw) => {
  const result = parseReadingPreferences(raw);
  expect(result).toEqual({ preferences: DEFAULT_READING, saved: false });
});

it("drops unknown fields instead of retaining account/content metadata", () => {
  expect(
    parseReadingPreferences(
      JSON.stringify({
        ...DEFAULT_READING,
        account: "unrelated",
        title: "not appearance",
      }),
    ).preferences,
  ).toEqual(DEFAULT_READING);
});

it("keeps device appearance when sign-out or account-switch draft cleanup runs", () => {
  localStorage.setItem(
    READING_KEY,
    JSON.stringify({ ...DEFAULT_READING, theme: "dark" }),
  );
  localStorage.setItem("rivock.draft.example", "fictional old-account draft");
  clearRivockDrafts();
  expect(localStorage.getItem("rivock.draft.example")).toBeNull();
  expect(
    parseReadingPreferences(localStorage.getItem(READING_KEY)).preferences
      .theme,
  ).toBe("dark");
  show();
  open();
  expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
});
