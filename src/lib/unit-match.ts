import { normalizeName, rankByName } from "./search.js";

type NamedFactioned = {
  name: string;
  faction: string;
  keywords: string[];
};

/**
 * Is this entry the "canonical" home of its datasheet — i.e. does the
 * catalogue it lives in match its own faction keyword?
 *
 * BSData imports a datasheet into every faction that can take it as an ally
 * (Genestealer Cults get "Leman Russ Battle Tank", every Space Marine chapter
 * gets "Knight Paladin"), producing several `Unit` objects that differ only by
 * `faction`. The imported copies keep the *original* army's faction keyword
 * ("Astra Militarum", "Imperial Knights"), so the copy whose `faction` is
 * exactly one of its own `keywords` is the real one.
 *
 * The match is exact, not a prefix: a broad keyword like "Chaos" must not be
 * allowed to vouch for both "Chaos Daemons" and "Chaos Space Marines" — that
 * is the very collision we are trying to break.
 */
export function isCanonicalFaction(entry: NamedFactioned): boolean {
  const faction = normalizeName(entry.faction);
  if (!faction) return false;
  return entry.keywords.some((kw) => normalizeName(kw) === faction);
}

/** Compare everything the lookup formatter can return, except catalogue identity. */
export function datasheetContentKey<T extends NamedFactioned>(entry: T): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(entry).filter(([field]) => !["id", "faction", "gameSystem"].includes(field)),
    ),
  );
}

function dedupeKey<T extends NamedFactioned>(entry: T, contentOf: (item: T) => string): string {
  return JSON.stringify([normalizeName(entry.name), normalizeName(entry.faction), contentOf(entry)]);
}

/**
 * Rank `units` for a `lookup_*`-style "which datasheet did they mean" query:
 * score by name and keep the best-scoring tier, then drop cross-faction
 * *imports* — a non-canonical entry whose content is already carried by a
 * canonical entry in that tier (Genestealer Cults' copy of the Astra Militarum
 * Leman Russ). A non-canonical entry with content no canonical entry has —
 * a genuinely parallel datasheet, e.g. the faster World Eaters Helbrute — is
 * kept. Exact-duplicate entries are collapsed; order is stable.
 *
 * `contentOf` maps an entry to comparable returned content; the default treats
 * every entry as identical, which collapses to "keep only the canonical
 * copies when any exist".
 */
export function rankUnitMatches<T extends NamedFactioned>(
  units: T[],
  query: string,
  contentOf: (item: T) => string = () => "",
  minScore = 0.3,
): T[] {
  const ranked = rankByName(units, query, (u) => u.name, minScore);
  if (ranked.length === 0) return [];

  const topScore = ranked[0].score;
  const top: T[] = [];
  const rest: T[] = [];
  for (const r of ranked) {
    (Math.abs(r.score - topScore) < 1e-9 ? top : rest).push(r.item);
  }

  const canonicalContents = new Set(top.filter(isCanonicalFaction).map(contentOf));
  const trimmedTop = top.filter(
    (e) => isCanonicalFaction(e) || !canonicalContents.has(contentOf(e)),
  );

  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of [...trimmedTop, ...rest]) {
    const key = dedupeKey(entry, contentOf);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * Given the output of `rankUnitMatches`, is the leading result still a genuine
 * ambiguity — one datasheet name with different returned content, possibly
 * within the same faction? If so, `lookup_unit` should offer every selectable
 * variant rather than silently pick one. This
 * mirrors the disambiguation `lookup_stratagem` already does for name
 * collisions.
 *
 * Only a near-exact query is disambiguated — a loose/partial match resolving
 * to its best guess is expected behaviour. Same-name imports that share content
 * (the Chaos triad's shared datasheets, a unit fielded identically by
 * many Space Marine chapters) are not flagged: any copy gives the same answer.
 *
 * Returns one entry per faction and distinct content (stable order), or
 * `null` when there is nothing to disambiguate.
 */
export function ambiguousFactionMatches<T extends NamedFactioned>(
  matches: T[],
  query: string,
  contentOf: (item: T) => string,
): T[] | null {
  if (matches.length < 2) return null;
  if ((rankByName([matches[0]], query, (u) => u.name)[0]?.score ?? 0) < 0.9) return null;

  const topName = normalizeName(matches[0].name);
  const contents = new Set<string>();
  const options = new Map<string, T>();
  for (const m of matches) {
    if (normalizeName(m.name) !== topName) continue;
    const faction = normalizeName(m.faction);
    const content = contentOf(m);
    contents.add(content);
    const key = JSON.stringify([faction, content]);
    if (!options.has(key)) options.set(key, m);
  }
  if (contents.size < 2) return null;

  return [...options.values()];
}
