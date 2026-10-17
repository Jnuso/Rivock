import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ErrorBox, QueryError } from "./States";

afterEach(() => cleanup());

it.each([new Error("The connection is unavailable."), "A reason is required."])(
  "preserves a useful error message",
  (error) => {
    render(<ErrorBox error={error} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      error instanceof Error ? error.message : error,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  },
);

it("uses a fallback for unknown errors without dumping arbitrary data", () => {
  render(<ErrorBox error={{ detail: "internal data" }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
  expect(screen.queryByText("internal data")).not.toBeInTheDocument();
});

it("prevents repeated retries while a query request is in progress", () => {
  const refetch = vi.fn().mockResolvedValue({});
  const query = { error: new Error("Unavailable"), isFetching: true, refetch };
  const view = render(<QueryError query={query} />);
  const busy = screen.getByRole("button", { name: "Trying again…" });
  expect(busy).toBeDisabled();
  fireEvent.click(busy);
  expect(refetch).not.toHaveBeenCalled();
  view.rerender(<QueryError query={{ ...query, isFetching: false }} />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(refetch).toHaveBeenCalledOnce();
});
