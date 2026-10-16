export const cpLen = (text: string) => Array.from(text).length;

export const LIMITS = {
  title: 200,
  body: 10000,
  reply: 5000,
  bio: 300,
  query: 200,
  adminReason: 1000,
  username: 24,
} as const;

export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (!u) return "Username is required.";
  if (cpLen(u) < 3 || cpLen(u) > LIMITS.username)
    return "Username must be 3–24 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(u))
    return "Use letters, numbers, and underscores only.";
  return null;
}

export function isAllowedHttpUrl(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
