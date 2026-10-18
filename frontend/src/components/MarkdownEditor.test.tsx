import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { MarkdownEditor, useDraft } from "./MarkdownEditor";
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

function EditorExample({
  initial = "",
  max = 10000,
}: {
  initial?: string;
  max?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <MarkdownEditor
      id="example"
      label="Your text"
      value={value}
      onChange={setValue}
      max={max}
    />
  );
}

it("formats a selected phrase and returns focus and selection to the editor", () => {
  render(<EditorExample initial="Welcome new player today" />);
  const input = screen.getByRole("textbox", {
    name: "Your text",
  }) as HTMLTextAreaElement;
  input.focus();
  input.setSelectionRange(8, 18);
  fireEvent.click(screen.getByRole("button", { name: "Bold" }));
  expect(input).toHaveValue("Welcome **new player** today");
  expect(input).toHaveFocus();
  expect([input.selectionStart, input.selectionEnd]).toEqual([10, 20]);
});

it("lets typing replace an inserted placeholder at the current cursor", () => {
  render(<EditorExample initial="Welcome !" />);
  const input = screen.getByRole("textbox", {
    name: "Your text",
  }) as HTMLTextAreaElement;
  input.setSelectionRange(8, 8);
  fireEvent.click(screen.getByRole("button", { name: "Italic" }));
  expect(input).toHaveValue("Welcome *text*!");
  expect(input.value.slice(input.selectionStart, input.selectionEnd)).toBe(
    "text",
  );
});

it("previews the formatted words and prevents hidden edits while previewing", () => {
  render(<EditorExample initial="welcome" />);
  const input = screen.getByRole("textbox", {
    name: "Your text",
  }) as HTMLTextAreaElement;
  input.setSelectionRange(0, 7);
  fireEvent.click(screen.getByRole("button", { name: "Bold" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(
    screen.getByText("welcome", { selector: "strong" }),
  ).toBeInTheDocument();
  for (const name of ["Bold", "Italic", "List", "Quote", "Link"]) {
    expect(screen.getByRole("button", { name })).toBeDisabled();
  }
  fireEvent.click(screen.getByRole("button", { name: "Write" }));
  expect(screen.getByRole("textbox", { name: "Your text" })).toHaveValue(
    "**welcome**",
  );
});

it("keeps over-limit text intact and exposes the existing validation after formatting", () => {
  render(<EditorExample initial="🎲" max={4} />);
  const input = screen.getByRole("textbox", {
    name: "Your text",
  }) as HTMLTextAreaElement;
  input.setSelectionRange(0, 2);
  fireEvent.click(screen.getByRole("button", { name: "Bold" }));
  expect(input).toHaveValue("**🎲**");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("5/4")).toBeInTheDocument();
});

it("renders an italic selection within a word and preserves surrounding letters", () => {
  render(<EditorExample initial="gameplay" />);
  const input = screen.getByRole("textbox", {
    name: "Your text",
  }) as HTMLTextAreaElement;
  input.setSelectionRange(4, 8);
  fireEvent.click(screen.getByRole("button", { name: "Italic" }));
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.getByText("play", { selector: "em" })).toBeInTheDocument();
});

it.each([
  ["b", "**selected**", false],
  ["i", "*selected*", true],
  ["k", "[selected](https://)", false],
])(
  "formats a selection with the %s shortcut without submitting",
  (key, expected, meta) => {
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <EditorExample initial="selected" />
      </form>,
    );
    const input = screen.getByRole("textbox", {
      name: "Your text",
    }) as HTMLTextAreaElement;
    input.focus();
    input.setSelectionRange(0, 8);
    expect(
      fireEvent.keyDown(input, { key, ctrlKey: !meta, metaKey: meta }),
    ).toBe(false);
    expect(input).toHaveValue(expected);
    expect(input).toHaveFocus();
    expect(submit).not.toHaveBeenCalled();
    if (key === "k")
      expect(input.value.slice(input.selectionStart, input.selectionEnd)).toBe(
        "https://",
      );
  },
);

it("leaves plain typing, alternate shortcuts and composing input to the browser", () => {
  render(<EditorExample initial="selected" />);
  const input = screen.getByRole("textbox", {
    name: "Your text",
  }) as HTMLTextAreaElement;
  input.setSelectionRange(0, 8);
  for (const options of [
    { key: "b" },
    { key: "b", ctrlKey: true, altKey: true },
    { key: "i", metaKey: true, shiftKey: true },
    { key: "a", ctrlKey: true },
    { key: "b", ctrlKey: true, isComposing: true },
  ])
    expect(fireEvent.keyDown(input, options)).toBe(true);
  expect(input).toHaveValue("selected");
});

it("does not repeatedly toggle formatting when a shortcut key is held down", () => {
  render(<EditorExample initial="selected" />);
  const input = screen.getByRole("textbox", {
    name: "Your text",
  }) as HTMLTextAreaElement;
  input.setSelectionRange(0, 8);
  fireEvent.keyDown(input, { key: "b", ctrlKey: true });
  fireEvent.keyDown(input, { key: "b", ctrlKey: true, repeat: true });
  expect(input).toHaveValue("**selected**");
  fireEvent.keyDown(input, { key: "b", ctrlKey: true });
  expect(input).toHaveValue("selected");
});
