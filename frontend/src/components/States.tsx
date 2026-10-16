export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="muted" role="status">
      {label}
    </p>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="emptyBox">{children}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="errorBox" role="alert">
      {message}
    </div>
  );
}
