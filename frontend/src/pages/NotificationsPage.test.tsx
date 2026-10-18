import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  get: vi.fn(),
  mark: vi.fn(),
  all: vi.fn(),
}));
vi.mock("../api", () => ({
  api: {
    getNotifications: fixture.get,
    markRead: fixture.mark,
    readAll: fixture.all,
  },
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "reader", status: "active" } }),
}));
import { NotificationsPage } from "./NotificationsPage";
const note = {
  id: "note",
  summary: "Someone replied to your question",
  target_id: "thread",
  reply_id: "reply",
  available: true,
  created_at: "2026-10-17T12:00:00Z",
  read: false,
};
const asOf = "2026-10-17T13:00:00Z";
beforeEach(() => {
  fixture.get.mockResolvedValue({
    items: [note],
    next_offset: null,
    as_of: asOf,
  });
  fixture.mark.mockResolvedValue({ ...note, read: true });
  fixture.all.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function show(path = "/notifications") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

it("restores an unread-only link and asks the server for that filter", async () => {
  show("/notifications?view=unread");
  await screen.findByText(note.summary);
  expect(fixture.get).toHaveBeenCalledExactlyOnceWith({
    offset: 0,
    unread_only: true,
  });
  expect(screen.getByRole("button", { name: "Unread" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("link", { name: note.summary })).toHaveAttribute(
    "href",
    "/threads/thread#reply-reply",
  );
});

it("changes between all and unread results without filtering only loaded items", async () => {
  fixture.get.mockImplementation(async ({ unread_only }) => ({
    items: unread_only ? [] : [{ ...note, read: true }],
    next_offset: null,
    as_of: asOf,
  }));
  show();
  await screen.findByText(note.summary);
  fireEvent.click(screen.getByRole("button", { name: "Unread" }));
  expect(await screen.findByText("You’re all caught up.")).toBeVisible();
  expect(screen.queryByText(note.summary)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expect(await screen.findByText(note.summary)).toBeVisible();
});

it("keeps the unread filter on subsequent pages", async () => {
  fixture.get.mockImplementation(async ({ offset }) => ({
    items: [
      {
        ...note,
        id: String(offset),
        summary: offset ? "Another reply" : "First reply",
      },
    ],
    next_offset: offset === 0 ? 20 : null,
    as_of: asOf,
  }));
  show("/notifications?view=unread");
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await screen.findByText("Another reply");
  expect(fixture.get).toHaveBeenLastCalledWith({
    offset: 20,
    unread_only: true,
  });
});

it("removes a newly read item from unread results and refreshes its badge query", async () => {
  let marked = false;
  fixture.get.mockImplementation(async () => ({
    items: marked ? [] : [note],
    next_offset: null,
    as_of: asOf,
  }));
  fixture.mark.mockImplementation(async () => {
    marked = true;
    return { ...note, read: true };
  });
  show("/notifications?view=unread");
  fireEvent.click(await screen.findByRole("button", { name: "Mark read" }));
  expect(await screen.findByText("You’re all caught up.")).toBeVisible();
  expect(fixture.mark).toHaveBeenCalledExactlyOnceWith("note", true);
});

it("uses the server snapshot time when marking all read", async () => {
  show("/notifications?view=unread");
  await screen.findByText(note.summary);
  fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
  await waitFor(() =>
    expect(fixture.all).toHaveBeenCalledExactlyOnceWith(asOf),
  );
});

it("shows a failed unread request without a caught-up claim", async () => {
  fixture.get.mockRejectedValue(
    new Error("Notifications are temporarily unavailable."),
  );
  show("/notifications?view=unread");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Notifications are temporarily unavailable.",
  );
  expect(screen.queryByText("You’re all caught up.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled();
});

it("marks an item unread again and refreshes both list filters and the badge", async () => {
  let read = true;
  fixture.get.mockImplementation(async ({ unread_only }) => ({
    items: unread_only && read ? [] : [{ ...note, read }],
    next_offset: null,
    as_of: asOf,
  }));
  fixture.mark.mockImplementation(async (_id, value) => {
    read = value;
    return { ...note, read };
  });
  const client = show();
  const refresh = vi.spyOn(client, "invalidateQueries");
  fireEvent.click(await screen.findByRole("button", { name: "Mark unread" }));
  await screen.findByRole("button", { name: "Mark read" });
  expect(fixture.mark).toHaveBeenCalledExactlyOnceWith("note", false);
  expect(refresh).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  expect(refresh).toHaveBeenCalledWith({ queryKey: ["unread"] });
  fireEvent.click(screen.getByRole("button", { name: "Unread" }));
  expect(
    await screen.findByRole("button", { name: "Mark read" }),
  ).toBeEnabled();
  expect(screen.getByRole("link", { name: note.summary })).toHaveAttribute(
    "href",
    "/threads/thread#reply-reply",
  );
});

it.each([false, true])(
  "preserves the notification's read=%s state after a failed change",
  async (read) => {
    fixture.get.mockResolvedValue({
      items: [{ ...note, read }],
      next_offset: null,
      as_of: asOf,
    });
    fixture.mark.mockRejectedValue(
      new Error("The notification could not be updated."),
    );
    show();
    const label = read ? "Mark unread" : "Mark read";
    fireEvent.click(await screen.findByRole("button", { name: label }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be updated",
    );
    expect(screen.getByRole("button", { name: label })).toBeEnabled();
    expect(screen.queryByText("You’re all caught up.")).not.toBeInTheDocument();
    expect(fixture.mark).toHaveBeenCalledExactlyOnceWith("note", !read);
  },
);

it("disables individual and read-all actions while a read-state change is pending", async () => {
  let finish: (value: unknown) => void = () => {};
  fixture.get.mockResolvedValue({
    items: [{ ...note, read: true }],
    next_offset: null,
    as_of: asOf,
  });
  fixture.mark.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  show();
  fireEvent.click(await screen.findByRole("button", { name: "Mark unread" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Mark unread" })).toBeDisabled(),
  );
  expect(screen.getByRole("button", { name: "Mark all read" })).toBeDisabled();
  finish({ ...note, read: false });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Mark all read" })).toBeEnabled(),
  );
});

it("disables individual changes while marking all read", async () => {
  let finish: (value: null) => void = () => {};
  fixture.all.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  show();
  await screen.findByText(note.summary);
  fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Mark read" })).toBeDisabled(),
  );
  finish(null);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Mark read" })).toBeEnabled(),
  );
});

it("can retain an unavailable notification as unread without inventing a target link", async () => {
  fixture.get.mockResolvedValue({
    items: [
      {
        ...note,
        read: true,
        available: false,
        target_id: null,
        reply_id: null,
        summary: "This conversation is unavailable.",
      },
    ],
    next_offset: null,
    as_of: asOf,
  });
  show();
  fireEvent.click(await screen.findByRole("button", { name: "Mark unread" }));
  await waitFor(() =>
    expect(fixture.mark).toHaveBeenCalledExactlyOnceWith("note", false),
  );
  expect(
    screen.queryByRole("link", { name: "This conversation is unavailable." }),
  ).not.toBeInTheDocument();
});
