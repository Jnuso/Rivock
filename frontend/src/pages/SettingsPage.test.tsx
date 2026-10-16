import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { clearDraftMemory, writeDraft } from "../lib/drafts";

const state = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    username: string;
    bio: string;
    avatar_key: string;
    profile_revision: number;
    status: string;
  },
  patch: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: state.user,
    configured: true,
    refreshMe: state.refresh,
  }),
  clearRivockDrafts: vi.fn(),
}));
vi.mock("../api", async (original) => {
  const actual = await original<typeof import("../api")>();
  return {
    ...actual,
    api: { getBlocks: async () => [], patchMe: state.patch },
  };
});
import { ApiError } from "../api";
import { SettingsPage } from "./SettingsPage";

afterEach(() => {
  cleanup();
  clearDraftMemory();
  sessionStorage.clear();
  vi.restoreAllMocks();
  state.user = null;
});

it("recovers a profile draft after identity loads and preserves it across revision conflicts", async () => {
  writeDraft(
    "profile:member",
    JSON.stringify({ bio: "My draft", avatar: "sage", baseRevision: 1 }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(ui());
  expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  state.user = {
    id: "member",
    username: "alice",
    bio: "Published 2",
    avatar_key: "blue",
    profile_revision: 2,
    status: "active",
  };
  view.rerender(ui());
  await screen.findByText("A newer profile version is available");
  expect(screen.getByLabelText("Bio")).toHaveValue("My draft");
  expect(screen.getByLabelText("Avatar")).toHaveValue("sage");
  expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Keep my profile draft against current version",
    }),
  );
  state.patch.mockRejectedValue(
    new ApiError(409, {
      error: { code: "revision_conflict", message: "A newer profile exists" },
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => expect(state.refresh).toHaveBeenCalled());
  expect(state.patch).toHaveBeenCalledWith({
    bio: "My draft",
    avatar_key: "sage",
    base_revision: 2,
  });
  state.user = { ...state.user, bio: "Published 3", profile_revision: 3 };
  view.rerender(ui());
  expect(screen.getByLabelText("Bio")).toHaveValue("My draft");
  expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Load current profile" }));
  expect(screen.getByLabelText("Bio")).toHaveValue("Published 3");
  expect(screen.getByLabelText("Avatar")).toHaveValue("blue");
});
