import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";
import { Empty, ErrorBox, Loading, QueryError } from "../components/States";
import { useAuth } from "../auth/AuthContext";
import { ReportControl } from "../components/ReportControl";
import { usePaged, More } from "../lib/paging";

export function ProfilePage() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient(),
    navigate = useNavigate();
  const [type, setType] = useState<"threads" | "replies">("threads");
  const profile = useQuery({
    queryKey: ["user", username],
    queryFn: () => api.getUser(username),
  });
  const contributions = usePaged(["contributions", username, type], (offset) =>
    api.getContributions(username, type, offset),
  );
  const block = useMutation({
    mutationFn: () => api.blockUser(profile.data!.id),
    onSuccess: () => {
      qc.clear();
      navigate("/");
    },
  });
  if (profile.isLoading) return <Loading />;
  if (profile.error) return <QueryError query={profile} />;
  if (!profile.data) return <Empty>Profile unavailable.</Empty>;
  const p = profile.data;
  return (
    <div className="stack">
      <h1>@{p.username}</h1>
      <p>{p.bio || "No bio yet."}</p>
      {p.is_bot && <span className="badge">Fictional demo account</span>}
      {user && user.id !== p.id && (
        <div className="row">
          <button
            className="btn"
            disabled={block.isPending}
            onClick={() => block.mutate()}
          >
            Block user
          </button>
          <ReportControl target={{ user_id: p.id }} />
        </div>
      )}
      {block.error && <ErrorBox error={block.error} />}
      <div className="row">
        <button
          className="btn"
          aria-pressed={type === "threads"}
          onClick={() => setType("threads")}
        >
          Threads
        </button>
        <button
          className="btn"
          aria-pressed={type === "replies"}
          onClick={() => setType("replies")}
        >
          Replies
        </button>
      </div>
      {contributions.isLoading && <Loading />}
      <QueryError query={contributions} />
      {!contributions.isLoading &&
        !contributions.error &&
        !contributions.items.length && <Empty>No public {type}.</Empty>}
      {contributions.items.map((item) => (
        <article className="card" key={item.id}>
          {"title" in item ? (
            <Link to={`/threads/${item.id}`}>{item.title}</Link>
          ) : (
            <>
              <Link to={`/threads/${item.thread_id}#reply-${item.id}`}>
                View conversation
              </Link>
              <p>{item.body_markdown?.slice(0, 240)}</p>
            </>
          )}
        </article>
      ))}
      <More query={contributions} />
    </div>
  );
}
