/**
 * Canonical key for detecting duplicate user rows that share the same mailbox identity
 * (case, invisible characters, unicode compatibility).
 */
export function normalizeEmailKey(email: string): string {
  return email
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Canonical key for finding multiple accounts that may belong to the same person
 * (identical display name after normalizing whitespace and case).
 */
export function normalizeNameKey(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
