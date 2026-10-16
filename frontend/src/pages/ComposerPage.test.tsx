import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { clearDraftMemory, writeDraft } from "../lib/drafts";
const fixtures = vi.hoisted(() => ({ getThread: vi.fn(), patch: vi.fn() }));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "a", status: "active" }, configured: true }),
}));
vi.mock("../api", async (original) => {
  const actual = await original<typeof import("../api")>();
  return {
    ...actual,
    api: {
      getTopics: async () => [
        { id: "topic", name: "Education", is_active: true },
      ],
      getThread: fixtures.getThread,
      patchThread: fixtures.patch,
    },
  };
});
import { ApiError } from "../api";
import { ComposerPage } from "./ComposerPage";

afterEach(() => {
  cleanup();
  clearDraftMemory();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
function show(mode: "edit" | "new") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[mode === "edit" ? "/threads/thread/edit" : "/new"]}
      >
        <Routes>
          <Route
            path={mode === "edit" ? "/threads/:id/edit" : "/new"}
            element={<ComposerPage mode={mode} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const published = (revision: number) => ({
  id: "thread",
  revision,
  title: `Published title ${revision}`,
  body_markdown: `Published body ${revision}`,
  type: "question",
  topic: { id: "topic" },
  author: { id: "a" },
});

it("preserves the original draft revision through refetch and requires an explicit conflict choice", async () => {
  writeDraft(
    "thread-form:edit:thread",
    JSON.stringify({
      title: "My title",
      body: "My draft",
      type: "question",
      topicId: "topic",
      baseRevision: 1,
    }),
  );
  fixtures.getThread.mockResolvedValue(published(2));
  show("edit");
  await screen.findByRole("region", { name: "Compare versions" });
  expect(screen.getByLabelText("Title")).toHaveValue("My title");
  expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Keep my draft against current version",
    }),
  );
  fixtures.getThread.mockResolvedValue(published(3));
  fixtures.patch.mockRejectedValue(
    new ApiError(409, {
      error: { code: "revision_conflict", message: "A newer version exists" },
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() =>
    expect(fixtures.patch).toHaveBeenCalledWith("thread", {
      base_revision: 2,
      topic_id: "topic",
      title: "My title",
      body_markdown: "My draft",
    }),
  );
  await screen.findByText("Published body 3");
  expect(screen.getByLabelText("Body")).toHaveValue("My draft");
  expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Load current version" }));
  expect(screen.getByLabelText("Body")).toHaveValue("Published body 3");
});

it("recovers topic and discussion type together with draft text after navigating away", async () => {
  const first = show("new");
  await screen.findByRole("option", { name: "Education" });
  fireEvent.change(screen.getByLabelText("Type"), {
    target: { value: "discussion" },
  });
  fireEvent.change(screen.getByLabelText("Topic"), {
    target: { value: "topic" },
  });
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "A saved discussion" },
  });
  fireEvent.change(screen.getByLabelText("Body"), {
    target: { value: "Some saved context" },
  });
  first.unmount();
  show("new");
  await screen.findByRole("option", { name: "Education" });
  expect(screen.getByLabelText("Type")).toHaveValue("discussion");
  expect(screen.getByLabelText("Topic")).toHaveValue("topic");
  expect(screen.getByLabelText("Title")).toHaveValue("A saved discussion");
  expect(screen.getByLabelText("Body")).toHaveValue("Some saved context");
});
