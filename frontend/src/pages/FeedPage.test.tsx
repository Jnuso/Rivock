import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ threads: vi.fn(), topics: vi.fn() }));
vi.mock("../api", () => ({
  api: { getThreads: fixtures.threads, getTopics: fixtures.topics },
}));
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
