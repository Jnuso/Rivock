import { safeReturnPath } from "../auth/safeReturnPath";

export function readFeedReturn(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const path = safeReturnPath((state as { feedReturn?: unknown }).feedReturn);
  if (!path) return null;
  const url = new URL(path, window.location.origin);
  if (
    url.hash ||
    !(
      url.pathname === "/" ||
      url.pathname === "/saved" ||
      /^\/t\/[a-z0-9-]+$/.test(url.pathname)
    )
  )
    return null;
  return `${url.pathname}${url.search}`;
}

export function feedReturnState(path: string | null) {
  return path ? { feedReturn: path } : null;
}
