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
  user: null as null | {
    id: string;
    username: string;
    status: string;
    role: string;
    bio: string;
    avatar_key: string;
    profile_revision: number;
  },
  reads: {
    getThreads: vi.fn(),
    getTopics: vi.fn(),
    getNotifications: vi.fn(),
    getSubmissions: vi.fn(),
    getUser: vi.fn(),
    getContributions: vi.fn(),
    getThread: vi.fn(),
    getReplies: vi.fn(),
    getSaved: vi.fn(),
    getBlocks: vi.fn(),
    adminReports: vi.fn(),
    adminSubmissions: vi.fn(),
    adminActions: vi.fn(),
    adminStatus: vi.fn(),
  },
  writes: { markRead: vi.fn(), readAll: vi.fn(), unsaveThread: vi.fn() },
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: fixture.user,
    configured: true,
    signIn: vi.fn(),
    refreshMe: vi.fn(),
  }),
  clearRivockDrafts: vi.fn(),
}));
vi.mock("../api", () => ({
  ApiError: class extends Error {},
  api: { ...fixture.reads, ...fixture.writes },
}));
import { FeedPage } from "./FeedPage";
import { NotificationsPage } from "./NotificationsPage";
import { SubmissionsListPage } from "./SubmissionsPage";
import { ProfilePage } from "./ProfilePage";
import { ThreadPage } from "./ThreadPage";
import { SavedPage } from "./SavedPage";
import { SettingsPage } from "./SettingsPage";
import { AdminPage } from "./AdminPage";
import { clearDraftMemory } from "../lib/drafts";

const clients: QueryClient[] = [];
function client() {
  const result = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(result);
  return result;
}
function show(
  page: React.ReactNode,
  path: string,
  route = path,
  cache = client(),
) {
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={page} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  fixture.user = {
    id: "reader",
    username: "reader",
    status: "active",
    role: "admin",
    bio: "",
    avatar_key: "initials",
    profile_revision: 1,
  };
  for (const method of [
    "getThreads",
    "getSubmissions",
    "getContributions",
    "getReplies",
    "getSaved",
    "adminReports",
    "adminSubmissions",
    "adminActions",
  ] as const) {
    fixture.reads[method].mockResolvedValue({ items: [], next_offset: null });
  }
  fixture.reads.getNotifications.mockResolvedValue({
    items: [],
    next_offset: null,
    as_of: "2026-10-17T00:00:00Z",
  });
  fixture.reads.getTopics.mockResolvedValue([]);
  fixture.reads.getBlocks.mockResolvedValue([]);
  fixture.reads.getUser.mockResolvedValue({ ...fixture.user, is_bot: false });
  fixture.reads.getThread.mockResolvedValue({
    id: "thread",
    type: "question",
    topic: { name: "Hobbies", slug: "hobbies" },
    title: "A fictional game night",
    body_markdown: "Original synthetic question",
    author: { id: "author", username: "author" },
    state: "published",
    revision: 1,
    published_at: "2026-10-17T00:00:00Z",
    score: 0,
    my_vote: null,
    is_saved: false,
    reply_count: 0,
    accepted_reply_id: null,
  });
  fixture.reads.adminStatus.mockResolvedValue({
    moderation_mode: "off",
    ai_paused: true,
    queue_count: 0,
    reserved_or_used_usd: 0,
    monthly_budget_usd: 2,
  });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((cache) => cache.clear());
  sessionStorage.clear();
  clearDraftMemory();
});

const lists = [
  {
    name: "feed",
    page: <FeedPage />,
    path: "/",
    route: "/",
    method: "getThreads",
    empty: "No threads yet.",
  },
  {
    name: "notifications",
    page: <NotificationsPage />,
    path: "/notifications",
    route: "/notifications",
    method: "getNotifications",
    empty: "No notifications yet.",
  },
  {
    name: "submissions",
    page: <SubmissionsListPage />,
    path: "/submissions",
    route: "/submissions",
    method: "getSubmissions",
    empty: "No submissions yet.",
  },
  {
    name: "profile contributions",
    page: <ProfilePage />,
    path: "/u/reader",
    route: "/u/:username",
    method: "getContributions",
    empty: "No public threads.",
  },
  {
    name: "replies",
    page: <ThreadPage />,
    path: "/threads/thread",
    route: "/threads/:id",
    method: "getReplies",
    empty: "No replies yet. Start the conversation.",
  },
  {
    name: "saved",
    page: <SavedPage />,
    path: "/saved",
    route: "/saved",
    method: "getSaved",
    empty: "No saved threads.",
  },
  {
    name: "blocks",
    page: <SettingsPage />,
    path: "/settings",
    route: "/settings",
    method: "getBlocks",
    empty: "No blocks.",
  },
  {
    name: "admin reports",
    page: <AdminPage />,
    path: "/admin",
    route: "/admin",
    method: "adminReports",
    empty: "No reports.",
  },
  {
    name: "admin submissions",
    page: <AdminPage />,
    path: "/admin",
    route: "/admin",
    method: "adminSubmissions",
    empty: "No submissions.",
  },
  {
    name: "admin audit",
    page: <AdminPage />,
    path: "/admin",
    route: "/admin",
    method: "adminActions",
    empty: "No actions.",
  },
] as const;

it.each(lists)(
  "recovers $name reads without falsely claiming the list is empty",
  async ({ page, path, route, method, empty }) => {
    const request = fixture.reads[method];
    request.mockRejectedValueOnce(
      new Error("This list is temporarily unavailable."),
    );
    show(page, path, route);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This list is temporarily unavailable.");
    expect(screen.queryByText(empty)).not.toBeInTheDocument();
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(empty)).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(request).toHaveBeenCalledTimes(2);
    for (const write of Object.values(fixture.writes))
      expect(write).not.toHaveBeenCalled();
  },
);

it("keeps cached saved threads visible when refreshing fails, then retries the read", async () => {
  const saved = {
    id: "saved-thread",
    title: "Fictional saved thread",
    excerpt: "Synthetic text",
    state: "published",
  };
  const page = { items: [saved], next_offset: null };
  const cache = client();
  cache.setQueryData(["saved"], { pages: [page], pageParams: [0] });
  fixture.reads.getSaved
    .mockRejectedValueOnce(new Error("Refresh unavailable."))
    .mockResolvedValue(page);
  show(<SavedPage />, "/saved", "/saved", cache);
  const alert = await screen.findByRole("alert");
  expect(screen.getByRole("link", { name: saved.title })).toBeVisible();
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("link", { name: saved.title })).toBeVisible();
  expect(fixture.writes.unsaveThread).not.toHaveBeenCalled();
});

it("keeps signed-out saved reads gated without offering a private query retry", () => {
  fixture.user = null;
  show(<SavedPage />, "/saved");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Try again" }),
  ).not.toBeInTheDocument();
  expect(fixture.reads.getSaved).not.toHaveBeenCalled();
});
