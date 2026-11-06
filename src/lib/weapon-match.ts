import { normalizeName, rankByName } from "./search.js";

// === Weapon lookup ===
//
// Weapons only exist inside datasheets, and the same weapon is repeated on
// every datasheet (and every faction-list copy of that datasheet) that carries
// it. `lookup_weapon` answers "what are the stats of a plasma gun" by pulling
// every copy, grouping identical profiles, and leading with the most common
// one. These helpers are edition-agnostic: the tool maps 40K and Kill Team
// weapons into `WeaponEntry` rows.

/** One weapon profile line as carried by one datasheet. */
export type WeaponEntry = {
  /** Datasheet ID: entries with the same ID are one datasheet's profile lines. */
  carrierId: string;
  /** Datasheet name, used to dedupe faction-list copies and as an example. */
  carrier: string;
  /** Raw weapon/profile name from the data, e.g. "➤ Plasma gun - standard". */
  name: string;
  /** Profile cells that belong to the weapon itself (range, A, S, AP, D, …). */
  cells: string[];
  keywords: string[];
  /** BS/WS/Hit — a property of the bearer, so never part of the grouping key. */
  skill: string;
};

export type WeaponProfileRow = {
  /** Profile label for multi-profile weapons ("standard", "supercharge"), else "". */
  label: string;
  cells: string[];
  keywords: string[];
};

/** One distinct profile set and every datasheet that carries exactly it. */
export type WeaponVariant = {
  rows: WeaponProfileRow[];
  /** Distinct datasheet names, in data order. */
  carriers: string[];
  /** Distinct bearer skill values (BS/WS/Hit) seen with this profile set. */
  skills: string[];
};

export type WeaponNameMatch = {
  /** Normalized base names to answer with; empty when nothing matched well enough. */
  names: Set<string>;
  /** True when the answer is a typo-level guess rather than the name asked for. */
  closest: boolean;
  /** Display names of the best near-misses, for "did you mean". */
  suggestions: string[];
};

/**
 * Split a weapon name into the weapon's own name and its profile label.
 *
 * Multi-profile weapons are listed one line per profile, prefixed with "➤ "
 * ("➤ Plasma gun - standard", "➤ Plasma pistol- supercharge",
 * "➤ Grenade Launcher (Frag)"); a few skip the arrow ("Shearing claws - strike").
 * Kill Team writes profiles in parentheses ("Plasma gun (standard)"), so pass
 * `parenProfiles` there. A plain hyphen inside a name ("Combi-weapon") is not
 * a profile separator: the separator always has whitespace after it.
 */
export function splitWeaponName(
  name: string,
  parenProfiles = false,
): { base: string; label: string } {
  const arrowed = /^➤/.test(name);
  const stripped = name.replace(/^➤\s*/, "").trim();
  const dash = stripped.match(/^(.+?)\s*-\s+(\S.*)$/);
  if (dash) return { base: dash[1].trim(), label: dash[2].trim() };
  if (arrowed || parenProfiles) {
    const paren = stripped.match(/^(.+?)\s*\(([^()]+)\)$/);
    if (paren) return { base: paren[1].trim(), label: paren[2].trim() };
  }
  return { base: stripped, label: "" };
}

