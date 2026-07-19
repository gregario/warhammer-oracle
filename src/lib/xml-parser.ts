import { XMLParser } from "fast-xml-parser";
import type {
  Unit,
  UnitProfile,
  RangedWeapon,
  MeleeWeapon,
  Ability,
  UnitSize,
  Detachment,
  Enhancement,
  KillTeamOperative,
  KillTeamOperativeProfile,
  KillTeamWeapon,
} from "../types.js";

// === Profile type IDs from BattleScribe 40k 10th Edition ===
const UNIT_PROFILE_TYPE_ID = "c547-1836-d8a-ff4f";
const RANGED_WEAPON_TYPE_ID = "f77d-b953-8fa4-b762";
const MELEE_WEAPON_TYPE_ID = "8a40-4aaa-c780-9046";
const ABILITY_TYPE_ID = "9cc3-6d83-4dd3-9b64";
const POINTS_COST_TYPE_ID = "51b2-306e-1021-d207";

// === Profile type IDs from BattleScribe Kill Team (2024) ===
const KT_OPERATIVE_PROFILE_TYPE_ID = "5156-3fb9-39ce-7bdb";
const KT_WEAPON_TYPE_ID = "f25f-4b13-b724-d5a8";
const KT_ABILITY_TYPE_ID = "f887-5881-0e6d-755c";
const KT_UNIQUE_ACTION_TYPE_ID = "0ef1-ffa2-bd78-c722";
const KT_POINTS_COST_TYPE_ID = "c61a-51a3-370d-bf55";

// Tags that may appear as single element or array
const ARRAY_TAGS = [
  "selectionEntry",
  "selectionEntryGroup",
  "profile",
  "characteristic",
  "cost",
  "categoryLink",
  "rule",
  "entryLink",
  "catalogueLink",
  "constraint",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (_name: string, jpath: unknown) => {
    const tag = String(jpath).split(".").pop() ?? "";
    return ARRAY_TAGS.includes(tag);
  },
});

// === Helpers ===

function ensureArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

// === JSON → XML-shape normalization (for BSData/wh40k-11e, which ships JSON) ===

// Keys that appear as XML attributes in the 10e schema (accessed elsewhere in this
// file via `["@_..."]`) but are plain properties in BSData's 11e JSON export.
const ATTR_ALIAS_KEYS = new Set([
  "id",
  "name",
  "hidden",
  "type",
  "typeId",
  "targetId",
  "value",
  "library",
  "field",
  "scope",
]);

// BSData's 11e JSON represents repeatable elements as flat arrays (e.g.
// `"profiles": [ {...}, {...} ]`), whereas the 10e XML schema (and every
// extractor in this file) expects the XML wrapper shape
// `{ profiles: { profile: [...] } }`. This maps each flat container key to
// the singular child key the extractors read via `ensureArray(node.X?.y)`.
const PLURAL_CONTAINER_KEYS: Record<string, string> = {
  sharedSelectionEntries: "selectionEntry",
  sharedSelectionEntryGroups: "selectionEntryGroup",
  selectionEntries: "selectionEntry",
  selectionEntryGroups: "selectionEntryGroup",
  entryLinks: "entryLink",
  profiles: "profile",
  characteristics: "characteristic",
  categoryLinks: "categoryLink",
  costs: "cost",
  rules: "rule",
  sharedRules: "rule",
  infoLinks: "infoLink",
  catalogueLinks: "catalogueLink",
  constraints: "constraint",
};

/**
 * Recursively reshape a parsed BSData 11e JSON node into the same shape
 * fast-xml-parser produces for 10e XML, so every extractor in this file
 * (parseEntryNode, parseDetachments, parseEnhancements, collectAllProfiles,
 * etc.) can run against it unchanged: known attribute-like keys get an
 * `"@_"`-prefixed string alias, `"$text"` becomes `"#text"`, and known
 * flat-array containers get re-wrapped into the XML's nested plural/singular
 * shape.
 */
export function normalizeJsonNode(node: any): any {
  if (Array.isArray(node)) {
    return node.map((item) => normalizeJsonNode(item));
  }
  if (node !== null && typeof node === "object") {
    const out: any = {};
    for (const [key, val] of Object.entries(node)) {
      if (key === "$text") {
        out["#text"] = val;
        continue;
      }

      const singular = PLURAL_CONTAINER_KEYS[key];
      if (singular && (Array.isArray(val) || (val !== null && typeof val === "object"))) {
        const items = ensureArray(val as any).map((item) => normalizeJsonNode(item));
        out[key] = { [singular]: items };
        continue;
      }

      out[key] = normalizeJsonNode(val);
      if (ATTR_ALIAS_KEYS.has(key) && (val === null || typeof val !== "object")) {
        out["@_" + key] = typeof val === "boolean" ? String(val) : val;
      }
    }
    return out;
  }
  return node;
}

