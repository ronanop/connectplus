/** Parse user `tags_json` — shared with settings user list. */
export function tagsFromJson(v: unknown): string[] {
  if (v == null) {
    return [];
  }
  if (!Array.isArray(v)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== "string") {
      continue;
    }
    const n = x.trim();
    if (!n) {
      continue;
    }
    const key = n.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(n);
  }
  return out;
}
