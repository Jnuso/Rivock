import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { ErrorBox } from "./States";

export function SaveThreadButton({
  id,
  title,
  saved,
}: {
  id: string;
  title: string;
  saved: boolean;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const change = useMutation({
    mutationFn: () => (saved ? api.unsaveThread(id) : api.saveThread(id)),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["threads"] }),
        client.invalidateQueries({ queryKey: ["thread", id] }),
        client.invalidateQueries({ queryKey: ["saved"] }),
      ]);
    },
  });
  if (!user || user.status !== "active") return null;
  return (
    <div className="stack">
      <button
        type="button"
        className="btn"
        aria-label={`${saved ? "Unsave" : "Save"} thread: ${title}`}
        aria-pressed={saved}
        disabled={change.isPending}
        onClick={() => change.mutate()}
      >
        {change.isPending
          ? saved
            ? "Removing…"
            : "Saving…"
          : saved
            ? "Saved ✓"
            : "Save thread"}
      </button>
      {change.error && <ErrorBox error={change.error} />}
    </div>
  );
}
