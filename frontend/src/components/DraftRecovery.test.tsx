import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DraftRecovery } from "./DraftRecovery";
import { useDraft } from "./MarkdownEditor";
import {
  clearAllDrafts,
  clearDraftMemory,
  draftSavedAt,
  readDraft,
  retryDraft,
  writeDraft,
} from "../lib/drafts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  clearAllDrafts();
});
const recovery = { persisted: true, savedAt: null, retry: vi.fn(() => true) };
const props = {
  draft: recovery,
  text: "Synthetic draft",
  filename: "rivock-reply-draft.txt" as const,
  hasContent: true,
};
function downloads() {
  const create = vi.fn((_blob: Blob) => "blob:local-draft");
  const revoke = vi.fn();
  class DraftURL extends URL {
    static createObjectURL = create;
    static revokeObjectURL = revoke;
  }
  vi.stubGlobal("URL", DraftURL);
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  return { create, revoke, click };
}
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

it("does not claim an untouched published value has been saved as a draft", () => {
  const hook = renderHook(() => useDraft("edit", "Published text"));
  expect(hook.result.current.savedAt).toBeNull();
  render(<DraftRecovery {...props} draft={hook.result.current} />);
  expect(screen.getByRole("button", { name: "Download draft" })).toBeEnabled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("hides controls for an empty editor", () => {
  render(<DraftRecovery {...props} hasContent={false} />);
  expect(
    screen.queryByRole("region", { name: "Draft recovery" }),
  ).not.toBeInTheDocument();
});

it("retries saving memory-only text without editing it and removes the close-tab warning", () => {
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  function Editor() {
    const draft = useDraft("retry");
    return (
      <>
        <textarea
          aria-label="Draft"
          value={draft.value}
          onChange={(e) => draft.set(e.target.value)}
        />
        <DraftRecovery
          {...props}
          draft={draft}
          text={draft.value}
          hasContent={!!draft.value}
        />
      </>
    );
  }
  render(<Editor />);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "New 📝 text" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Retry saving draft" }));
  expect(
    screen.getByText(/Draft recovery is limited to this open tab/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Browser saving is still unavailable/),
  ).toBeInTheDocument();
  const before = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(true);
  set.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Retry saving draft" }));
  expect(screen.getByRole("status")).toHaveTextContent("saved in this tab");
  expect(
    screen.queryByRole("button", { name: "Retry saving draft" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("New 📝 text");
  const after = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
  clearDraftMemory();
  expect(readDraft("retry")).toBe("New 📝 text");
});

it("does not resurrect a discarded draft from a stale retry callback", () => {
  const hook = renderHook(() => useDraft("discard"));
  act(() => hook.result.current.set("Discard me"));
  const stale = hook.result.current.retry;
  act(() => hook.result.current.clear());
  act(() => stale());
  expect(hook.result.current.value).toBe("");
  expect(hook.result.current.savedAt).toBeNull();
  expect(sessionStorage.getItem("rivock.draft.discard")).toBeNull();
});

it("retries pending account cleanup before persisting the new account's current draft", () => {
  writeDraft("same", "Old account text");
  const remove = vi
    .spyOn(Storage.prototype, "removeItem")
    .mockImplementation(() => {
      throw new Error("Blocked");
    });
  clearAllDrafts();
  expect(retryDraft("same")).toBe(true);
  expect(draftSavedAt("same")).toBeNull();
  expect(writeDraft("same", "New account text")).toBe(false);
  expect(retryDraft("same")).toBe(false);
  remove.mockRestore();
  expect(retryDraft("same")).toBe(true);
  clearDraftMemory();
  expect(readDraft("same")).toBe("New account text");
});

it("downloads only the current Unicode text with a fixed plain-text filename", async () => {
  const { create, click, revoke } = downloads();
  const view = render(
    <DraftRecovery {...props} text={"Title 📝\n\nFirst line\nSecond line"} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Download draft" }));
  const blob = create.mock.calls[0][0] as Blob;
  expect(blob.type).toBe("text/plain;charset=utf-8");
  expect(await blobText(blob)).toBe("Title 📝\n\nFirst line\nSecond line");
  const link = click.mock.instances[0] as HTMLAnchorElement;
  expect(link.download).toBe("rivock-reply-draft.txt");
  expect(link.href).toBe("blob:local-draft");
  expect(link.isConnected).toBe(false);
  expect(screen.getByRole("status")).toHaveTextContent("download requested");
  view.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:local-draft");
});

it("exports changed text on the next request and clears the old notice", async () => {
  const { create, revoke } = downloads();
  const view = render(<DraftRecovery {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Download draft" }));
  view.rerender(<DraftRecovery {...props} text="Replacement draft" />);
  expect(screen.queryByText(/download requested/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Download draft" }));
  expect(await blobText(create.mock.calls[1][0] as Blob)).toBe(
    "Replacement draft",
  );
  expect(revoke).toHaveBeenCalledWith("blob:local-draft");
});

it("shows a useful error without claiming a download when the browser refuses it", () => {
  const { create } = downloads();
  create.mockImplementation(() => {
    throw new Error("Unsupported");
  });
  render(<DraftRecovery {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Download draft" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Select and copy your text",
  );
  expect(screen.queryByText(/download requested/)).not.toBeInTheDocument();
});

it("cleans up the temporary link and URL after a failed download activation", () => {
  const { click, revoke } = downloads();
  click.mockImplementation(() => {
    throw new Error("Blocked");
  });
  render(<DraftRecovery {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Download draft" }));
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(document.querySelector("a[download]")).toBeNull();
  expect(revoke).toHaveBeenCalledWith("blob:local-draft");
});
