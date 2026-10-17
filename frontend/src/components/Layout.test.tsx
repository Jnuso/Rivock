import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    configured: true,
    account: null,
    user: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));
vi.mock("../api", () => ({
  api: {
    getTopics: async () => [
      { id: "hobbies", slug: "hobbies", name: "Hobbies", is_active: true },
    ],
    getInfo: async () => ({ local_fixture_moderation: false }),
    unreadCount: async () => ({ count: 0 }),
  },
}));
import { Layout } from "./Layout";

afterEach(() => cleanup());
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("dismisses the mobile disclosure with Escape and returns focus to its button", async () => {
  show();
  const button = screen.getByRole("button", { name: "Menu" });
  fireEvent.click(button);
  const panel = screen.getByRole("navigation", { name: "Topics and account" });
  const topic = await within(panel).findByRole("link", { name: "Hobbies" });
  topic.focus();
  fireEvent.keyDown(topic, { key: "Escape" });
  expect(
    screen.queryByRole("navigation", { name: "Topics and account" }),
  ).not.toBeInTheDocument();
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(button).toHaveFocus();
});

it("keeps the disclosure open while focus moves inside and closes it when focus leaves", async () => {
  show();
  const button = screen.getByRole("button", { name: "Menu" });
  fireEvent.click(button);
  const panel = screen.getByRole("navigation", { name: "Topics and account" });
  const topic = await within(panel).findByRole("link", { name: "Hobbies" });
  fireEvent.blur(button, { relatedTarget: topic });
  expect(panel).toBeInTheDocument();
  fireEvent.blur(topic, {
    relatedTarget: screen.getByRole("link", {
      name: "Privacy and participation",
    }),
  });
  expect(
    screen.queryByRole("navigation", { name: "Topics and account" }),
  ).not.toBeInTheDocument();
  expect(button).toHaveAttribute("aria-expanded", "false");
});
