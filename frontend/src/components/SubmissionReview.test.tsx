import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Submission } from "../api";
import { SubmissionReview } from "./SubmissionReview";

afterEach(cleanup);
const base: Submission = {
  id: "submission",
  status: "published",
  action: "create_thread",
  content_id: "thread",
  thread_id: "thread",
  reason_code: "policy",
  error_category: null,
  next_attempt_at: null,
  created_at: "2026-10-14T12:00:00Z",
  snapshot_available: true,
};

it.each([
  ["ai", "Reviewed by AI"],
  ["rules", "Checked by automatic rules"],
  ["fixture", "Demo check"],
  ["admin", "Reviewed by a moderator"],
] as const)(
  "identifies a completed %s check without inferring AI from publication",
  (source, label) => {
    render(
      <SubmissionReview
        submission={{
          ...base,
          review: {
            source,
            decision: "allow",
            model: source === "ai" ? "gemma-4-26b-a4b-it" : null,
            completed_at: "2026-10-14T12:00:01Z",
          },
        }}
      />,
    );
    expect(screen.getByText(`${label} · Allowed`)).toBeVisible();
    if (source !== "ai")
      expect(screen.queryByText(/Reviewed by AI/)).not.toBeInTheDocument();
  },
);

it("keeps a published but inconclusive AI check distinct from an allow decision", () => {
  render(
    <SubmissionReview
      detailed
      submission={{
        ...base,
        review: {
          source: "ai",
          decision: "uncertain",
          model: "gemma-4-26b-a4b-it",
          completed_at: "2026-10-14T12:00:01Z",
        },
      }}
    />,
  );
  expect(screen.getByText("Reviewed by AI · Inconclusive")).toBeVisible();
  expect(screen.getByText(/Last completed check by Gemma 4/)).toBeVisible();
  expect(screen.queryByText(/Allowed/)).not.toBeInTheDocument();
});

it("does not claim review when an attempt failed or is still pending", () => {
  render(
    <SubmissionReview
      submission={{ ...base, status: "pending", review: null }}
    />,
  );
  expect(
    screen.getByText("Awaiting a completed moderation check"),
  ).toBeVisible();
  expect(screen.queryByText(/Reviewed by AI/)).not.toBeInTheDocument();
});

it("does not infer a historical review source from a published status", () => {
  render(<SubmissionReview submission={base} />);
  expect(screen.getByText("Review details unavailable")).toBeVisible();
  expect(screen.queryByText(/Reviewed by AI/)).not.toBeInTheDocument();
});
