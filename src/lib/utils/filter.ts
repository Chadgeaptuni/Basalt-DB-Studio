// The one text matcher (DESIGN §10). The command palette and every panel filter
// use it, so "does `usr` find `users`?" has a single answer everywhere.
//
// Subsequence, not substring: typing `ordit` should still find `order_items`,
// which is the whole point of a palette. Scoring is deliberately simple — enough
// to float the obvious match to the top, not a ranking engine.

/**
 * Score `text` against `query`, or `null` when the query isn't a subsequence.
 * Higher is better. Runs in O(text length) with no allocation per candidate,
 * because it is called for every table on every keystroke.
 */
export function matchScore(text: string, query: string): number | null {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  let score = 0;
  let ti = 0;
  let prevHit = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    const hit = t.indexOf(c, ti);
    if (hit === -1) return null;

    // Consecutive characters are worth far more than scattered ones, so `user`
    // ranks `users` above `underscore_separator`.
    if (hit === prevHit + 1) score += 8;
    // A match at a word boundary is the next-best signal.
    else if (hit === 0 || t[hit - 1] === "_" || t[hit - 1] === "." || t[hit - 1] === " ") score += 4;
    else score += 1;

    prevHit = hit;
    ti = hit + 1;
  }

  // Shorter targets win ties: `users` beats `users_audit_log` for `users`.
  return score - t.length * 0.01;
}

/** Filter and rank `items` by `key`, preserving input order when the query is empty. */
export function filterRank<T>(items: T[], query: string, key: (item: T) => string): T[] {
  if (!query.trim()) return items;
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const score = matchScore(key(item), query);
    if (score !== null) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
