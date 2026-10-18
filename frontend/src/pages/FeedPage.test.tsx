import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ threads: vi.fn(), topics: vi.fn() }));
vi.mock("../api", () => ({
  api: { getThreads: fixtures.threads, getTopics: fixtures.topics },
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
import { FeedPage } from "./FeedPage";

beforeEach(() => {
  fixtures.threads.mockResolvedValue({ items: [], next_offset: null });
  fixtures.topics.mockResolvedValue([
    {
      id: "wellbeing",
      slug: "health-wellbeing",
      name: "Health & Wellbeing",
      is_active: true,
    },
  ]);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function show(path: string) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/t/:topicSlug" element={<FeedPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("uses the canonical topic name even when its feed has no threads", async () => {
  show("/t/health-wellbeing");
  await screen.findByRole("heading", { name: "Health & Wellbeing", level: 1 });
  expect(await screen.findByText("No threads yet.")).toBeVisible();
  expect(fixtures.threads).toHaveBeenCalledWith(
    expect.objectContaining({ topic: "health-wellbeing" }),
  );
});

it("shows a failed feed request without claiming that the feed is empty", async () => {
  fixtures.threads.mockRejectedValue(
    new Error("The feed is temporarily unavailable."),
  );
  show("/");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The feed is temporarily unavailable.",
  );
  expect(screen.queryByText("No threads yet.")).not.toBeInTheDocument();
});

it("restores shared question and answer filters alongside search, topic and sort", async () => {
  show(
    "/t/health-wellbeing?q=office&sort=newest&type=question&answer_status=unanswered",
  );
  expect(
    await screen.findByText("No conversations match these filters."),
  ).toBeVisible();
  expect(screen.getByLabelText("Conversation type")).toHaveValue("question");
  expect(screen.getByLabelText("Answer status")).toHaveValue("unanswered");
  expect(fixtures.threads).toHaveBeenLastCalledWith({
    topic: "health-wellbeing",
    q: "office",
    sort: "newest",
    type: "question",
    answer_status: "unanswered",
    offset: 0,
    limit: 20,
  });
});

it("selects questions when choosing an answer status and preserves the search", async () => {
  show("/?q=office&sort=newest");
  await screen.findByText("No conversations match your search.");
  fireEvent.change(screen.getByLabelText("Answer status"), {
    target: { value: "accepted" },
  });
  await waitFor(() =>
    expect(fixtures.threads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "question",
        answer_status: "accepted",
        q: "office",
        sort: "newest",
        offset: 0,
      }),
    ),
  );
  expect(screen.getByLabelText("Conversation type")).toHaveValue("question");
});

it.each(["discussion", ""])(
  "clears answer status when changing to %s",
  async (type) => {
    show("/?type=question&answer_status=answered&sort=latest");
    await screen.findByText("No conversations match these filters.");
    fireEvent.change(screen.getByLabelText("Conversation type"), {
      target: { value: type },
    });
    await waitFor(() =>
      expect(fixtures.threads).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: type || undefined,
          answer_status: undefined,
          sort: "latest",
          offset: 0,
        }),
      ),
    );
    if (type === "discussion")
      expect(screen.queryByLabelText("Answer status")).not.toBeInTheDocument();
    else expect(screen.getByLabelText("Answer status")).toHaveValue("");
  },
);

it("shows the implied question type for an answer-only shared link", async () => {
  show("/?answer_status=unanswered");
  await screen.findByText("No conversations match these filters.");
  expect(screen.getByLabelText("Conversation type")).toHaveValue("question");
});

it("resets filters while keeping topic, search and its sort", async () => {
  show(
    "/t/health-wellbeing?q=office&sort=newest&type=question&answer_status=unanswered",
  );
  await screen.findByText("No conversations match these filters.");
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  await waitFor(() =>
    expect(fixtures.threads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        topic: "health-wellbeing",
        q: "office",
        sort: "newest",
        type: undefined,
        answer_status: undefined,
      }),
    ),
  );
  expect(screen.getByLabelText("Conversation type")).toHaveValue("");
  expect(
    screen.queryByRole("button", { name: "Reset filters" }),
  ).not.toBeInTheDocument();
});

it("clears search and its incompatible sort without clearing selected filters", async () => {
  show("/?q=office&sort=newest&type=question&answer_status=unanswered");
  await screen.findByText("No conversations match these filters.");
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  await waitFor(() =>
    expect(fixtures.threads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: undefined,
        sort: "trending",
        type: "question",
        answer_status: "unanswered",
      }),
    ),
  );
  expect(screen.getByRole("textbox", { name: "Search" })).toHaveValue("");
});

it("recovers from invalid shared filters through reset without hiding the read error", async () => {
  fixtures.threads.mockImplementation(async (params) => {
    if (params.type === "bad") throw new Error("Choose a supported filter.");
    return { items: [], next_offset: null };
  });
  show("/?type=bad&answer_status=unknown");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Choose a supported filter.",
  );
  expect(screen.getByLabelText("Conversation type")).toHaveDisplayValue(
    "Unsupported type",
  );
  expect(screen.getByLabelText("Answer status")).toHaveDisplayValue(
    "Unsupported answer status",
  );
  expect(
    screen.queryByText("No conversations match these filters."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(await screen.findByText("No threads yet.")).toBeVisible();
});

it("sends the same filters with subsequent pages and restarts when they change", async () => {
  fixtures.threads.mockImplementation(async ({ type, offset }) => ({
    items: [],
    next_offset: type === "question" && offset === 0 ? 20 : null,
  }));
  show("/?type=question&answer_status=unanswered");
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await waitFor(() =>
    expect(fixtures.threads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "question",
        answer_status: "unanswered",
        offset: 20,
      }),
    ),
  );
  fireEvent.change(screen.getByLabelText("Conversation type"), {
    target: { value: "discussion" },
  });
  await waitFor(() =>
    expect(fixtures.threads).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "discussion",
        answer_status: undefined,
        offset: 0,
      }),
    ),
  );
});
