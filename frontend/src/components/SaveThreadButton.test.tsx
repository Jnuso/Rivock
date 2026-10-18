import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  user: { id: "reader", status: "active" } as {
    id: string;
    status: string;
  } | null,
  save: vi.fn(),
  unsave: vi.fn(),
}));
vi.mock("../api", () => ({
  api: { saveThread: fixture.save, unsaveThread: fixture.unsave },
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: fixture.user }),
}));
import { SaveThreadButton } from "./SaveThreadButton";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  fixture.user = { id: "reader", status: "active" };
});
function show(saved = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <SaveThreadButton id="thread" title="Office hours" saved={saved} />
    </QueryClientProvider>,
  );
  return { client, invalidate };
}

it.each([false, true])(
  "saves or removes a feed item and refreshes every saved projection (saved=%s)",
  async (saved) => {
    fixture.save.mockResolvedValue(null);
    fixture.unsave.mockResolvedValue(null);
    const { invalidate } = show(saved);
    fireEvent.click(
      screen.getByRole("button", {
        name: `${saved ? "Unsave" : "Save"} thread: Office hours`,
      }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(3));
    expect(
      saved ? fixture.unsave : fixture.save,
    ).toHaveBeenCalledExactlyOnceWith("thread");
    expect(saved ? fixture.save : fixture.unsave).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["threads"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["thread", "thread"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved"] });
  },
);

it("keeps the item unchanged after a failed save and allows a retry", async () => {
  fixture.save
    .mockRejectedValueOnce(new Error("Saving is temporarily unavailable."))
    .mockResolvedValueOnce(null);
  show();
  const button = screen.getByRole("button", {
    name: "Save thread: Office hours",
  });
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Saving is temporarily unavailable.",
  );
  expect(button).toHaveAttribute("aria-pressed", "false");
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(fixture.save).toHaveBeenCalledTimes(2);
});

it("keeps repeated clicks disabled until refreshed content finishes loading", async () => {
  const complete: Array<() => void> = [];
  fixture.save.mockResolvedValue(null);
  const { invalidate } = show();
  invalidate.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete.push(resolve);
      }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save thread: Office hours" }),
  );
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(3));
  expect(
    screen.getByRole("button", { name: "Save thread: Office hours" }),
  ).toBeDisabled();
  // All three invalidations are independent; resolving the final one alone must not re-enable the control.
  await act(async () => complete[2]());
  expect(
    screen.getByRole("button", { name: "Save thread: Office hours" }),
  ).toBeDisabled();
  await act(async () => {
    complete[0]();
    complete[1]();
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save thread: Office hours" }),
    ).toBeEnabled(),
  );
});

it.each([
  null,
  { id: "reader", status: "suspended" },
  { id: "reader", status: "deactivated" },
])("does not offer participation to an unavailable account (%s)", (user) => {
  fixture.user = user;
  show();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(fixture.save).not.toHaveBeenCalled();
  expect(fixture.unsave).not.toHaveBeenCalled();
});