function getCharacteristic(
  characteristics: any[],
  name: string
): string {
  // Case-insensitive: BSData/wh40k-11e renamed some characteristics'
  // capitalization (e.g. 10e's "SV" is "Sv" in 11e's schema) even though the
  // typeIds are unchanged.
  const char = characteristics.find(
    (c: any) => typeof c["@_name"] === "string" && c["@_name"].toLowerCase() === name.toLowerCase()
  );
  if (!char) return "";
  const text = char["#text"];
  return text != null ? String(text) : "";
}

function parseWeaponKeywords(raw: string): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((k: string) => k.trim())
    .filter((k: string) => k.length > 0);
}

function extractFaction(catalogueName: string): string {
  // "Imperium - Space Marines" → "Space Marines"
  // "Xenos - Leagues of Votann" → "Leagues of Votann"
  const dashIndex = catalogueName.indexOf(" - ");
  if (dashIndex >= 0) {
    return catalogueName.substring(dashIndex + 3);
  }
  return catalogueName;
}

// === Profile extractors ===

function extractUnitProfiles(profiles: any[]): UnitProfile[] {
  return profiles
    .filter((p: any) => p["@_typeId"] === UNIT_PROFILE_TYPE_ID)
    .map((p: any) => {
      const chars = ensureArray(p.characteristics?.characteristic);
      return {
        name: p["@_name"],
        movement: getCharacteristic(chars, "M"),
        toughness: getCharacteristic(chars, "T"),
        save: getCharacteristic(chars, "SV"),
        wounds: getCharacteristic(chars, "W"),
        leadership: getCharacteristic(chars, "LD"),
        objectiveControl: getCharacteristic(chars, "OC"),
      };
    });
}

function extractRangedWeapons(profiles: any[]): RangedWeapon[] {
  return profiles
    .filter((p: any) => p["@_typeId"] === RANGED_WEAPON_TYPE_ID)
    .map((p: any) => {
      const chars = ensureArray(p.characteristics?.characteristic);
      return {
        name: p["@_name"],
        range: getCharacteristic(chars, "Range"),
        attacks: getCharacteristic(chars, "A"),
        ballisticSkill: getCharacteristic(chars, "BS"),
        strength: getCharacteristic(chars, "S"),
        armourPenetration: getCharacteristic(chars, "AP"),
        damage: getCharacteristic(chars, "D"),
        keywords: parseWeaponKeywords(getCharacteristic(chars, "Keywords")),
      };
    });
}

function extractMeleeWeapons(profiles: any[]): MeleeWeapon[] {
  return profiles
    .filter((p: any) => p["@_typeId"] === MELEE_WEAPON_TYPE_ID)
    .map((p: any) => {
      const chars = ensureArray(p.characteristics?.characteristic);
      return {
        name: p["@_name"],
        range: getCharacteristic(chars, "Range"),
        attacks: getCharacteristic(chars, "A"),
        weaponSkill: getCharacteristic(chars, "WS"),
        strength: getCharacteristic(chars, "S"),
        armourPenetration: getCharacteristic(chars, "AP"),
        damage: getCharacteristic(chars, "D"),
        keywords: parseWeaponKeywords(getCharacteristic(chars, "Keywords")),
      };
    });
}

function extractAbilities(profiles: any[]): Ability[] {
  return profiles
    .filter((p: any) => p["@_typeId"] === ABILITY_TYPE_ID)
    .map((p: any) => {
      const chars = ensureArray(p.characteristics?.characteristic);
      return {
        name: p["@_name"],
        description: getCharacteristic(chars, "Description"),
      };
    });
}

/**
 * Many named abilities (Deep Strike, Infiltrators, Scouts, Lone Operative,
 * Feel No Pain, Leader, faction ones like Oath of Moment or Dark Pacts...)
 * aren't given to a unit as an inline <profile> — they're referenced via an
 * <infoLink type="rule"> pointing at the shared rule text (in the game
 * system file or a catalogue's own rules/sharedRules), the same way a
 * Detachment's ability can be inline or an infoLink (see
 * extractDetachmentAbility). Without resolving these, any unit whose
 * abilities are ALL infoLink-based has an empty abilities list, and one
 * whose abilities are a mix (e.g. Chosen's inline inline abilities plus its
 * "Dark Pacts" infoLink) is silently missing the linked ones.
 *
 * Returns synthetic profile-shaped objects (matching what extractAbilities
 * expects) so callers can just concatenate them into the profiles array
 * rather than threading a second parallel "abilities" collection everywhere.
 *
 * Only resolved on entries whose own type is "unit" or "model" — i.e.
 * genuine datasheet/model slots (Chosen itself; a champion sub-model like
 * "Chosen Champion"). Weapon items are always type "upgrade" in BSData, and
 * carry this exact same infoLink shape for their own weapon-ability
 * keywords (e.g. a Combi-weapon's infoLinks to "Anti", "Devastating
 * Wounds", "Rapid Fire" — already surfaced via that profile's own Keywords
 * characteristic/parseWeaponKeywords). Checking the entry's own profile
 * type isn't enough to exclude these: some weapon items (e.g. a "Plasma
 * pistol" wrapper choosing between standard/supercharge firing modes) carry
 * their shared keywords like Pistol/Hazardous on the type="upgrade" wrapper
 * while the actual Ranged/Melee weapon profiles live one level down on its
 * child entries — without the type check those wrapper-level infoLinks were
 * misfiled as unit-level abilities instead.
 */
