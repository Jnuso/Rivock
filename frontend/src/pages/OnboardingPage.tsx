import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { RETURN_PATH_KEY } from "../auth/config";
import { safeReturnPath } from "../auth/safeReturnPath";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { validateUsername } from "../lib/limits";
import { ErrorBox } from "../components/States";

export function OnboardingPage() {
  const { account, configured, signIn, authMessage, refreshMe, me } = useAuth();
  const [username, setUsername] = useState("");
  const navigate = useNavigate();
  const fieldError = validateUsername(username);

  const create = useMutation({
    mutationFn: () => api.createMe(username.trim()),
    onSuccess: async () => {
      await refreshMe();
      let path: string | null = null;
      try {
        path = safeReturnPath(sessionStorage.getItem(RETURN_PATH_KEY));
        sessionStorage.removeItem(RETURN_PATH_KEY);
      } catch {
        /* Continue to the feed when storage is unavailable. */
      }
      navigate(path && path !== "/onboarding" ? path : "/");
    },
  });

  if (!configured) {
    return (
      <div className="stack">
        <h1>Choose a username</h1>
        <ErrorBox error={authMessage} />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="stack">
        <h1>Choose a username</h1>
        <button
          type="button"
          className="btn btnPrimary"
          onClick={() => void signIn("/onboarding")}
        >
          Sign in first
        </button>
      </div>
    );
  }

  if (me && !me.onboarding_required && me.user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <h1 style={{ margin: 0 }}>Choose a username</h1>
      <p className="muted">This becomes your public Rivock identity.</p>
      <label className="field" htmlFor="username">
        <span>Username</span>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          aria-invalid={!!username && !!fieldError}
        />
      </label>
      {username && fieldError && <ErrorBox error={fieldError} />}
      {create.error && <ErrorBox error={create.error} />}
      <button
        type="button"
        className="btn btnPrimary"
        disabled={!!fieldError || create.isPending}
        onClick={() => create.mutate()}
      >
        Continue
      </button>
    </div>
  );
}
