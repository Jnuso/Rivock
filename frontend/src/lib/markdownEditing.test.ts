import { expect, it } from "vitest";
import { formatMarkdown } from "./markdownEditing";

it("formats the selected words without changing the rest of the draft", () => {
  expect(
    formatMarkdown("Welcome new player today", { start: 8, end: 18 }, "bold"),
  ).toEqual({ value: "Welcome **new player** today", start: 10, end: 20 });
});

it("inserts and selects a placeholder at the cursor, then toggles its formatting off", () => {
  const added = formatMarkdown("Welcome !", { start: 8, end: 8 }, "italic");
  expect(added).toEqual({ value: "Welcome *text*!", start: 9, end: 13 });
  expect(formatMarkdown(added.value, added, "italic")).toEqual({
    value: "Welcome text!",
    start: 8,
    end: 12,
  });
});

it("keeps whitespace outside emphasis so a whole-line selection renders correctly", () => {
  expect(
    formatMarkdown("  welcome \nnext", { start: 0, end: 11 }, "bold"),
  ).toEqual({ value: "  **welcome** \nnext", start: 4, end: 11 });
});

it("uses textarea offsets without splitting an emoji", () => {
  expect(formatMarkdown("A 🎲 night", { start: 2, end: 4 }, "bold")).toEqual({
    value: "A **🎲** night",
    start: 4,
    end: 6,
  });
});

it("formats and unformats the current line while keeping the cursor in place", () => {
  const added = formatMarkdown("hello\nworld", { start: 8, end: 8 }, "list");
  expect(added).toEqual({ value: "hello\n- world", start: 10, end: 10 });
  expect(formatMarkdown(added.value, added, "list")).toEqual({
    value: "hello\nworld",
    start: 8,
    end: 8,
  });
});

it("formats each selected line without including an unselected following line", () => {
  expect(
    formatMarkdown("one\ntwo\nthree", { start: 0, end: 8 }, "quote"),
  ).toEqual({ value: "> one\n> two\nthree", start: 2, end: 12 });
});

it("handles a blank first line and a final empty line", () => {
  expect(formatMarkdown("\nnext", { start: 0, end: 0 }, "list")).toEqual({
    value: "- \nnext",
    start: 2,
    end: 2,
  });
  expect(formatMarkdown("first\n", { start: 6, end: 6 }, "quote")).toEqual({
    value: "first\n> ",
    start: 8,
    end: 8,
  });
});

it("turns the selection into a link label and selects the destination to replace", () => {
  const result = formatMarkdown(
    "Read the guide today",
    { start: 9, end: 14 },
    "link",
  );
  expect(result.value).toBe("Read the [guide](https://) today");
  expect(result.value.slice(result.start, result.end)).toBe("https://");
});

it("escapes brackets and backslashes in a link label without losing its displayed text", () => {
  const result = formatMarkdown("a [b] \\ c", { start: 0, end: 10 }, "link");
  expect(result.value).toBe("[a \\[b\\] \\\\ c](https://)");
  expect(result.value.slice(result.start, result.end)).toBe("https://");
});

it("adds and removes italics within bold text without stripping its bold markers", () => {
  const added = formatMarkdown(
    "Welcome **player**!",
    { start: 10, end: 16 },
    "italic",
  );
  expect(added).toEqual({ value: "Welcome ***player***!", start: 11, end: 17 });
  expect(formatMarkdown(added.value, added, "italic")).toEqual({
    value: "Welcome **player**!",
    start: 10,
    end: 16,
  });
});

it("can italicize part of a word using a marker that renders within words", () => {
  expect(formatMarkdown("gameplay", { start: 4, end: 8 }, "italic")).toEqual({
    value: "game*play*",
    start: 5,
    end: 9,
  });
});