function ruleLinksToAbilityProfiles(entry: any, ruleIndex: Map<string, any>): any[] {
  const type = entry["@_type"];
  if (type !== "unit" && type !== "model") return [];

  const links = ensureArray(entry.infoLinks?.infoLink).filter(
    (l: any) => l["@_type"] === "rule" && l["@_hidden"] !== "true",
  );
  const profiles: any[] = [];
  for (const link of links) {
    const targetId = link["@_targetId"];
    if (!targetId) continue;
    const rule = ruleIndex.get(targetId);
    if (!rule || !rule.description) continue;
    profiles.push({
      "@_typeId": ABILITY_TYPE_ID,
      "@_name": rule["@_name"] ?? link["@_name"] ?? "",
      characteristics: {
        characteristic: [{ "@_name": "Description", "#text": rule.description }],
      },
    });
  }
  return profiles;
}

/**
 * Collect all profiles from an entry's own profiles plus every descendant
 * selectionEntry/selectionEntryGroup, at any nesting depth — e.g. weapon
 * profiles for units like Obliterators live 3 levels down (unit -> model
 * sub-entry -> "Wargear" group -> weapon entry -> profiles), which a
 * shallow 2-level-only traversal misses entirely. Does not follow
 * entryLinks (references to shared content elsewhere by id) — that's a
 * separate concern handled by collectAllProfilesWithGlobalLinks in
 * fetch-data.ts, which calls this for the inline tree first.
 *
 * `ruleIndex`, if given, also resolves each level's rule-type infoLinks
 * (see ruleLinksToAbilityProfiles) into the returned profile list.
 */
function collectAllProfiles(entry: any, ruleIndex?: Map<string, any>): any[] {
  const direct = ensureArray(entry.profiles?.profile);
  const ruleAbilities = ruleIndex ? ruleLinksToAbilityProfiles(entry, ruleIndex) : [];

  const subEntries = ensureArray(entry.selectionEntries?.selectionEntry);
  const subEntryProfiles = subEntries.flatMap((sub: any) => collectAllProfiles(sub, ruleIndex));

  const groups = ensureArray(entry.selectionEntryGroups?.selectionEntryGroup);
  const groupProfiles = groups.flatMap((group: any) => collectAllProfiles(group, ruleIndex));

  return [...direct, ...ruleAbilities, ...subEntryProfiles, ...groupProfiles];
}

function extractPoints(entry: any): number | null {
  const costs = ensureArray(entry.costs?.cost);
  const ptsCost = costs.find(
    (c: any) => c["@_typeId"] === POINTS_COST_TYPE_ID
  );
  if (!ptsCost) return null;
  return Number(ptsCost["@_value"]);
}

function extractKeywords(entry: any): string[] {
  const links = ensureArray(entry.categoryLinks?.categoryLink);
  return links
    .filter((cl: any) => cl["@_hidden"] !== "true")
    .map((cl: any) => cl["@_name"] as string)
    .filter((name: string) => !name.startsWith("Faction:"));
}

/**
 * A child selectionEntry/selectionEntryGroup's own model-count range, read
 * from its "selections" constraints scoped to "parent" — the BattleScribe
 * convention for "how many of this specific slot are included when the
 * containing unit is selected once" (as opposed to scope "force", which
 * bounds how many copies of the whole unit a roster can include, and is
 * unrelated to model count — see feedback_bsdata_constraint_semantics).
 * Returns null if the child has no such constraint at all.
 */
function extractCountConstraint(node: any): UnitSize | null {
  const constraints = ensureArray(node.constraints?.constraint);
  let min: number | null = null;
  let max: number | null = null;
  for (const c of constraints) {
    if (c["@_field"] !== "selections" || c["@_scope"] !== "parent") continue;
    const value = Number(c["@_value"]);
    if (c["@_type"] === "min") min = value;
    else if (c["@_type"] === "max") max = value;
  }
  if (min === null && max === null) return null;
  return { min: min ?? max!, max: max ?? min! };
}

