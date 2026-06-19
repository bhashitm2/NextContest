/** Public profile usernames: 3–30 chars, lowercase letters/digits/_/-, must
 * start with a letter or digit. Validated on both client and server. */
export const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

/** Route segments and brand words that can't be claimed as usernames. */
const RESERVED = new Set([
  "u",
  "api",
  "contests",
  "contest",
  "profile",
  "profiles",
  "login",
  "logout",
  "signin",
  "signout",
  "auth",
  "settings",
  "admin",
  "about",
  "home",
  "help",
  "support",
  "terms",
  "privacy",
  "nextcontest",
  "next-contest",
  "calendar",
  "cron",
  "me",
  "user",
  "users",
]);

/** Normalize raw input to the canonical (lowercased, trimmed) form. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns an error message if invalid, or null if the username is acceptable. */
export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (!USERNAME_RE.test(u)) {
    return "Use 3–30 characters: lowercase letters, digits, - or _ (must start with a letter or digit).";
  }
  if (RESERVED.has(u)) return "That username is reserved.";
  return null;
}
