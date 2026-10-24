import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearAllDrafts } from "../lib/drafts";

const f = vi.hoisted(() => {
  const reply = (n: number, body: string, extra = {}) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    thread_id: "one",
    parent_reply_id: null,
    response_to_reply_id: null,
    response_to: null,
    depth: 1,
    author: { id: "bruce", username: "bruce" },
    body_markdown: body,
    state: "published",
    revision: 1,
    published_at: "2026-10-22T12:00:00Z",
    edited_at: null,
    score: 2,
    my_vote: null,
    is_accepted: false,
    child_count: 0,
    ...extra,
  });
  const first = reply(1, "First complete answer", {
    is_accepted: true,
    child_count: 1,
  });
  const second = reply(2, "Second complete answer", {
    author: { id: "alice", username: "alice" },
  });
  const child = reply(3, "Nested follow-up", {
    depth: 2,
    parent_reply_id: first.id,
    response_to_reply_id: first.id,
    child_count: 1,
  });
  const grandchild = reply(4, "Deep follow-up", {
    depth: 3,
    parent_reply_id: child.id,
    response_to_reply_id: child.id,
  });
  return {
    first,
    second,
    child,
    grandchild,
    user: { id: "alice", username: "alice", status: "active" } as {
      id: string;
      username: string;
      status: string;
    } | null,
    getThread: vi.fn(),
    getReplies: vi.fn(),
    getChildren: vi.fn(),
    getReplyContext: vi.fn(),
  };
});
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: f.user, configured: true, signIn: vi.fn() }),
}));
vi.mock("../api", () => ({
  ApiError: class extends Error {},
  api: {
    getThread: f.getThread,
    getReplies: f.getReplies,
    getChildren: f.getChildren,
    getReplyContext: f.getReplyContext,
  },
}));
import { ThreadPage } from "./ThreadPage";