/**
 * Whether a child selectionEntry/selectionEntryGroup has any content of its
 * own (inline sub-entries, sub-groups, or profiles) rather than being a
 * pure entryLinks-only reference to shared content elsewhere — e.g. a
 * character's "Crusade" group, which links out to the universal "Mighty
 * Champions" narrative-play rules and has no inline content describing an
 * actual model. Distinguishes a real (if unconstrained) model slot like
 * "Terminator Champion" — which nests real inline weapon-option entries —
 * from an unrelated rules/wargear-customization wrapper that happens to
 * also lack an explicit count constraint.
 */
function hasOwnInlineContent(node: any): boolean {
  return (
    ensureArray(node.selectionEntries?.selectionEntry).length > 0 ||
    ensureArray(node.selectionEntryGroups?.selectionEntryGroup).length > 0 ||
    ensureArray(node.profiles?.profile).length > 0
  );
}

/**
 * Derive a unit's model-count range by summing the count contribution of
 * each of its direct child selectionEntries/selectionEntryGroups — each
 * represents one named model slot or troop-type block (e.g. a mandatory
 * "Aspiring Champion" contributing exactly 1, plus a "4-9 Legionaries"
 * group contributing 4-9, for a 5-10 total). A child with no explicit count
 * constraint contributes exactly 1 if it has its own inline content (e.g. a
 * champion's weapon-option wrapper group, representing a single mandatory
 * model slot expressed via nested weapon choices rather than an explicit
 * count) — but contributes nothing if it's a pure reference to shared
 * content elsewhere (e.g. a "Crusade" rules group), since that isn't a
 * model slot at all. Hidden children (background/bookkeeping constructs)
 * are skipped entirely. A unit with no children at all (a vehicle or a
 * single-model character with no loadout sub-entries) is exactly 1 model.
 *
 * A top-level entry whose own type is "model" (rather than "unit") IS
 * itself one model — e.g. a named character or vehicle datasheet with no
 * separate wrapping "unit" container, whose children are typically wargear
 * or psychic-power choice groups rather than additional model slots — so it
 * starts from a baseline of 1 before summing children. A "unit"-typed entry
 * is a pure container whose entire count comes from its children (e.g.
 * Legionaries: 0 baseline + "Aspiring Champion" (1) + "4-9 Legionaries"
 * group = 5-10 total).
 *
 * Known limitation: a handful of units (e.g. Space Wolves' "Wolf Guard
 * Headtakers") express their entire composition as entryLinks to shared
 * library content rather than inline entries — hasOwnInlineContent can't
 * see through that reference to know the link target is real troop data
 * rather than an unrelated reference like a "Crusade" rules group, so such
 * units compute to a bare 0 before the floor below applies. Properly
 * resolving this would mean threading fetch-data.ts's global shared-entry
 * index into this function; not done given how rare the pattern is.
 * Falling back to exactly 1 is a deliberately conservative floor — never
 * confidently assert a unit has 0 models, since every real unit has at
 * least 1, even where the true composition (which may be larger) isn't
 * recoverable here.
 */
function extractUnitSize(entry: any): UnitSize {
  const children = [
    ...ensureArray(entry.selectionEntries?.selectionEntry),
    ...ensureArray(entry.selectionEntryGroups?.selectionEntryGroup),
  ].filter((c: any) => c["@_hidden"] !== "true");

  if (children.length === 0) return { min: 1, max: 1 };

  const baseline = entry["@_type"] === "model" ? 1 : 0;
  let totalMin = baseline;
  let totalMax = baseline;
  for (const child of children) {
    const range = extractCountConstraint(child);
    if (range) {
      totalMin += range.min;
      totalMax += range.max;
    } else if (hasOwnInlineContent(child)) {
      totalMin += 1;
      totalMax += 1;
    }
  }
  if (totalMax === 0) return { min: 1, max: 1 };
  return { min: totalMin, max: totalMax };
}

// === Exported helpers for fetch-data.ts cross-catalogue resolution ===

export { parser as xmlParser, ensureArray };

/**
 * Parse a single raw XML entry node (from sharedSelectionEntries or selectionEntries)
 * into a Unit object. Used by fetch-data.ts for cross-catalogue entryLink resolution.
 */
export function parseEntryNode(
  entry: any,
  faction: string,
  allProfiles?: any[]
): Unit | null {
  const type = entry["@_type"];
  const hidden = entry["@_hidden"] === "true";
  if (hidden || (type !== "unit" && type !== "model")) return null;

  const profiles = allProfiles ?? collectAllProfiles(entry);

  return {
    id: entry["@_id"],
    name: entry["@_name"],
    faction,
    keywords: extractKeywords(entry),
    profiles: extractUnitProfiles(profiles),
    rangedWeapons: extractRangedWeapons(profiles),
    meleeWeapons: extractMeleeWeapons(profiles),
    abilities: extractAbilities(profiles),
    points: extractPoints(entry),
    unitSize: extractUnitSize(entry),
    gameSystem: "wh40k-10e" as const,
  };
}

export { extractFaction, collectAllProfiles, buildRuleIndex, extractUnitSize, ruleLinksToAbilityProfiles };

