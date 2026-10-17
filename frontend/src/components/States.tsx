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

export function ErrorBox({
  error,
  onRetry,
  retrying = false,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const message =
    (error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : ""
    ).trim() || "Something went wrong.";
  return (
    <div className="errorBox" role="alert">
      <div>{message}</div>
      {onRetry && (
        <button
          type="button"
          className="btn"
          style={{ marginTop: "0.5rem" }}
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? "Trying again…" : "Try again"}
        </button>
      )}
    </div>
  );
}

export function QueryError({
  query,
}: {
  query: {
    error: unknown;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  };
}) {
  return query.error ? (
    <ErrorBox
      error={query.error}
      onRetry={() => void query.refetch()}
      retrying={query.isFetching}
    />
  ) : null;
}
