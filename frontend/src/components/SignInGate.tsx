import { useAuth } from "../auth/AuthContext";
export function SignInGate({ title }: { title: string }) {
  const { configured, signIn, authMessage, loading } = useAuth();
  return (
    <div className="stack">
      <h1>{title}</h1>
      <p>Sign in to continue.</p>
      <button
        className="btn btnPrimary"
        disabled={!configured || loading}
        onClick={() => void signIn()}
      >
        {loading ? "Loading…" : "Sign in"}
      </button>
      {authMessage && (
        <p role="status" className="muted">
          {authMessage}
        </p>
      )}
    </div>
  );
}