// === Public API ===

export type GameSystemResult = {
  id: string;
  name: string;
  rules: { id: string; name: string; description: string }[];
};

export function parseGameSystem(xml: string): GameSystemResult {
  const parsed = parser.parse(xml);
  const gs = parsed.gameSystem;

  // Rules may be in <rules> and/or <sharedRules>
  const directRules = ensureArray(gs.rules?.rule);
  const sharedRules = ensureArray(gs.sharedRules?.rule);
  const allRuleNodes = [...directRules, ...sharedRules];

  const rules = allRuleNodes.map((r: any) => ({
    id: r["@_id"],
    name: r["@_name"],
    description: r.description ?? "",
  }));

  return {
    id: gs["@_id"],
    name: gs["@_name"],
    rules,
  };
}

// === Kill Team profile extractors ===

function extractKTOperativeProfile(profiles: any[]): KillTeamOperativeProfile | null {
  const p = profiles.find((p: any) => p["@_typeId"] === KT_OPERATIVE_PROFILE_TYPE_ID);
  if (!p) return null;
  const chars = ensureArray(p.characteristics?.characteristic);
  return {
    name: p["@_name"],
    apl: getCharacteristic(chars, "APL"),
    movement: getCharacteristic(chars, "Move"),
    save: getCharacteristic(chars, "Save"),
    wounds: getCharacteristic(chars, "Wounds"),
  };
}

function extractKTWeapons(profiles: any[]): KillTeamWeapon[] {
  return profiles
    .filter((p: any) => p["@_typeId"] === KT_WEAPON_TYPE_ID)
    .map((p: any) => {
      const chars = ensureArray(p.characteristics?.characteristic);
      const rawName: string = p["@_name"] ?? "";
      let type: "ranged" | "melee" = "melee";
      let name = rawName;
      if (rawName.startsWith("\u2316")) {
        // ⌖ = ranged
        type = "ranged";
        name = rawName.replace(/^\u2316\s*/, "");
      } else if (rawName.startsWith("\u2694")) {
        // ⚔ = melee
        type = "melee";
        name = rawName.replace(/^\u2694\s*/, "");
      }
      return {
        name,
        attacks: getCharacteristic(chars, "ATK"),
        hit: getCharacteristic(chars, "HIT"),
        damage: getCharacteristic(chars, "DMG"),
        weaponRules: getCharacteristic(chars, "WR"),
        type,
      };
    });
}

function extractKTAbilities(profiles: any[]): Ability[] {
  return profiles
    .filter((p: any) => p["@_typeId"] === KT_ABILITY_TYPE_ID)
    .map((p: any) => {
      const chars = ensureArray(p.characteristics?.characteristic);
      return {
        name: p["@_name"],
        description: getCharacteristic(chars, "Ability"),
      };
    });
}

function extractKTUniqueActions(profiles: any[]): Ability[] {
  return profiles
    .filter((p: any) => p["@_typeId"] === KT_UNIQUE_ACTION_TYPE_ID)
    .map((p: any) => {
      const chars = ensureArray(p.characteristics?.characteristic);
      // Unique actions may have a "Description" or "Ability" characteristic
      const desc = getCharacteristic(chars, "Description") || getCharacteristic(chars, "Ability");
      return {
        name: p["@_name"],
        description: desc,
      };
    });
}

function extractKTFaction(catalogueName: string): string {
  // "2024 - Faction Name" → "Faction Name"
  const match = catalogueName.match(/^2024\s*-\s*(.+)$/);
  if (match) return match[1];
  return extractFaction(catalogueName);
}

export function parseKillTeamGameSystem(xml: string): GameSystemResult {
  return parseGameSystem(xml);
}

/** Build an index of shared selection entries by id for entryLink resolution */
function buildSharedEntryIndex(cat: any): Map<string, any> {
  const index = new Map<string, any>();
  const sharedEntries = ensureArray(cat.sharedSelectionEntries?.selectionEntry);
  for (const entry of sharedEntries) {
    if (entry["@_id"]) {
      index.set(entry["@_id"], entry);
    }
  }
  // Also index entries from sharedSelectionEntryGroups
  const sharedGroups = ensureArray(cat.sharedSelectionEntryGroups?.selectionEntryGroup);
  for (const group of sharedGroups) {
    if (group["@_id"]) {
      index.set(group["@_id"], group);
    }
    const groupEntries = ensureArray(group.selectionEntries?.selectionEntry);
    for (const entry of groupEntries) {
      if (entry["@_id"]) {
        index.set(entry["@_id"], entry);
      }
    }
  }
  return index;
}

