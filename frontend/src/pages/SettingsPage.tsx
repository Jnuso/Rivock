import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { useNavigate } from "react-router-dom";
import { useDraft } from "../components/MarkdownEditor";
import { ErrorBox, Loading } from "../components/States";
import { clearRivockDrafts, useAuth } from "../auth/AuthContext";
import { cpLen, LIMITS } from "../lib/limits";

const AVATARS = ["initials", "blue", "sage", "rose", "warm"] as const;

export function SettingsPage() {
  const { user } = useAuth();
  return <AccountSettings key={user?.id ?? "anonymous"} />;
}

function AccountSettings() {
  const { user, signIn, configured, authMessage, refreshMe } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const draft = useDraft(`profile:${user?.id ?? "anonymous"}`);
  let form: { bio: string; avatar: string; baseRevision: number | null } = {
    bio: "",
    avatar: "initials",
    baseRevision: null,
  };
  try {
    const parsed = JSON.parse(draft.value);
    if (
      typeof parsed.bio === "string" &&
      AVATARS.includes(parsed.avatar) &&
      Number.isInteger(parsed.baseRevision)
    )
      form = parsed;
  } catch {
    /* Initialize from the approved profile below. */
  }
  const update = (part: Partial<typeof form>) =>
    draft.set(JSON.stringify({ ...form, ...part }));
  const [confirm, setConfirm] = useState("");
  useEffect(() => {
    if (user && form.baseRevision === null)
      update({
        bio: user.bio,
        avatar: user.avatar_key,
        baseRevision: user.profile_revision,
      });
  }, [user?.profile_revision, form.baseRevision]);
  const blocks = useQuery({
    queryKey: ["blocks"],
    queryFn: () => api.getBlocks(),
    enabled: !!user,
  });

  const patch = useMutation({
    mutationFn: () =>
      api.patchMe({
        base_revision: form.baseRevision!,
        bio: form.bio.trim(),
        avatar_key: form.avatar as (typeof AVATARS)[number],
      }),
    onSuccess: async (res) => {
      if (res.submission.status === "published") {
        await refreshMe();
        draft.clear();
        void qc.invalidateQueries();
      } else {
        draft.clear();
        navigate(`/submissions/${res.submission.id}`);
      }
    },
    onError: (e) => {
      if (e instanceof ApiError && e.body?.error.submission_id)
        navigate(`/submissions/${e.body.error.submission_id}`);
      else if (
        e instanceof ApiError &&
        e.body?.error.code === "revision_conflict"
      )
        void refreshMe();
    },
  });

  const deactivate = useMutation({
    mutationFn: () => api.deleteMe(confirm),
    onSuccess: () => {
      clearRivockDrafts();
      qc.clear();
      window.location.href = "/";
    },
  });

  const unblock = useMutation({
    mutationFn: (id: string) => api.unblockUser(id),
    onSuccess: () => void qc.invalidateQueries(),
  });

  if (!user) {
    return (
      <div className="stack">
        <h1>Settings</h1>
        <button
          type="button"
          className="btn btnPrimary"
          onClick={() => {
            if (!configured) window.alert(authMessage);
            else void signIn("/settings");
          }}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Settings</h1>
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Profile</h2>
        <p className="muted">@{user.username}</p>
        <label className="field" htmlFor="bio">
          <span id="bio-label">Bio</span>
          <textarea
            id="bio"
            aria-labelledby="bio-label"
            aria-describedby="bio-count"
            value={form.bio}
            onChange={(e) => update({ bio: e.target.value })}
            maxLength={LIMITS.bio * 2}
          />
          <span className="muted" id="bio-count">
            {cpLen(form.bio)}/{LIMITS.bio}
          </span>
        </label>
        <label className="field" htmlFor="avatar">
          <span>Avatar</span>
          <select
            id="avatar"
            value={form.avatar}
            onChange={(e) => update({ avatar: e.target.value })}
          >
            {AVATARS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        {patch.error && <ErrorBox error={patch.error} />}
        {form.baseRevision !== null &&
          form.baseRevision !== user.profile_revision && (
            <div className="stack">
              <h3>A newer profile version is available</h3>
              <p>
                Current published bio: {user.bio || "(empty)"} · Avatar:{" "}
                {user.avatar_key}
              </p>
              <button
                className="btn"
                onClick={() => {
                  if (
                    !window.confirm(
                      "Replace your profile draft with the current published profile?",
                    )
                  )
                    return;
                  update({
                    bio: user.bio,
                    avatar: user.avatar_key,
                    baseRevision: user.profile_revision,
                  });
                  patch.reset();
                }}
              >
                Load current profile
              </button>
              <button
                className="btn"
                onClick={() => {
                  update({ baseRevision: user.profile_revision });
                  patch.reset();
                }}
              >
                Keep my profile draft against current version
              </button>
            </div>
          )}
        <button
          type="button"
          className="btn btnPrimary"
          disabled={
            cpLen(form.bio) > LIMITS.bio ||
            patch.isPending ||
            form.baseRevision !== user.profile_revision ||
            user.status !== "active"
          }
          onClick={() => patch.mutate()}
        >
          Save profile
        </button>
        <button className="btn" onClick={() => void refreshMe()}>
          Check latest profile
        </button>
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Blocked users</h2>
        {blocks.isLoading && <Loading />}
        {blocks.error && <ErrorBox error={blocks.error} />}
        {!blocks.data?.length && <p className="muted">No blocks.</p>}
        {blocks.data?.map((b) => (
          <div
            key={b.user_id}
            className="row"
            style={{ justifyContent: "space-between" }}
          >
            <span>{b.username}</span>
            <button
              type="button"
              className="btn"
              onClick={() => unblock.mutate(b.user_id)}
            >
              Unblock
            </button>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Deactivate account</h2>
        <p className="muted">
          Deactivation hides your profile and prevents participation. Your
          public contributions remain under [deleted]. Delete any contribution
          text you want removed before deactivating. This does not delete your
          Clerk sign-in account.
        </p>
        <label className="field" htmlFor="confirm">
          <span>Type your username to confirm</span>
          <input
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {deactivate.error && <ErrorBox error={deactivate.error} />}
        <button
          type="button"
          className="btn btnDanger"
          disabled={confirm !== user.username || deactivate.isPending}
          onClick={() => deactivate.mutate()}
        >
          Deactivate
        </button>
      </section>
    </div>
  );
}
