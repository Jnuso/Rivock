import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDraft } from "../components/MarkdownEditor";
import {
  clearAllDrafts,
  clearDraftMemory,
  draftPersisted,
  forgetDraft,
  readDraft,
  writeDraft,
} from "./drafts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  clearAllDrafts();
});

it("does not restore a discarded draft when blocked storage recovers", () => {
  writeDraft("discarded", "Synthetic text that was discarded");
  const editor = renderHook(() => useDraft("discarded"));
  const remove = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new Error("Storage is blocked");
    });
  act(() => editor.result.current.clear());
  expect(editor.result.current.value).toBe("");
  editor.unmount();
  remove.mockRestore();

  const reopened = renderHook(() => useDraft("discarded"));
  expect(reopened.result.current.value).toBe("");
  expect(sessionStorage.getItem("rivock.draft.discarded")).toBeNull();
});

it("keeps a restored draft in this tab if storage becomes unavailable", () => {
  writeDraft("restored", "Synthetic recovered text");
  clearDraftMemory();
  expect(readDraft("restored")).toBe("Synthetic recovered text");
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Storage is blocked");
  });
  expect(readDraft("restored")).toBe("Synthetic recovered text");
  get.mockRestore();
});

it("does not delete an unreadable draft merely because a read was blocked", () => {
  writeDraft("unreadable", "Synthetic retained copy");
  clearDraftMemory();
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Read temporarily blocked");
  });
  expect(readDraft("unreadable")).toBe("");
  get.mockRestore();
  expect(readDraft("unreadable")).toBe("Synthetic retained copy");
});

it("retains new memory-only text after discarding a blocked stored copy", () => {
  writeDraft("replaced", "Synthetic old copy");
  const remove = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new Error("Removal temporarily blocked");
    });
  forgetDraft("replaced");
  expect(writeDraft("replaced", "Synthetic new copy")).toBe(false);
  expect(readDraft("replaced")).toBe("Synthetic new copy");
  expect(draftPersisted("replaced")).toBe(false);
  remove.mockRestore();
  expect(writeDraft("replaced", "Synthetic new copy")).toBe(true);
  clearDraftMemory();
  expect(readDraft("replaced")).toBe("Synthetic new copy");
  expect(draftPersisted("replaced")).toBe(true);
});

it("clears all old-account drafts after storage recovers and preserves unrelated keys", () => {
  sessionStorage.setItem("another-app", "Keep this");
  writeDraft("first", "Synthetic former-account draft");
  writeDraft("second", "Synthetic former-account reply");
  const remove = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new Error("Removal temporarily blocked");
    });
  clearAllDrafts();
  expect(readDraft("first")).toBe("");
  expect(readDraft("second")).toBe("");
  remove.mockRestore();
  expect(readDraft("first")).toBe("");
  expect(readDraft("second")).toBe("");
  expect(sessionStorage.getItem("another-app")).toBe("Keep this");
});

it("keeps a new account's draft in memory until earlier cleanup succeeds", () => {
  writeDraft("same-editor", "Synthetic earlier account");
  const remove = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new Error("Removal temporarily blocked");
    });
  clearAllDrafts();
  expect(writeDraft("same-editor", "Synthetic new account")).toBe(false);
  expect(readDraft("same-editor")).toBe("Synthetic new account");
  remove.mockRestore();
  expect(writeDraft("same-editor", "Synthetic new account")).toBe(true);
  clearDraftMemory();
  expect(readDraft("same-editor")).toBe("Synthetic new account");
});

it("retries a partially completed cleanup without restoring the remaining old draft", () => {
  writeDraft("first", "Synthetic first");
  writeDraft("second", "Synthetic second");
  const nativeRemove = Storage.prototype.removeItem;
  const remove = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(function (this: Storage, key) {
      if (key === "rivock.draft.second")
        throw new Error("Partial removal failure");
      nativeRemove.call(this, key);
    });
  clearAllDrafts();
  expect(readDraft("second")).toBe("");
  remove.mockRestore();
  expect(readDraft("second")).toBe("");
  expect(sessionStorage.getItem("rivock.draft.second")).toBeNull();
});

it("removes the close-tab warning after discarding a memory-only draft", () => {
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage full");
  });
  const editor = renderHook(() => useDraft("warning"));
  act(() => editor.result.current.set("Synthetic memory-only text"));
  const before = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(true);
  act(() => editor.result.current.clear());
  const after = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
  set.mockRestore();
});