/** Collect profiles from an entry, resolving entryLinks to shared entries */
function collectAllProfilesWithLinks(entry: any, sharedIndex: Map<string, any>): any[] {
  const profiles = collectAllProfiles(entry);

  // Resolve entryLinks on the entry itself
  const entryLinks = ensureArray(entry.entryLinks?.entryLink);
  for (const link of entryLinks) {
    const targetId = link["@_targetId"];
    if (targetId) {
      const target = sharedIndex.get(targetId);
      if (target) {
        profiles.push(...ensureArray(target.profiles?.profile));
      }
    }
  }

  // Resolve entryLinks inside selectionEntryGroups
  const groups = ensureArray(entry.selectionEntryGroups?.selectionEntryGroup);
  for (const group of groups) {
    const groupLinks = ensureArray(group.entryLinks?.entryLink);
    for (const link of groupLinks) {
      const targetId = link["@_targetId"];
      if (targetId) {
        const target = sharedIndex.get(targetId);
        if (target) {
          profiles.push(...ensureArray(target.profiles?.profile));
          // Also check sub-entries of the resolved target
          const targetSubEntries = ensureArray(target.selectionEntries?.selectionEntry);
          for (const sub of targetSubEntries) {
            profiles.push(...ensureArray(sub.profiles?.profile));
          }
        }
      }
    }
    // Also resolve entryLinks inside sub-selectionEntries of groups
    const groupEntries = ensureArray(group.selectionEntries?.selectionEntry);
    for (const ge of groupEntries) {
      const geLinks = ensureArray(ge.entryLinks?.entryLink);
      for (const link of geLinks) {
        const targetId = link["@_targetId"];
        if (targetId) {
          const target = sharedIndex.get(targetId);
          if (target) {
            profiles.push(...ensureArray(target.profiles?.profile));
          }
        }
      }
    }
  }

  return profiles;
}

export function parseKillTeamCatalogue(xml: string): KillTeamOperative[] {
  const parsed = parser.parse(xml);
  const cat = parsed.catalogue;
  const faction = extractKTFaction(cat["@_name"]);
  const sharedIndex = buildSharedEntryIndex(cat);

  const directEntries = ensureArray(cat.selectionEntries?.selectionEntry);
  const sharedEntries = ensureArray(
    cat.sharedSelectionEntries?.selectionEntry
  );
  const entries = [...directEntries, ...sharedEntries];

  const operatives: KillTeamOperative[] = [];

  for (const entry of entries) {
    const type = entry["@_type"];
    const hidden = entry["@_hidden"] === "true";
    if (hidden || (type !== "unit" && type !== "model")) continue;

    const allProfiles = collectAllProfilesWithLinks(entry, sharedIndex);
    const profile = extractKTOperativeProfile(allProfiles);
    if (!profile) continue;

    operatives.push({
      id: entry["@_id"],
      name: entry["@_name"],
      faction,
      keywords: extractKeywords(entry),
      profile,
      weapons: extractKTWeapons(allProfiles),
      abilities: extractKTAbilities(allProfiles),
      uniqueActions: extractKTUniqueActions(allProfiles),
      gameSystem: "wh40k-killteam",
    });
  }

  return operatives;
}

export function parseCatalogue(xml: string): Unit[] {
  const parsed = parser.parse(xml);
  const cat = parsed.catalogue;
  const faction = extractFaction(cat["@_name"]);

  // Units may be in <selectionEntries> and/or <sharedSelectionEntries>
  const directEntries = ensureArray(cat.selectionEntries?.selectionEntry);
  const sharedEntries = ensureArray(
    cat.sharedSelectionEntries?.selectionEntry
  );
  const entries = [...directEntries, ...sharedEntries];

  return entries
    .filter((entry: any) => {
      // Only unit or model type entries, not hidden
      const type = entry["@_type"];
      const hidden = entry["@_hidden"] === "true";
      return !hidden && (type === "unit" || type === "model");
    })
    .map((entry: any) => {
      const allProfiles = collectAllProfiles(entry);

      return {
        id: entry["@_id"],
        name: entry["@_name"],
        faction,
        keywords: extractKeywords(entry),
        profiles: extractUnitProfiles(allProfiles),
        rangedWeapons: extractRangedWeapons(allProfiles),
        meleeWeapons: extractMeleeWeapons(allProfiles),
        abilities: extractAbilities(allProfiles),
        points: extractPoints(entry),
        unitSize: extractUnitSize(entry),
        gameSystem: "wh40k-10e" as const,
      };
    });
}

// === Detachment & Enhancement extraction ===

/**
 * Extract the detachment ability from a selectionEntry.
 * Rules may be inline (<rule> elements) or referenced via <infoLink type="rule">.
 * When using infoLinks, we resolve them against a shared rule index.
 */