function Location() {
  const location = useLocation();
  return (
    <>
      <output aria-label="Current location">
        {location.pathname + location.search + location.hash}
      </output>
      <Link to="/threads/two">Other test conversation</Link>
      <Link to="/threads/one">Original test conversation</Link>
    </>
  );
}
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/threads/one",
            search: "?reply_sort=oldest",
            state: { feedReturn: "/saved?q=college" },
          },
        ]}
      >
        <Routes>
          <Route
            path="/threads/:id"
            element={
              <>
                <ThreadPage />
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const article = (name: string) => screen.getByRole("article", { name });
beforeEach(() => {
  clearAllDrafts();
  vi.clearAllMocks();
  f.user = { id: "alice", username: "alice", status: "active" };
  f.getThread.mockImplementation(async (id: string) => ({
    id,
    type: "question",
    title: "A fictional college question",
    body_markdown: "Full question text",
    topic: { name: "Education", slug: "education" },
    state: "published",
    author: { id: "alice", username: "alice" },
    accepted_reply_id: f.first.id,
    reply_count: 4,
    published_at: "2026-10-22T11:00:00Z",
    score: 1,
    my_vote: null,
    is_saved: false,
  }));
  f.getReplies.mockResolvedValue({
    items: [f.first, f.second],
    next_offset: null,
  });
  f.getChildren.mockImplementation(async (id: string) => ({
    items: id === f.child.id ? [f.grandchild] : [f.child],
    next_offset: null,
  }));
  f.getReplyContext.mockResolvedValue({ thread_id: "one", replies: [f.first] });
});
afterEach(() => {
  cleanup();
  clearAllDrafts();
  vi.restoreAllMocks();
});

it("collapses a complete answer without losing its expanded descendants or fetching more", async () => {
  show();
  await screen.findByText("First complete answer");
  const first = article("Reply from @bruce");
  fireEvent.click(
    within(first).getByRole("button", { name: "Show 1 replies" }),
  );
  await screen.findByText("Nested follow-up");
  const child = document.getElementById(`reply-${f.child.id}`)!;
  fireEvent.click(
    within(child).getByRole("button", { name: "Show 1 replies" }),
  );
  await screen.findByText("Deep follow-up");
  const collapse = within(first).getByRole("button", {
    name: "Collapse answer",
  });
  collapse.focus();
  fireEvent.click(collapse);
  expect(collapse).toHaveFocus();
  expect(collapse).toHaveAttribute("aria-expanded", "false");
  expect(await screen.findByText("First complete answer")).not.toBeVisible();
  expect(screen.getByText("Deep follow-up")).not.toBeVisible();
  expect(within(first).getByText("✓ Accepted answer")).toBeVisible();
  fireEvent.click(within(first).getByRole("button", { name: "Expand answer" }));
  expect(screen.getByText("Deep follow-up")).toBeVisible();
  expect(f.getChildren).toHaveBeenCalledTimes(2);
});

it("skips open reply and edit composers during bulk collapse and preserves their text", async () => {
  show();
  await screen.findByText("First complete answer");
  const first = article("Reply from @bruce"),
    second = article("Reply from @alice");
  fireEvent.click(within(first).getByRole("button", { name: "Reply" }));
  fireEvent.change(within(first).getByLabelText("Your reply"), {
    target: { value: "An unfinished fictional reply" },
  });
  fireEvent.click(within(second).getByRole("button", { name: "Edit" }));
  fireEvent.change(within(second).getByLabelText("Edit reply"), {
    target: { value: "An unfinished fictional edit" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Collapse loaded answers" }),
  );
  expect(
    within(first).getByRole("button", { name: "Collapse answer" }),
  ).toBeDisabled();
  expect(
    within(second).getByRole("button", { name: "Collapse answer" }),
  ).toBeDisabled();
  expect(within(first).getByLabelText("Your reply")).toHaveValue(
    "An unfinished fictional reply",
  );
  expect(within(second).getByLabelText("Edit reply")).toHaveValue(
    "An unfinished fictional edit",
  );
  expect(screen.getByText(/Kept conversations open/)).toBeVisible();
  fireEvent.click(within(first).getByRole("button", { name: "Discard" }));
  fireEvent.click(within(second).getByRole("button", { name: "Cancel edit" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Collapse loaded answers" }),
  );
  expect(await screen.findByText("First complete answer")).not.toBeVisible();
  expect(screen.getByText("Second complete answer")).not.toBeVisible();
});

it("protects an ancestor while a nested writer is open", async () => {
  show();
  await screen.findByText("First complete answer");
  const first = article("Reply from @bruce");
  fireEvent.click(
    within(first).getByRole("button", { name: "Show 1 replies" }),
  );
  await screen.findByText("Nested follow-up");
  const child = document.getElementById(`reply-${f.child.id}`)!;
  fireEvent.click(within(child).getByRole("button", { name: "Reply" }));
  fireEvent.change(within(child).getByLabelText("Your reply"), {
    target: { value: "Nested fictional draft" },
  });
  expect(
    within(first).getByRole("button", { name: "Collapse answer" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Collapse loaded answers" }),
  );
  expect(within(child).getByLabelText("Your reply")).toBeVisible();
  expect(screen.getByText("Second complete answer")).not.toBeVisible();
});

it("jumps within loaded answers without changing URL, order, return state or fetching pages", async () => {
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scroll,
  });
  show();
  await screen.findByText("First complete answer");
  fireEvent.click(
    screen.getByRole("button", { name: "Collapse loaded answers" }),
  );
  const navigator = screen.getByText("Jump to an answer").closest("details")!;
  fireEvent.click(screen.getByText("Jump to an answer"));
  navigator.open = true;
  fireEvent.click(within(navigator).getByRole("button", { name: /@bruce/ }));
  await waitFor(() => expect(article("Reply from @bruce")).toHaveFocus());
  expect(screen.getByText("First complete answer")).toBeVisible();
  expect(screen.getByText("Second complete answer")).not.toBeVisible();
  expect(screen.getByLabelText("Current location")).toHaveTextContent(
    "/threads/one?reply_sort=oldest",
  );
  expect(screen.getByRole("link", { name: "← Back to saved" })).toHaveAttribute(
    "href",
    "/saved?q=college",
  );
  expect(f.getReplies).toHaveBeenCalledTimes(1);
  expect(f.getChildren).not.toHaveBeenCalled();
  expect(scroll).toHaveBeenCalled();
});

it("opens an accepted permalink even if that answer was collapsed", async () => {
  show();
  await screen.findByText("First complete answer");
  fireEvent.click(
    within(article("Reply from @bruce")).getByRole("button", {
      name: "Collapse answer",
    }),
  );
  fireEvent.click(screen.getByRole("link", { name: "View accepted answer →" }));
  expect(await screen.findByLabelText("Linked reply")).toHaveFocus();
  expect(screen.getByText("First complete answer")).toBeVisible();
  expect(
    screen.queryByLabelText("Conversation reading tools"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Show all answers" }));
  await screen.findByLabelText("Conversation reading tools");
  expect(screen.getByText("First complete answer")).toBeVisible();
});

it("leaves new pages expanded and only controls answers already loaded", async () => {
  f.getReplies.mockImplementation(async (_id: string, offset: number) =>
    offset === 0
      ? { items: [f.first], next_offset: 1 }
      : { items: [f.second], next_offset: null },
  );
  show();
  await screen.findByText("First complete answer");
  expect(screen.getByText(/1 loaded answer\./)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Collapse loaded answers" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  expect(await screen.findByText("Second complete answer")).toBeVisible();
  expect(await screen.findByText("First complete answer")).not.toBeVisible();
  expect(screen.getByText(/2 loaded answers\./)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Expand loaded answers" }),
  );
  expect(screen.getByText("First complete answer")).toBeVisible();
});

it("labels unavailable entries safely and makes reader tools available to anonymous visitors", async () => {
  f.user = null;
  f.getReplies.mockResolvedValue({
    items: [
      {
        ...f.first,
        state: "removed",
        author: null,
        body_markdown: null,
        is_accepted: false,
      },
    ],
    next_offset: null,
  });
  show();
  await screen.findByText("[removed reply]");
  const navigator = screen.getByText("Jump to an answer").closest("details")!;
  navigator.open = true;
  expect(
    within(navigator).getByRole("button", { name: /\[Unavailable answer\]/ }),
  ).toBeInTheDocument();
  expect(within(navigator).queryByText(/@bruce/)).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Collapse loaded answers" }),
  );
  expect(screen.getByText("[removed reply]")).not.toBeVisible();
});

it("retains a collapse choice across order changes but resets it after switching conversations", async () => {
  show();
  await screen.findByText("First complete answer");
  fireEvent.click(
    within(article("Reply from @bruce")).getByRole("button", {
      name: "Collapse answer",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Newest" }));
  await waitFor(() =>
    expect(f.getReplies).toHaveBeenCalledWith("one", 0, 20, "newest"),
  );
  expect(await screen.findByText("First complete answer")).not.toBeVisible();
  fireEvent.click(
    screen.getByRole("link", { name: "Other test conversation" }),
  );
  await waitFor(() => expect(f.getThread).toHaveBeenCalledWith("two"));
  fireEvent.click(
    screen.getByRole("link", { name: "Original test conversation" }),
  );
  expect(await screen.findByText("First complete answer")).toBeVisible();
});
