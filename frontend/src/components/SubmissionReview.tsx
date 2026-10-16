import type { Submission } from "../api";

export function SubmissionReview({
  submission,
  detailed = false,
}: {
  submission: Submission;
  detailed?: boolean;
}) {
  const review = submission.review;
  if (!review)
    return (
      <p className="muted">
        {["pending", "processing", "needs_review"].includes(submission.status)
          ? "Awaiting a completed moderation check"
          : "Review details unavailable"}
      </p>
    );
  const source = {
    ai: "Reviewed by AI",
    rules: "Checked by automatic rules",
    fixture: "Demo check",
    admin: "Reviewed by a moderator",
  }[review.source];
  const decision = {
    allow: "Allowed",
    reject: "Rejected",
    uncertain: "Inconclusive",
  }[review.decision];
  return (
    <div className="stack" aria-label="Last completed moderation check">
      <span className="badge">
        {source} · {decision}
      </span>
      {detailed && (
        <p className="muted">
          Last completed check
          {review.source === "ai" && review.model?.startsWith("gemma-4-")
            ? " by Gemma 4"
            : ""}
          : {new Date(review.completed_at).toLocaleString()}.
        </p>
      )}
    </div>
  );
}