function extractDetachmentAbility(
  entry: any,
  ruleIndex?: Map<string, any>
): { name: string; description: string } | null {
  // Collect inline rules
  const inlineRules = ensureArray(entry.rules?.rule);

  // Collect rules resolved from infoLinks
  const infoLinks = ensureArray(entry.infoLinks?.infoLink);
  const linkedRules: any[] = [];
  if (ruleIndex) {
    for (const link of infoLinks) {
      if (link["@_type"] === "rule" && link["@_hidden"] !== "true") {
        const targetId = link["@_targetId"];
        if (targetId) {
          const target = ruleIndex.get(targetId);
          if (target) {
            linkedRules.push(target);
          }
        }
      }
    }
  }

  const allRules = [...inlineRules, ...linkedRules];
  if (allRules.length === 0) return null;

  if (allRules.length === 1) {
    return {
      name: allRules[0]["@_name"] ?? "",
      description: allRules[0].description ?? "",
    };
  }
  // Multiple rules: combine with the first rule's name as the primary
  const descriptions = allRules.map((r: any) => {
    const name = r["@_name"] ?? "";
    const desc = r.description ?? "";
    return `**${name}**\n${desc}`;
  });
  return {
    name: allRules[0]["@_name"] ?? "",
    description: descriptions.join("\n\n"),
  };
}

/**
 * Build an index of shared rules from a catalogue node.
 * Rules may be in <rules>, <sharedRules>, or both.
 */
function buildRuleIndex(catNode: any): Map<string, any> {
  const index = new Map<string, any>();
  const directRules = ensureArray(catNode.rules?.rule);
  const sharedRules = ensureArray(catNode.sharedRules?.rule);
  for (const rule of [...directRules, ...sharedRules]) {
    if (rule["@_id"]) {
      index.set(rule["@_id"], rule);
    }
  }
  return index;
}

/**
 * Find the "Detachment" selectionEntryGroup within a catalogue node
 * (may be in sharedSelectionEntries or sharedSelectionEntryGroups).
 * Returns the group containing the actual detachment choices, or null.
 */
function findDetachmentGroup(catNode: any, globalIndex?: Map<string, any>): any | null {
  // Pattern 1: A sharedSelectionEntry named "Detachment" with an entryLink to a group
  const sharedEntries = ensureArray(catNode.sharedSelectionEntries?.selectionEntry);
  for (const entry of sharedEntries) {
    if (entry["@_name"] === "Detachment" && entry["@_type"] === "upgrade") {
      // Check for inner selectionEntryGroups directly
      const innerGroups = ensureArray(entry.selectionEntryGroups?.selectionEntryGroup);
      for (const g of innerGroups) {
        if (g["@_name"] === "Detachment" || g["@_name"] === "Detachments") {
          return g;
        }
      }
      // Check entryLinks that point to a "Detachment" group
      const entryLinks = ensureArray(entry.entryLinks?.entryLink);
      for (const link of entryLinks) {
        const linkName = link["@_name"] ?? "";
        if (linkName === "Detachment" || linkName === "Detachments") {
          const targetId = link["@_targetId"];
          if (targetId && globalIndex) {
            const target = globalIndex.get(targetId);
            if (target) return target;
          }
        }
      }
    }
  }

  // Pattern 2: Direct selectionEntries with name "Detachment"
  const directEntries = ensureArray(catNode.selectionEntries?.selectionEntry);
  for (const entry of directEntries) {
    if (entry["@_name"] === "Detachment" && entry["@_type"] === "upgrade") {
      const innerGroups = ensureArray(entry.selectionEntryGroups?.selectionEntryGroup);
      for (const g of innerGroups) {
        if (g["@_name"] === "Detachment" || g["@_name"] === "Detachments") {
          return g;
        }
      }
      const entryLinks = ensureArray(entry.entryLinks?.entryLink);
      for (const link of entryLinks) {
        const linkName = link["@_name"] ?? "";
        if (linkName === "Detachment" || linkName === "Detachments") {
          const targetId = link["@_targetId"];
          if (targetId && globalIndex) {
            const target = globalIndex.get(targetId);
            if (target) return target;
          }
        }
      }
    }
  }

  // Pattern 3: The group itself lives in sharedSelectionEntryGroups
  const sharedGroups = ensureArray(catNode.sharedSelectionEntryGroups?.selectionEntryGroup);
  for (const group of sharedGroups) {
    if (group["@_name"] === "Detachment" || group["@_name"] === "Detachments") {
      return group;
    }
  }

  return null;
}

/**
 * Parse detachments from a catalogue node.
 * Detachments live inside a "Detachment" selectionEntryGroup as child selectionEntries,
 * each with <rule> elements (inline or via infoLink) describing the detachment ability.
 *
 * @param catNode - The catalogue XML node
 * @param faction - Faction name
 * @param globalIndex - Global shared entry index for resolving entryLinks
 * @param globalRuleIndex - Optional pre-built global rule index for resolving infoLinks across catalogues
 */
