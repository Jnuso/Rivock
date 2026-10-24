import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyLink, profilePath } from "../components/CopyLink";
import { Markdown } from "../components/Markdown";
import { api } from "../api";
import { Empty, ErrorBox, Loading, QueryError } from "../components/States";
import { useAuth } from "../auth/AuthContext";
import { ReportControl } from "../components/ReportControl";
import { usePaged, More } from "../lib/paging";

export function ProfilePage() {
  const { username = "" } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const type = params.get("view") === "replies" ? "replies" : "threads";
  const setType = (nextType: "threads" | "replies") => {
    const next = new URLSearchParams(params);
    if (nextType === "replies") next.set("view", "replies");
    else next.delete("view");
    if (next.toString() !== params.toString()) setParams(next);
  };
  const profile = useQuery({
    queryKey: ["user", username],
    queryFn: () => api.getUser(username),
  });
  const contributions = usePaged(
    ["contributions", username, type],
    (offset) => api.getContributions(username, type, offset),
    !!profile.data,
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
      <CopyLink path={profilePath(p.username, type)} label="Profile link" />
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
      <div className="row" role="group" aria-label="Public contributions">
        <button
          type="button"
          className={type === "threads" ? "btn btnPrimary" : "btn"}
          aria-pressed={type === "threads"}
          onClick={() => setType("threads")}
        >
          Threads
        </button>
        <button
          type="button"
          className={type === "replies" ? "btn btnPrimary" : "btn"}
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
        <article className="card readingCard" key={item.id}>
          {"title" in item ? (
            <Link
              to={`/threads/${item.id}`}
              state={{ feedReturn: location.pathname + location.search }}
            >
              {item.title}
            </Link>
          ) : (
            <>
              <Link
                to={`/threads/${item.thread_id}#reply-${item.id}`}
                state={{ feedReturn: location.pathname + location.search }}
              >
                View conversation
              </Link>
              <div className="readingExcerpt">
                <Markdown source={item.body_markdown?.slice(0, 240) ?? ""} />
              </div>
            </>
          )}
        </article>
      ))}
      <More query={contributions} />
    </div>
  );
}