/** Keywords sorted case-insensitively, so "Rapid Fire 1, Hazardous" reads like "Hazardous, Rapid Fire 1". */
export function sortKeywords(keywords: string[]): string[] {
  return [...keywords]
    .map((k) => k.trim())
    .filter(Boolean)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * Comparable identity of one profile line: label, weapon cells, and keywords
 * with order and case ignored (the data has both "Twin-linked" and
 * "Twin-Linked"). Bearer skill is deliberately excluded.
 */
export function weaponProfileKey(row: WeaponProfileRow): string {
  return JSON.stringify([
    row.label.toLowerCase(),
    row.cells.map((c) => c.trim()),
    sortKeywords(row.keywords).map((k) => k.toLowerCase()),
  ]);
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  for (const [v, n] of counts) if (n > (counts.get(best) ?? 0)) best = v;
  return best;
}

/**
 * Decide which weapon `query` names. The match is on the weapon's own name
 * (profile suffix stripped), and only an exact or plural/singular match is
 * answered: "plasma gun" must not pull in "Twin plasma gun" or
 * "EtaCarn plasma gun", which are different weapons. Those surface only as
 * suggestions when nothing matches exactly. A lone typo-level match
 * ("lascanon") is answered as the closest guess, flagged so the caller can
 * say so.
 */
export function matchWeaponName(
  baseNames: string[],
  query: string,
  maxSuggestions = 8,
): WeaponNameMatch {
  const spellings = new Map<string, string[]>();
  for (const base of baseNames) {
    const key = normalizeName(base);
    if (!key) continue;
    spellings.set(key, [...(spellings.get(key) ?? []), base]);
  }
  const ranked = rankByName([...spellings.keys()], query, (k) => k, 0.3);
  const suggestions = ranked
    .slice(0, maxSuggestions)
    .map((r) => mostCommon(spellings.get(r.item) ?? [r.item]));
  if (ranked.length === 0) return { names: new Set(), closest: false, suggestions };

  const top = ranked[0].score;
  const topTier = ranked.filter((r) => Math.abs(r.score - top) < 1e-9).map((r) => r.item);
  if (top >= 0.95) return { names: new Set(topTier), closest: false, suggestions: [] };
  // Below the substring tier (0.55) the score is pure trigram similarity: a misspelling.
  if (top < 0.55 && topTier.length === 1) return { names: new Set(topTier), closest: true, suggestions: [] };
  return { names: new Set(), closest: false, suggestions };
}

/**
 * Group entries (already narrowed to one weapon) into distinct profile sets.
 * Each datasheet contributes the set of profile lines it carries; datasheets
 * with the same set — compared via `weaponProfileKey`, so keyword order and
 * case don't create fake variants — share a variant. Faction-list copies of a
 * datasheet are counted once (by datasheet name). Sorted most-carried first.
 */
export function groupWeaponVariants(entries: WeaponEntry[], parenProfiles = false): WeaponVariant[] {
  // Keyed by datasheet ID, not name: two different datasheets can share a
  // name (and carry different profiles), while one datasheet imported into
  // several faction lists keeps its ID.
  type Carrier = { carrier: string; rows: Map<string, WeaponProfileRow>; skills: string[] };
  const perCarrier = new Map<string, Carrier>();
  for (const e of entries) {
    const row: WeaponProfileRow = {
      label: splitWeaponName(e.name, parenProfiles).label,
      cells: e.cells,
      keywords: sortKeywords(e.keywords),
    };
    const carrier: Carrier = perCarrier.get(e.carrierId) ?? { carrier: e.carrier, rows: new Map(), skills: [] };
    const key = weaponProfileKey(row);
    if (!carrier.rows.has(key)) carrier.rows.set(key, row);
    carrier.skills.push(e.skill);
    perCarrier.set(e.carrierId, carrier);
  }

  const variants = new Map<string, WeaponVariant>();
  for (const { carrier, rows, skills } of perCarrier.values()) {
    const signature = JSON.stringify([...rows.keys()].sort());
    const variant: WeaponVariant = variants.get(signature) ?? {
      rows: [...rows.values()],
      carriers: [],
      skills: [],
    };
    if (!variant.carriers.includes(carrier)) variant.carriers.push(carrier);
    for (const s of skills) if (s && !variant.skills.includes(s)) variant.skills.push(s);
    variants.set(signature, variant);
  }

  // Rank by current datasheets first: [Legends] and [Crucible] entries are
  // numerous enough to outvote the real profile (e.g. boltgun).
  return [...variants.values()].sort(
    (a, b) => countCurrent(b.carriers) - countCurrent(a.carriers) || b.carriers.length - a.carriers.length,
  );
}

/** True for a current datasheet, false for [Legends] / [Crucible] entries. */
export function isCurrentDatasheet(name: string): boolean {
  return !/\[(legends|crucible)\]/i.test(name);
}

export function countCurrent(carriers: string[]): number {
  return carriers.filter(isCurrentDatasheet).length;
}

/**
 * Short "what's different" note for a variant against the standard profile,
 * e.g. `standard: AP -1 (vs -2); supercharge: AP -2 (vs -3)`, `+Precision`, or
 * `only the standard profile`. Returns "" when the two sets have different
 * profile lines, so a line-by-line comparison would mislead.
 */
export function describeVariantDifference(
  standard: WeaponVariant,
  variant: WeaponVariant,
  cellHeaders: string[],
): string {
  if (standard.rows.length !== variant.rows.length) {
    // A datasheet that lists only some of the standard profiles (e.g. no supercharge).
    const standardKeys = new Set(standard.rows.map(weaponProfileKey));
    const subset =
      variant.rows.length < standard.rows.length &&
      variant.rows.every((r) => standardKeys.has(weaponProfileKey(r)));
    if (!subset || variant.rows.some((r) => !r.label)) return "";
    const labels = variant.rows.map((r) => r.label).join(", ");
    return `only the ${labels} profile${variant.rows.length === 1 ? "" : "s"}`;
  }
  const perRow: { label: string; changes: string }[] = [];
  for (const row of variant.rows) {
    const base = standard.rows.find((r) => r.label.toLowerCase() === row.label.toLowerCase());
    if (!base) return "";
    const baseKw = new Set(base.keywords.map((k) => k.toLowerCase()));
    const rowKw = new Set(row.keywords.map((k) => k.toLowerCase()));
    const changes = [
      ...row.cells.map((cell, i) =>
        cell !== base.cells[i] ? `${cellHeaders[i]} ${cell} (vs ${base.cells[i]})` : "",
      ),
      ...row.keywords.filter((k) => !baseKw.has(k.toLowerCase())).map((k) => `+${k}`),
      ...base.keywords.filter((k) => !rowKw.has(k.toLowerCase())).map((k) => `-${k}`),
    ].filter(Boolean);
    perRow.push({ label: row.label, changes: changes.join(", ") });
  }
  // The same change on every profile ("+Precision") reads better said once.
  if (perRow.every((r) => r.changes === perRow[0].changes)) return perRow[0].changes;
  return perRow
    .filter((r) => r.changes)
    .map((r) => (r.label ? `${r.label}: ${r.changes}` : r.changes))
    .join("; ");
}
