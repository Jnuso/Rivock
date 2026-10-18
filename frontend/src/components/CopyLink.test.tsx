import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  CopyLink,
  conversationPath,
  conversationViewPath,
  profilePath,
} from "./CopyLink";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("copies a canonical thread route without the current query or fragment", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<CopyLink path={conversationPath("thread-id")} label="Thread link" />);
  fireEvent.click(screen.getByRole("button", { name: "Copy thread link" }));
  expect(await screen.findByText("Link copied.")).toBeVisible();
  expect(writeText).toHaveBeenCalledWith(
    `${window.location.origin}/threads/thread-id`,
  );
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("shares the exact reply and safely encodes route identifiers", () => {
  expect(conversationPath("a/b?c", "id#?/")).toBe(
    "/threads/a%2Fb%3Fc#reply-id%23%3F%2F",
  );
});

it("selects a manual link after denied clipboard access and returns focus when closed", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
  });
  render(
    <CopyLink path={conversationPath("thread", "reply")} label="Reply link" />,
  );
  const button = screen.getByRole("button", { name: "Copy reply link" });
  fireEvent.click(button);
  const input = (await screen.findByLabelText(
    "Reply link",
  )) as HTMLInputElement;
  expect(input).toHaveValue(
    `${window.location.origin}/threads/thread#reply-reply`,
  );
  expect(input).toHaveFocus();
  expect((input.selectionEnd ?? 0) - (input.selectionStart ?? 0)).toBe(
    input.value.length,
  );
  expect(input).toHaveAttribute("readonly");
  expect(screen.queryByText("Link copied.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close link" }));
  expect(button).toHaveFocus();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("provides the same manual option without a clipboard API", async () => {
  vi.stubGlobal("navigator", {});
  render(<CopyLink path={conversationPath("thread")} label="Thread link" />);
  fireEvent.click(screen.getByRole("button", { name: "Copy thread link" }));
  expect(await screen.findByLabelText("Thread link")).toHaveFocus();
});

it("disables repeated requests and ignores a late completion after the route changes", async () => {
  let resolve!: () => void;
  const writeText = vi.fn().mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const view = render(
    <CopyLink path={conversationPath("first")} label="Thread link" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy thread link" }));
  expect(
    screen.getByRole("button", { name: "Copy thread link" }),
  ).toBeDisabled();
  view.rerender(
    <CopyLink path={conversationPath("next")} label="Thread link" />,
  );
  await act(async () => resolve());
  expect(screen.queryByText("Link copied.")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Copy thread link" }),
  ).toBeEnabled();
});

it("offers a manual link while a clipboard permission request remains pending", async () => {
  let finish!: () => void;
  vi.stubGlobal("navigator", {
    clipboard: {
      writeText: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    },
  });
  render(
    <CopyLink path={conversationPath("thread", "reply")} label="Reply link" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy reply link" }));
  fireEvent.click(screen.getByRole("button", { name: "Show link instead" }));
  const input = screen.getByLabelText("Reply link");
  expect(input).toHaveFocus();
  await act(async () => finish());
  expect(input).toBeVisible();
  expect(screen.queryByText("Link copied.")).not.toBeInTheDocument();
});

it.each(["recommended", "newest", "oldest"])(
  "keeps %s order in navigation while shared links stay canonical",
  (sort) => {
    const view = new URL(
      conversationViewPath("thread", sort, "reply"),
      window.location.origin,
    );
    expect(view.pathname).toBe("/threads/thread");
    expect(view.hash).toBe("#reply-reply");
    expect(view.searchParams.get("reply_sort")).toBe(
      sort === "recommended" ? null : sort,
    );
    expect(conversationPath("thread", "reply")).toBe(
      "/threads/thread#reply-reply",
    );
  },
);

it.each(["threads", "replies"] as const)(
  "builds a canonical profile link for %s",
  (view) => {
    expect(profilePath("dana", view)).toBe(
      "/u/dana" + (view === "replies" ? "?view=replies" : ""),
    );
  },
);
it("encodes profile names as a single path component", () => {
  expect(profilePath("a/b?token#x")).toBe("/u/a%2Fb%3Ftoken%23x");
});