export function parseDetachments(
  catNode: any,
  faction: string,
  globalIndex?: Map<string, any>,
  globalRuleIndex?: Map<string, any>
): Detachment[] {
  const group = findDetachmentGroup(catNode, globalIndex);
  if (!group) return [];

  // Build a rule index: start from this catalogue, then merge global if provided
  const ruleIndex = buildRuleIndex(catNode);
  if (globalRuleIndex) {
    for (const [id, rule] of globalRuleIndex) {
      if (!ruleIndex.has(id)) {
        ruleIndex.set(id, rule);
      }
    }
  }

  const entries = ensureArray(group.selectionEntries?.selectionEntry);
  const detachments: Detachment[] = [];

  for (const entry of entries) {
    if (entry["@_hidden"] === "true") continue;

    const ability = extractDetachmentAbility(entry, ruleIndex);
    if (!ability) continue;

    detachments.push({
      id: entry["@_id"],
      name: entry["@_name"],
      faction,
      ability,
      gameSystem: "wh40k-10e" as const,
    });
  }

  return detachments;
}

/**
 * Extract enhancement description from Abilities profile.
 */
function extractEnhancementDescription(entry: any): string {
  const profiles = ensureArray(entry.profiles?.profile);
  const abilityProfile = profiles.find(
    (p: any) => p["@_typeId"] === ABILITY_TYPE_ID
  );
  if (!abilityProfile) return "";
  const chars = ensureArray(abilityProfile.characteristics?.characteristic);
  return getCharacteristic(chars, "Description");
}

/**
 * Extract enhancement points cost.
 */
function extractEnhancementPoints(entry: any): number | null {
  const costs = ensureArray(entry.costs?.cost);
  const ptsCost = costs.find(
    (c: any) => c["@_typeId"] === POINTS_COST_TYPE_ID
  );
  if (!ptsCost) return null;
  const val = Number(ptsCost["@_value"]);
  return isNaN(val) ? null : val;
}

/**
 * Find all enhancement groups in the catalogue node.
 * Enhancement groups are sharedSelectionEntryGroups whose name contains "Enhancements".
 *
 * Two patterns exist:
 * 1. Nested: A parent "Enhancements" group with child selectionEntryGroups
 *    named "[Detachment] Enhancements", each containing enhancement entries.
 * 2. Flat: A group named "[Detachment] Enhancements" (or "Enhancements")
 *    with enhancement entries directly inside, using <comment> for detachment association.
 * 3. Separate: Additional standalone "[Detachment] Enhancements" groups at
 *    the sharedSelectionEntryGroups level.
 */
export function parseEnhancements(
  catNode: any,
  faction: string,
  globalIndex?: Map<string, any>
): Enhancement[] {
  const enhancements: Enhancement[] = [];
  const seenIds = new Set<string>();

  const sharedGroups = ensureArray(catNode.sharedSelectionEntryGroups?.selectionEntryGroup);

  for (const group of sharedGroups) {
    const groupName: string = group["@_name"] ?? "";
    if (!groupName.toLowerCase().includes("enhancement")) continue;

    // Check if this group has child selectionEntryGroups (nested pattern)
    const childGroups = ensureArray(group.selectionEntryGroups?.selectionEntryGroup);

    if (childGroups.length > 0) {
      // Nested pattern: child groups are named "[Detachment] Enhancements"
      for (const childGroup of childGroups) {
        const childName: string = childGroup["@_name"] ?? "";
        const detachmentName = childName.replace(/\s*Enhancements\s*$/, "").trim();
        const entries = ensureArray(childGroup.selectionEntries?.selectionEntry);
        for (const entry of entries) {
          if (entry["@_hidden"] === "true") continue;
          const id = entry["@_id"];
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          const description = extractEnhancementDescription(entry);
          if (!description) continue;

          enhancements.push({
            id,
            name: entry["@_name"],
            faction,
            detachment: detachmentName,
            description,
            points: extractEnhancementPoints(entry),
            gameSystem: "wh40k-10e" as const,
          });
        }
      }
    }

    // Also check for direct entries in this group (flat pattern, or standalone detachment group)
    const directEntries = ensureArray(group.selectionEntries?.selectionEntry);
    if (directEntries.length > 0) {
      // Determine detachment from group name or entry's <comment>
      const isGenericName = groupName === "Enhancements";
      const groupDetachment = isGenericName
        ? ""
        : groupName.replace(/\s*Enhancements\s*$/, "").trim();

      for (const entry of directEntries) {
        if (entry["@_hidden"] === "true") continue;
        const id = entry["@_id"];
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const description = extractEnhancementDescription(entry);
        if (!description) continue;

        // Detachment association: use <comment> if available, else group name
        const comment: string = entry.comment ?? "";
        const detachment = comment || groupDetachment || "Unknown";

        enhancements.push({
          id,
          name: entry["@_name"],
          faction,
          detachment,
          description,
          points: extractEnhancementPoints(entry),
          gameSystem: "wh40k-10e" as const,
        });
      }
    }
  }

  return enhancements;
}
