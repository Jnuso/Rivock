import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  accepted: "00000000-0000-4000-8000-000000000001" as string | null,
  threadType: "question",
  threadState: "published",
  reply: {
    id: "00000000-0000-4000-8000-000000000001",
    thread_id: "thread",
    depth: 1,
    author: { id: "b", username: "bruce" },
    body_markdown: "A helpful answer",
    state: "published",
    revision: 1,
    published_at: "2026-10-11T00:00:00Z",
    edited_at: null,
    score: 1,
    my_vote: null,
    is_accepted: true,
    child_count: 1,
    response_to: null,
  },
  getChildren: vi.fn(),
  replies: vi.fn(),
  accept: vi.fn(),
  replyPost: vi.fn(),
  context: vi.fn(),
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "a", username: "alice", status: "active" },
    configured: true,
    signIn: vi.fn(),
  }),
}));
vi.mock("../api", () => ({
  ApiError: class extends Error {},
  api: {
    getThread: async () => ({
      id: "thread",
      type: fixture.threadType,
      topic: { name: "Education", slug: "education" },
      title: "Question",
      body_markdown: "Original body",
      author: { id: "a", username: "alice" },
      state: fixture.threadState,
      published_at: "2026-10-11T00:00:00Z",
      score: 0,
      my_vote: null,
      is_saved: false,
      reply_count: 2,
      accepted_reply_id: fixture.accepted,
    }),
    getReplies: fixture.replies,
    getChildren: fixture.getChildren,
    acceptAnswer: fixture.accept,
    createReply: fixture.replyPost,
    getReplyContext: fixture.context,
  },
}));
import { ThreadPage } from "./ThreadPage";
beforeEach(() => {
  fixture.replies
    .mockReset()
    .mockResolvedValue({ items: [fixture.reply], next_offset: null });
});
afterEach(() => {
  cleanup();
  fixture.accepted = "00000000-0000-4000-8000-000000000001";
  fixture.threadType = "question";
  fixture.threadState = "published";
  vi.clearAllMocks();
});
it("expands nested responses, limits answer acceptance to direct replies and routes pending text privately", async () => {
  fixture.getChildren.mockResolvedValue({
    items: [
      {
        ...fixture.reply,
        id: "nested",
        depth: 2,
        body_markdown: "Nested response",
        child_count: 0,
        is_accepted: false,
        response_to: { reply_id: "direct", username: "bruce" },
      },
    ],
    next_offset: null,
  });
  fixture.replyPost.mockResolvedValue({
    submission: { id: "pending-id", status: "pending" },
    content: null,
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/threads/thread"]}>
        <Routes>
          <Route path="/threads/:id" element={<ThreadPage />} />
          <Route
            path="/submissions/:id"
            element={<p>Private submission status</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText("A helpful answer");
  expect(
    screen.getAllByRole("button", { name: "Clear accepted answer" }),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Show 1 replies" }));
  await screen.findByText("Nested response");
  expect(screen.queryByRole("button", { name: "Accept answer" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Your reply"), {
    target: { value: "A new draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit reply" }));
  await waitFor(() =>
    expect(fixture.replyPost).toHaveBeenCalledWith("thread", {
      body_markdown: "A new draft",
      response_to_reply_id: undefined,
    }),
  );
  await screen.findByText("Private submission status");
});

it("opens a linked nested reply with its parent context without paging through ranked answers", async () => {
  const targetId = "00000000-0000-4000-8000-000000000099";
  fixture.context.mockResolvedValue({
    thread_id: "thread",
    replies: [
      fixture.reply,
      {
        ...fixture.reply,
        id: targetId,
        depth: 2,
        is_accepted: false,
        child_count: 0,
        body_markdown: "The linked nested response",
      },
    ],
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/threads/thread#reply-${targetId}`]}>
        <Routes>
          <Route path="/threads/:id" element={<ThreadPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const target = await screen.findByLabelText("Linked reply");
  expect(
    within(target).getByText("The linked nested response"),
  ).toBeInTheDocument();
  expect(screen.getByText("A helpful answer")).toBeInTheDocument();
  expect(fixture.context).toHaveBeenCalledWith(targetId);
  expect(target).toHaveFocus();
  expect(
    within(target).queryByRole("button", { name: "Accept answer" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "Show all answers" }));
  await screen.findByRole("button", { name: "Clear accepted answer" });
});

function showThread(feedReturn?: string, search = "") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[
          { pathname: "/threads/thread", search, state: { feedReturn } },
        ]}
      >
        <Routes>
          <Route path="/threads/:id" element={<ThreadPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("jumps to the accepted answer with the existing focused reply context", async () => {
  fixture.context.mockResolvedValue({
    thread_id: "thread",
    replies: [{ ...fixture.reply, child_count: 0 }],
  });
  showThread();
  const shortcut = await screen.findByRole("link", {
    name: "View accepted answer →",
  });
  expect(shortcut).toHaveAttribute(
    "href",
    "/threads/thread#reply-" + fixture.accepted,
  );
  fireEvent.click(shortcut);
  expect(await screen.findByLabelText("Linked reply")).toHaveFocus();
  expect(fixture.context).toHaveBeenCalledWith(fixture.accepted);
  expect(
    screen.getByText("You’re viewing the accepted answer below."),
  ).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "View accepted answer →" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Show all answers" }));
  expect(
    await screen.findByRole("link", { name: "View accepted answer →" }),
  ).toBeVisible();
});

it.each(["no acceptance", "discussion", "unavailable thread"])(
  "omits the accepted shortcut for %s",
  async (condition) => {
    if (condition === "no acceptance") fixture.accepted = null;
    if (condition === "discussion") fixture.threadType = "discussion";
    if (condition === "unavailable thread") fixture.threadState = "deleted";
    showThread();
    await screen.findByRole("heading", { name: "Question", level: 1 });
    expect(
      screen.queryByRole("complementary", { name: "Accepted answer" }),
    ).not.toBeInTheDocument();
  },
);

it("retains the originating search and filters through accepted-answer navigation", async () => {
  const path =
    "/t/education?q=office&sort=newest&type=question&answer_status=accepted";
  fixture.context.mockResolvedValue({
    thread_id: "thread",
    replies: [{ ...fixture.reply, child_count: 0 }],
  });
  showThread(path);
  expect(
    await screen.findByRole("link", { name: "← Back to results" }),
  ).toHaveAttribute("href", path);
  fireEvent.click(screen.getByRole("link", { name: "View accepted answer →" }));
  await screen.findByLabelText("Linked reply");
  expect(
    screen.getByRole("link", { name: "← Back to results" }),
  ).toHaveAttribute("href", path);
  fireEvent.click(screen.getByRole("link", { name: "Show all answers" }));
  await screen.findByRole("link", { name: "View accepted answer →" });
  expect(
    screen.getByRole("link", { name: "← Back to results" }),
  ).toHaveAttribute("href", path);
});

it("uses the public feed for untrusted or unrelated return destinations", async () => {
  showThread("https://example.test/settings");
  expect(
    await screen.findByRole("link", { name: "← All conversations" }),
  ).toHaveAttribute("href", "/");
  expect(
    screen.queryByRole("link", { name: "← Back to results" }),
  ).not.toBeInTheDocument();
});

it("keeps the originating results after a newly published reply opens its context", async () => {
  const path = "/?q=office&sort=newest&type=question";
  const targetId = "00000000-0000-4000-8000-000000000088";
  fixture.replyPost.mockResolvedValue({
    submission: { status: "published" },
    content: { id: targetId },
  });
  fixture.context.mockResolvedValue({
    thread_id: "thread",
    replies: [
      {
        ...fixture.reply,
        id: targetId,
        child_count: 0,
        body_markdown: "My published response",
      },
    ],
  });
  showThread(path, "?reply_sort=newest");
  const input = await screen.findByLabelText("Your reply");
  fireEvent.change(input, { target: { value: "My published response" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit reply" }));
  const target = await screen.findByLabelText("Linked reply");
  expect(within(target).getByText("My published response")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "← Back to results" }),
  ).toHaveAttribute("href", path);
  expect(screen.getByLabelText("Your reply")).toHaveValue("");
  expect(
    screen.getByRole("link", { name: "Show all answers" }),
  ).toHaveAttribute("href", "/threads/thread?reply_sort=newest");
});

it("keeps the chosen order on later pages and restarts when the order changes", async () => {
  fixture.replies.mockImplementation(async (_id, offset, _limit, sort) => ({
    items: [
      {
        ...fixture.reply,
        id: sort + offset,
        body_markdown: sort + " page " + offset,
        child_count: 0,
        is_accepted: false,
      },
    ],
    next_offset: sort === "newest" && offset === 0 ? 20 : null,
  }));
  showThread(undefined, "?reply_sort=newest");
  await screen.findByText("newest page 0");
  expect(screen.getByRole("button", { name: "Newest" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await screen.findByText("newest page 20");
  expect(fixture.replies).toHaveBeenLastCalledWith("thread", 20, 20, "newest");
  fireEvent.click(screen.getByRole("button", { name: "Oldest" }));
  await screen.findByText("oldest page 0");
  expect(fixture.replies).toHaveBeenLastCalledWith("thread", 0, 20, "oldest");
  expect(screen.queryByText("newest page 20")).not.toBeInTheDocument();
});

it("preserves reply order and feed results through accepted-answer context", async () => {
  const path = "/?q=office&sort=newest&type=question";
  fixture.context.mockResolvedValue({
    thread_id: "thread",
    replies: [{ ...fixture.reply, child_count: 0 }],
  });
  showThread(path, "?reply_sort=oldest");
  const shortcut = await screen.findByRole("link", {
    name: "View accepted answer →",
  });
  expect(shortcut).toHaveAttribute(
    "href",
    "/threads/thread?reply_sort=oldest#reply-" + fixture.accepted,
  );
  fireEvent.click(shortcut);
  await screen.findByLabelText("Linked reply");
  expect(
    screen.queryByRole("group", { name: "Reply order" }),
  ).not.toBeInTheDocument();
  const back = screen.getByRole("link", { name: "Show all answers" });
  expect(back).toHaveAttribute("href", "/threads/thread?reply_sort=oldest");
  fireEvent.click(back);
  await screen.findByRole("group", { name: "Reply order" });
  expect(screen.getByRole("button", { name: "Oldest" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByRole("link", { name: "← Back to results" }),
  ).toHaveAttribute("href", path);
});

it("recovers an invalid shared order by choosing Recommended", async () => {
  fixture.replies.mockImplementation(async (_id, _offset, _limit, sort) => {
    if (sort === "bad") throw new Error("Choose a supported reply order.");
    return { items: [fixture.reply], next_offset: null };
  });
  showThread(undefined, "?reply_sort=bad");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Choose a supported reply order.",
  );
  expect(
    screen.queryByText("No replies yet. Start the conversation."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Recommended" }));
  await screen.findByText("A helpful answer");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(fixture.replies).toHaveBeenLastCalledWith(
    "thread",
    0,
    20,
    "recommended",
  );
});

it("opens a nested reply from its timestamp while preserving order and originating results", async () => {
  const targetId = "00000000-0000-4000-8000-000000000077";
  const nested = {
    ...fixture.reply,
    id: targetId,
    depth: 2,
    is_accepted: false,
    child_count: 0,
    body_markdown: "Nested timestamp destination",
    response_to: { reply_id: fixture.reply.id, username: "bruce" },
  };
  fixture.getChildren.mockResolvedValue({ items: [nested], next_offset: null });
  fixture.context.mockResolvedValue({
    thread_id: "thread",
    replies: [fixture.reply, nested],
  });
  const returnTo = "/?q=office&sort=newest";
  showThread(returnTo, "?reply_sort=oldest");
  fireEvent.click(
    await screen.findByRole("button", { name: "Show 1 replies" }),
  );
  const article = (
    await screen.findByText("Nested timestamp destination")
  ).closest("article")!;
  const link = within(article).getByRole("link", {
    name: /^Open reply from @bruce/,
  });
  expect(link).toHaveAttribute(
    "href",
    "/threads/thread?reply_sort=oldest#reply-" + targetId,
  );
  fireEvent.click(link);
  expect(await screen.findByLabelText("Linked reply")).toHaveFocus();
  expect(fixture.context).toHaveBeenCalledWith(targetId);
  expect(
    screen.getByRole("link", { name: "Show all answers" }),
  ).toHaveAttribute("href", "/threads/thread?reply_sort=oldest");
  expect(
    screen.getByRole("link", { name: "← Back to results" }),
  ).toHaveAttribute("href", returnTo);
});

it("preserves saved-search return through ordering and accepted-answer context", async () => {
  const path = "/saved?q=office";
  fixture.context.mockResolvedValue({
    thread_id: "thread",
    replies: [{ ...fixture.reply, child_count: 0 }],
  });
  showThread(path);
  expect(
    await screen.findByRole("link", { name: "← Back to saved" }),
  ).toHaveAttribute("href", path);
  fireEvent.click(screen.getByRole("button", { name: "Newest" }));
  fireEvent.click(screen.getByRole("link", { name: "View accepted answer →" }));
  await screen.findByLabelText("Linked reply");
  expect(screen.getByRole("link", { name: "← Back to saved" })).toHaveAttribute(
    "href",
    path,
  );
  fireEvent.click(screen.getByRole("link", { name: "Show all answers" }));
  await screen.findByRole("button", { name: "Newest" });
  expect(screen.getByRole("link", { name: "← Back to saved" })).toHaveAttribute(
    "href",
    path,
  );
});

it("retains the profile Replies tab through focused conversation navigation", async () => {
  const path = "/u/dana?view=replies";
  fixture.context.mockResolvedValue({
    thread_id: "thread",
    replies: [{ ...fixture.reply, child_count: 0 }],
  });
  showThread(path);
  expect(
    await screen.findByRole("link", { name: "← Back to profile" }),
  ).toHaveAttribute("href", path);
  fireEvent.click(screen.getByRole("link", { name: "View accepted answer →" }));
  await screen.findByLabelText("Linked reply");
  expect(
    screen.getByRole("link", { name: "← Back to profile" }),
  ).toHaveAttribute("href", path);
});
