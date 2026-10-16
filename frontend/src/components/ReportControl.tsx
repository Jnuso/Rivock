import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { ErrorBox } from "./States";
export const REPORT_REASONS = [
  "spam/scam",
  "harassment",
  "hate/threat",
  "personal information",
  "other",
];
export function ReportControl({
  target,
}: {
  target: { thread_id?: string; reply_id?: string; user_id?: string };
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState("spam/scam"),
    [detail, setDetail] = useState("");
  const report = useMutation({
    mutationFn: () => api.report({ ...target, reason, detail }),
    onSuccess: () => setOpen(false),
  });
  return (
    <div className="stack">
      <button
        className="btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Report
      </button>
      {report.isSuccess && <p role="status">Report received.</p>}
      {open && (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            report.mutate();
          }}
        >
          <label className="field">
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REPORT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Additional context (optional)
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={1000}
            />
          </label>
          {report.error && <ErrorBox error={report.error} />}
          <button className="btn btnPrimary" disabled={report.isPending}>
            Submit report
          </button>
        </form>
      )}
    </div>
  );
}
