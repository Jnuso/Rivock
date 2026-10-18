import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  profile: vi.fn(),
  contributions: vi.fn(),
}));
vi.mock("../api", () => ({
  api: { getUser: fixture.profile, getContributions: fixture.contributions },
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
import { ProfilePage } from "./ProfilePage";
import { readFeedReturn } from "../lib/feedReturn";
const person = {
  id: "person",
  username: "dana",
  bio: "An original fictional profile.",
  is_bot: true,
};
const thread = { id: "thread", title: "A public question" };
const reply = {
  id: "reply",
  thread_id: "thread",
  body_markdown: "A public response",
};
beforeEach(() => {
  fixture.profile.mockResolvedValue(person);
  fixture.contributions.mockImplementation(async (_username, type) => ({
    items: [type === "replies" ? reply : thread],
    next_offset: null,
  }));
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function Destination() {
  const location = useLocation();
  return <p>Origin: {readFeedReturn(location.state)}</p>;
}
function Controls() {
  const location = useLocation(),
    navigate = useNavigate();
  return (
    <>
      <output aria-label="Current path">
        {location.pathname + location.search}
      </output>
      <button onClick={() => navigate(-1)}>Go back</button>
      <Link to="/u/other">Other profile</Link>
    </>
  );
}
function show(path = "/u/dana") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Controls />
        <Routes>
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/threads/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("opens a shared Replies tab without requiring an account", async () => {
  show("/u/dana?view=replies");
  expect(await screen.findByText(reply.body_markdown)).toBeVisible();
  expect(screen.getByRole("button", { name: "Replies" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(fixture.contributions).toHaveBeenCalledExactlyOnceWith(
    "dana",
    "replies",
    0,
  );
  expect(
    screen.getByRole("link", { name: "View conversation" }),
  ).toHaveAttribute("href", "/threads/thread#reply-reply");
  expect(screen.getByText("Fictional demo account")).toBeVisible();
});
it("keeps tab changes and browser Back in sync with the URL", async () => {
  show();
  await screen.findByRole("link", { name: thread.title });
  fireEvent.click(screen.getByRole("button", { name: "Replies" }));
  await screen.findByText(reply.body_markdown);
  expect(screen.getByLabelText("Current path")).toHaveTextContent(
    "/u/dana?view=replies",
  );
  fireEvent.click(screen.getByRole("button", { name: "Go back" }));
  await screen.findByRole("link", { name: thread.title });
  expect(screen.getByRole("button", { name: "Threads" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it("retains the selected tab while loading more public replies", async () => {
  fixture.contributions.mockImplementation(
    async (_username, _type, offset) => ({
      items: offset
        ? [reply, { ...reply, id: "next", body_markdown: "Next public reply" }]
        : [reply],
      next_offset: offset ? null : 20,
    }),
  );
  show("/u/dana?view=replies");
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await screen.findByText("Next public reply");
  expect(fixture.contributions).toHaveBeenLastCalledWith("dana", "replies", 20);
  expect(screen.getAllByText(reply.body_markdown)).toHaveLength(1);
});
it("copies only the canonical profile and chosen public tab", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  show("/u/dana?view=replies&q=private-search&token=exclude#private-fragment");
  fireEvent.click(
    await screen.findByRole("button", { name: "Copy profile link" }),
  );
  expect(await screen.findByText("Link copied.")).toBeVisible();
  expect(writeText).toHaveBeenCalledExactlyOnceWith(
    window.location.origin + "/u/dana?view=replies",
  );
});
it("provides a selected read-only profile link if clipboard access fails", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) },
  });
  show("/u/dana?view=replies");
  fireEvent.click(
    await screen.findByRole("button", { name: "Copy profile link" }),
  );
  const input = (await screen.findByRole("textbox", {
    name: "Profile link",
  })) as HTMLInputElement;
  expect(input).toHaveValue(window.location.origin + "/u/dana?view=replies");
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  expect(input).toHaveAttribute("readonly");
});
it("does not expose sharing or request contributions for an unavailable profile", async () => {
  fixture.profile.mockRejectedValue(new Error("This profile is unavailable."));
  show("/u/dana?view=replies");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "profile is unavailable",
  );
  expect(
    screen.queryByRole("button", { name: "Copy profile link" }),
  ).not.toBeInTheDocument();
  expect(fixture.contributions).not.toHaveBeenCalled();
});
it("distinguishes a failed public tab from an empty history and can switch tabs to recover", async () => {
  fixture.contributions.mockImplementation(async (_username, type) => {
    if (type === "replies") throw new Error("Replies could not be loaded.");
    return { items: [thread], next_offset: null };
  });
  show("/u/dana?view=replies");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Replies could not be loaded",
  );
  expect(screen.queryByText("No public replies.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Threads" }));
  expect(await screen.findByRole("link", { name: thread.title })).toBeVisible();
});
it("opens the default Threads tab when navigating to another profile", async () => {
  fixture.profile.mockImplementation(async (username) => ({
    ...person,
    username,
  }));
  show("/u/dana?view=replies");
  await screen.findByText(reply.body_markdown);
  fireEvent.click(screen.getByRole("link", { name: "Other profile" }));
  await screen.findByRole("heading", { name: "@other" });
  await waitFor(() =>
    expect(fixture.contributions).toHaveBeenLastCalledWith(
      "other",
      "threads",
      0,
    ),
  );
  expect(screen.getByRole("button", { name: "Threads" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it("uses Threads for an unsupported view and lets the user clear it", async () => {
  show("/u/dana?view=unknown");
  await screen.findByRole("link", { name: thread.title });
  fireEvent.click(screen.getByRole("button", { name: "Threads" }));
  expect(screen.getByLabelText("Current path")).toHaveTextContent("/u/dana");
  expect(screen.getByLabelText("Current path")).not.toHaveTextContent("view=");
});

it("passes the current profile tab to a linked conversation without sharing it in the public URL", async () => {
  show("/u/dana?view=replies");
  const link = await screen.findByRole("link", { name: "View conversation" });
  expect(link).toHaveAttribute("href", "/threads/thread#reply-reply");
  fireEvent.click(link);
  expect(await screen.findByText("Origin: /u/dana?view=replies")).toBeVisible();
});
