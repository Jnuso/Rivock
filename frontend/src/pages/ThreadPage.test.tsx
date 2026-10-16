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
import { afterEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  reply: {
    id: "direct",
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
      type: "question",
      topic: { name: "Education", slug: "education" },
      title: "Question",
      body_markdown: "Original body",
      author: { id: "a", username: "alice" },
      state: "published",
      published_at: "2026-10-11T00:00:00Z",
      score: 0,
      my_vote: null,
      is_saved: false,
      reply_count: 2,
      accepted_reply_id: "direct",
    }),
    getReplies: async () => ({ items: [fixture.reply], next_offset: null }),
    getChildren: fixture.getChildren,
    acceptAnswer: fixture.accept,
    createReply: fixture.replyPost,
    getReplyContext: fixture.context,
  },
}));
import { ThreadPage } from "./ThreadPage";
afterEach(() => cleanup());
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
