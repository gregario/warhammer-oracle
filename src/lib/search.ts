function matchesValue(value: unknown, lower: string): boolean {
  if (typeof value === "string") return value.toLowerCase().includes(lower);
  if (Array.isArray(value)) return value.some((v) => matchesValue(v, lower));
  if (value && typeof value === "object")
    return Object.values(value).some((v) => matchesValue(v, lower));
  return false;
}

export function fuzzySearch<T extends Record<string, unknown>>(
  items: T[],
  query: string,
  fields: (keyof T)[],
): T[] {
  if (!query.trim()) return [...items];
  const lower = query.toLowerCase();
  return items.filter((item) =>
    fields.some((field) => matchesValue(item[field], lower)),
  );
}

// === Ranked name matching ===
//
// `fuzzySearch` is a pure substring filter, so callers that want "the one
// datasheet the user meant" (e.g. lookup_unit) were left picking `matches[0]`
// in data-file order — which silently resolves "Leman Russ Battle Tank" to
// whichever catalogue happens to serialize first. `scoreName` / `rankByName`
// add an ordering: exact name beats a plural/singular variant beats a
// leading-word-run prefix beats an out-of-order token subset beats a bare
// substring beats a loose trigram match.

/** Lowercase, replace every non-alphanumeric run with a single space, trim. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Crude English singular fold so "Intercessors" matches "Intercessor Squad". */
function stemToken(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && (token.endsWith("ses") || token.endsWith("xes")))
    return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss"))
    return token.slice(0, -1);
  return token;
}

function stemPhrase(s: string): string {
  return s.split(" ").filter(Boolean).map(stemToken).join(" ");
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Jaccard similarity over character trigrams, 0..1. */
function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const g of ta) if (tb.has(g)) intersection++;
  return intersection / (ta.size + tb.size - intersection);
}

/**
 * How well `query` names `name`, from 0 (no match) to 1 (exact).
 * The tiers are deliberately well separated so a better *kind* of match
 * always outranks a worse one regardless of the within-tier adjustment.
 */
export function scoreName(query: string, name: string): number {
  const q = normalizeName(query);
  const n = normalizeName(name);
  if (!q || !n) return 0;
  if (q === n) return 1;

  const qStem = stemPhrase(q);
  const nStem = stemPhrase(n);
  if (qStem === nStem) return 0.95;

  // "leman russ" → "leman russ battle tank"
  if (n === q || n.startsWith(`${q} `)) return 0.9;
  if (nStem.startsWith(`${qStem} `)) return 0.88;

  // "battle tank" → "leman russ battle tank" (whole-word run, not at the start)
  if (n.endsWith(` ${q}`) || n.includes(` ${q} `)) return 0.82;

  // Every query token appears somewhere in the name as a whole word.
  const nTokens = new Set(nStem.split(" "));
  const qTokens = qStem.split(" ");
  if (qTokens.every((t) => nTokens.has(t))) {
    const extra = Math.max(0, nTokens.size - qTokens.length);
    return Math.max(0.6, 0.75 - 0.03 * extra);
  }

  // Bare substring in either direction.
  if (n.includes(q) || q.includes(n)) return 0.55;

  const sim = trigramSimilarity(q, n);
  if (sim >= 0.5) return 0.3 + 0.2 * ((sim - 0.5) / 0.5);
  return 0;
}

/**
 * Sort `items` by how well `query` matches the name returned by `nameOf`,
 * best first, dropping anything below `minScore`. Stable within a score
 * (Array.prototype.sort is stable), so data-file order is the final tiebreak.
 */
export function rankByName<T>(
  items: T[],
  query: string,
  nameOf: (item: T) => string,
  minScore = 0,
): { item: T; score: number }[] {
  return items
    .map((item) => ({ item, score: scoreName(query, nameOf(item)) }))
    .filter((r) => r.score > 0 && r.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
