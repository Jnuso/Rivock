import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDraft } from "./MarkdownEditor";
import { clearDraftMemory } from "../lib/drafts";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  clearDraftMemory();
});

it("restores a recent draft and discards a draft older than a day", () => {
  const first = renderHook(() => useDraft("reply"));
  act(() => first.result.current.set("My unfinished reply"));
  first.unmount();
  const restored = renderHook(() => useDraft("reply"));
  expect(restored.result.current.value).toBe("My unfinished reply");
  restored.unmount();
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
  const expired = renderHook(() => useDraft("reply"));
  expect(expired.result.current.value).toBe("");
});

it("keeps editing and discarding usable when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Disabled");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Full");
  });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new Error("Disabled");
  });
  const draft = renderHook(() => useDraft("private"));
  act(() => draft.result.current.set("Still typing"));
  expect(draft.result.current.value).toBe("Still typing");
  draft.unmount();
  const reopened = renderHook(() => useDraft("private"));
  expect(reopened.result.current.value).toBe("Still typing");
  const close = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(close);
  expect(close.defaultPrevented).toBe(true);
  act(() => reopened.result.current.clear());
  expect(reopened.result.current.value).toBe("");
});
