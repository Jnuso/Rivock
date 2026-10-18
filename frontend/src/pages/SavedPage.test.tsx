import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  get: vi.fn(),
  remove: vi.fn(),
  signIn: vi.fn(),
  user: { id: "reader", status: "active" } as {
    id: string;
    status: string;
  } | null,
}));
vi.mock("../api", () => ({
  api: { getSaved: fixture.get, unsaveThread: fixture.remove },
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: fixture.user,
    configured: true,
    signIn: fixture.signIn,
  }),
}));
import { SavedPage } from "./SavedPage";
import { readFeedReturn } from "../lib/feedReturn";
const item = {
  id: "thread",
  state: "published",
  title: "Office hours advice",
  excerpt: "Original fictional context.",
};
beforeEach(() => {
  fixture.get.mockResolvedValue({ items: [item], next_offset: null });
  fixture.remove.mockResolvedValue(null);
  fixture.user = { id: "reader", status: "active" };
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function Destination() {
  const location = useLocation();
  return <p>Return: {readFeedReturn(location.state)}</p>;
}
function Where() {
  const location = useLocation();
  return (
    <output aria-label="Current path">
      {location.pathname + location.search}
    </output>
  );
}
function show(path = "/saved") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/threads/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
it("restores a private saved-search URL and queries the server", async () => {
  show("/saved?q=office");
  await screen.findByRole("link", { name: item.title });
  expect(
    screen.getByRole("textbox", { name: "Search saved conversations" }),
  ).toHaveValue("office");
  expect(fixture.get).toHaveBeenCalledExactlyOnceWith(0, 20, "office");
});
it("submits and trims a new saved search into the URL", async () => {
  show();
  await screen.findByRole("link", { name: item.title });
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "  office hours  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search saved" }));
  await waitFor(() =>
    expect(fixture.get).toHaveBeenLastCalledWith(0, 20, "office hours"),
  );
  expect(screen.getByLabelText("Current path")).toHaveTextContent(
    "/saved?q=office+hours",
  );
});
it("keeps the search on subsequent pages and deduplicates results", async () => {
  fixture.get.mockImplementation(async (offset) => ({
    items: offset
      ? [item, { ...item, id: "another", title: "Another saved answer" }]
      : [item],
    next_offset: offset ? null : 20,
  }));
  show("/saved?q=office");
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await screen.findByRole("link", { name: "Another saved answer" });
  expect(fixture.get).toHaveBeenLastCalledWith(20, 20, "office");
  expect(screen.getAllByRole("link", { name: item.title })).toHaveLength(1);
});
it("restores unavailable saved placeholders when clearing a search", async () => {
  fixture.get.mockImplementation(async (_offset, _limit, query) => ({
    items: query
      ? [item]
      : [
          item,
          {
            ...item,
            id: "hidden",
            state: "removed",
            title: "Hidden original title",
          },
        ],
    next_offset: null,
  }));
  show("/saved?q=office");
  await screen.findByRole("link", { name: item.title });
  expect(screen.queryByText("Unavailable saved item")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear saved search" }));
  expect(await screen.findByText("Unavailable saved item")).toBeVisible();
  expect(screen.queryByText("Hidden original title")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toHaveValue("");
});
it("shows search failures without an empty-library claim and can clear to recover", async () => {
  fixture.get.mockImplementation(async (_offset, _limit, query) => {
    if (query) throw new Error("Saved search is unavailable.");
    return { items: [item], next_offset: null };
  });
  show("/saved?q=office");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Saved search is unavailable.",
  );
  expect(screen.queryByText("No saved threads.")).not.toBeInTheDocument();
  expect(
    screen.queryByText("No saved conversations match your search."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear saved search" }));
  expect(await screen.findByRole("link", { name: item.title })).toBeVisible();
});
it("removes a matching saved result and refreshes the searched library", async () => {
  let removed = false;
  fixture.get.mockImplementation(async () => ({
    items: removed ? [] : [item],
    next_offset: null,
  }));
  fixture.remove.mockImplementation(async () => {
    removed = true;
  });
  show("/saved?q=office");
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove from saved" }),
  );
  expect(
    await screen.findByText("No saved conversations match your search."),
  ).toBeVisible();
  expect(fixture.remove).toHaveBeenCalledExactlyOnceWith("thread");
  expect(fixture.get).toHaveBeenLastCalledWith(0, 20, "office");
  expect(screen.getByLabelText("Current path")).toHaveTextContent(
    "/saved?q=office",
  );
});
it("retains the private saved-search destination in local navigation state", async () => {
  show("/saved?q=office");
  const link = await screen.findByRole("link", { name: item.title });
  expect(link).toHaveAttribute("href", "/threads/thread");
  fireEvent.click(link);
  expect(await screen.findByText("Return: /saved?q=office")).toBeVisible();
});
it("bounds search by Unicode code points before submitting", async () => {
  show();
  await screen.findByRole("link", { name: item.title });
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "📝".repeat(100) + "a".repeat(101) },
  });
  expect(screen.getByRole("button", { name: "Search saved" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "200 characters or fewer",
  );
  expect(fixture.get).toHaveBeenCalledTimes(1);
});
it("keeps anonymous private reads gated and preserves the intended saved search through sign-in", () => {
  fixture.user = null;
  show("/saved?q=office");
  expect(fixture.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(fixture.signIn).toHaveBeenCalledExactlyOnceWith("/saved?q=office");
});
