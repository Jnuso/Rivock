export const RETURN_PATH_KEY = "rivock.auth.returnPath";
export type ClerkPublicConfig = {
  publishableKey: string;
  frontendOrigin: string;
};

/** Decode only a public key, validating the hostname before using it in CSP. */
export function clerkFrontendOrigin(key: string): string | null {
  const match = /^pk_(test|live)_([A-Za-z0-9_-]+={0,2})$/.exec(key);
  if (!match) return null;
  try {
    const decoded = atob(match[2].replace(/-/g, "+").replace(/_/g, "/"));
    if (!decoded.endsWith("$")) return null;
    const host = decoded.slice(0, -1);
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host))
      return null;
    return new URL(`https://${host}`).origin;
  } catch {
    return null;
  }
}

export function readClerkConfig(): ClerkPublicConfig | null {
  const publishableKey = (
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? ""
  ).trim();
  const frontendOrigin = clerkFrontendOrigin(publishableKey);
  return frontendOrigin ? { publishableKey, frontendOrigin } : null;
}
