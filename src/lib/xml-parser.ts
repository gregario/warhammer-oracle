import { XMLParser } from "fast-xml-parser";
import type {
  Unit,
  UnitProfile,
  RangedWeapon,
  MeleeWeapon,
  Ability,
  UnitSize,
  CompositionEntry,
  ModelWargear,
  Detachment,
  Disposition,
  Enhancement,
  CrusadeHonour,
  CrusadeHonourCategory,
  CrusadeHonourScope,
  CrusadeRelicTier,
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
// 11th Edition only (absent from BSData/wh40k-10e entirely) — a detachment's
// "Detachment Points" cost, and the categoryLink naming its Force Disposition.
const DETACHMENT_POINTS_TYPE_ID = "82ae-1066-5107-6ae0";
const KNOWN_DISPOSITIONS: readonly Disposition[] = [
  "Take and Hold",
  "Purge the Foe",
  "Reconnaissance",
  "Priority Assets",
  "Disruption",
];

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
  "modifier",
  "modifierGroup",
  "condition",
  "conditionGroup",
  "repeat",
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
  "childId",
  "defaultSelectionEntryId",
  "repeats",
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
  sharedProfiles: "profile",
  characteristics: "characteristic",
  categoryLinks: "categoryLink",
  costs: "cost",
  rules: "rule",
  sharedRules: "rule",
  infoLinks: "infoLink",
  catalogueLinks: "catalogueLink",
  constraints: "constraint",
  modifiers: "modifier",
  modifierGroups: "modifierGroup",
  conditions: "condition",
  conditionGroups: "conditionGroup",
  repeats: "repeat",
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

/**
 * Deduped on the full stat line: a squad's loadout-variant model entries
 * ("Intercessor", "Intercessor w/ Grenade Launcher") each carry their own
 * copy of the same Unit profile, which surfaced as repeated identical rows.
 */
function extractUnitProfiles(profiles: any[]): UnitProfile[] {
  const seen = new Set<string>();
  return profiles
    .filter((p: any) => p["@_typeId"] === UNIT_PROFILE_TYPE_ID)
    .map((p: any): UnitProfile => {
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
    })
    .filter((profile) => {
      const key = JSON.stringify(profile);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
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

/**
 * Deduped by name+description: a named character with multiple wargear-loadout
 * model variants (e.g. Hive Tyrant's winged/wingless options) has each variant
 * as its own nested model sub-entry, and a shared ability common to every
 * variant (e.g. "Leader") is inlined identically on each one — walking every
 * variant's own profiles is what correctly picks up variant-specific weapons,
 * but it also means that shared ability gets collected once per variant.
 * Confirmed via BSData/wh40k-10e: Hive Tyrant's "Leader" was appearing twice.
 */
function extractAbilities(profiles: any[]): Ability[] {
  const abilities = profiles
    .filter((p: any) => p["@_typeId"] === ABILITY_TYPE_ID)
    .map((p: any) => {
      const chars = ensureArray(p.characteristics?.characteristic);
      return {
        name: p["@_name"],
        description: getCharacteristic(chars, "Description"),
      };
    });

  const seen = new Set<string>();
  const deduped: Ability[] = [];
  for (const ability of abilities) {
    const key = `${ability.name}::${ability.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ability);
  }
  return deduped;
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
 * A second, parallel indirection exists alongside it: <infoLink type="profile">,
 * pointing at a *profile* (in a catalogue's own top-level profiles/sharedProfiles,
 * or the game system's) rather than a <rule>. Confirmed via BSData/wh40k-10e:
 * Adeptus Custodes' Custodian Guard references its wargear-linked "Praesidium
 * Shield" and "Vexilla" abilities this way, and Tyranids' Hive Tyrant
 * references "Will of the Hive Mind" the same way — both were silently
 * dropped entirely before this was handled, since only `type="rule"` was
 * ever resolved. Only kept when the target's own typeId is Abilities-typed
 * (ABILITY_TYPE_ID) — some `type="profile"` infoLinks point at a plain stat
 * profile instead (e.g. a battle-damage-tier "Damaged: X Wounds Remaining"
 * profile), which isn't an ability and shouldn't be surfaced as one.
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
 *
 * This also rules out extending profile-type resolution to type="upgrade"
 * entries in general (tried and reverted): a Crucible/made-to-order
 * character (e.g. Space Marines' "Champion of the Chapter [Crucible]")
 * reaches a shared "Abilities" entryLinkGroup — a pick-one-of-many menu of
 * every chapter's signature wargear ability (Ravenwing Bike, Thunderwolf
 * Mount, Death Company gear, ...) — the same way Adeptus Custodes' Vexilla
 * standard reaches its own single granted ability: both are `type="upgrade"`
 * entries with their own `type="profile"` infoLink. Allowing type="upgrade"
 * broadly resolved the menu's every option at once (one unit's ability count
 * went from ~6 to 42, mixing in other chapters' abilities wholesale) — the
 * same class of bug UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN exists to catch,
 * just under an entryLink named plain "Abilities" that doesn't match that
 * denylist. Vexilla itself stays unresolved as a result (a narrower, known
 * gap) rather than risk that regression.
 */
function ruleLinksToAbilityProfiles(
  entry: any,
  ruleIndex: Map<string, any>,
  profileIndex?: Map<string, any>,
  env: VisibilityEnv = {},
): any[] {
  const type = entry["@_type"];
  if (type !== "unit" && type !== "model") return [];

  const links = ensureArray(entry.infoLinks?.infoLink).filter((l: any) => !isHiddenIn(l, env));
  const profiles: any[] = [];
  for (const link of links) {
    const targetId = link["@_targetId"];
    if (!targetId) continue;
    const linkType = link["@_type"];

    if (linkType === "rule") {
      const rule = ruleIndex.get(targetId);
      if (!rule || !rule.description) continue;
      if (isHiddenIn(rule, env, true)) continue;
      profiles.push({
        "@_typeId": ABILITY_TYPE_ID,
        "@_name": rule["@_name"] ?? link["@_name"] ?? "",
        characteristics: {
          characteristic: [{ "@_name": "Description", "#text": rule.description }],
        },
      });
    } else if (linkType === "profile" && profileIndex) {
      const target = profileIndex.get(targetId);
      if (!target || target["@_typeId"] !== ABILITY_TYPE_ID) continue;
      if (isHiddenIn(target, env, true)) continue;
      const chars = ensureArray(target.characteristics?.characteristic);
      const description = getCharacteristic(chars, "Description");
      if (!description) continue;
      profiles.push({
        "@_typeId": ABILITY_TYPE_ID,
        "@_name": target["@_name"] ?? link["@_name"] ?? "",
        characteristics: {
          characteristic: [{ "@_name": "Description", "#text": description }],
        },
      });
    }
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
 * (see ruleLinksToAbilityProfiles) into the returned profile list. `profileIndex`,
 * if given, additionally resolves profile-type infoLinks the same way.
 */
function collectAllProfiles(entry: any, ruleIndex?: Map<string, any>, profileIndex?: Map<string, any>): any[] {
  const direct = ensureArray(entry.profiles?.profile);
  const ruleAbilities = ruleIndex ? ruleLinksToAbilityProfiles(entry, ruleIndex, profileIndex) : [];

  const subEntries = ensureArray(entry.selectionEntries?.selectionEntry);
  const subEntryProfiles = subEntries.flatMap((sub: any) => collectAllProfiles(sub, ruleIndex, profileIndex));

  const groups = ensureArray(entry.selectionEntryGroups?.selectionEntryGroup);
  const groupProfiles = groups.flatMap((group: any) => collectAllProfiles(group, ruleIndex, profileIndex));

  return [...direct, ...ruleAbilities, ...subEntryProfiles, ...groupProfiles];
}

/**
 * A datasheet's Unit stat line (M/T/Sv/W/Ld/OC) is normally an inline
 * <profile> on the entry or one of its model sub-entries. BSData/wh40k-11e
 * restructured a large minority of datasheets (~248: Kabalite Warriors,
 * Termagants, Leman Russ Battle Tank, ... — heaviest in Drukhari, Genestealer
 * Cults, Astra Militarum, Aeldari, Tyranids) so that the Unit profile is
 * instead a top-level `sharedProfiles` entry reached via
 * <infoLink type="profile"> nested on each weapon-loadout model sub-entry
 * (e.g. unit → selectionEntryGroups → selectionEntries → infoLinks). Some 10e
 * catalogues do the same (confirmed: 10e Termagants). ruleLinksToAbilityProfiles
 * only keeps Abilities-typed infoLink targets, so these stat lines were dropped
 * entirely and the unit surfaced with an empty `profiles` array.
 *
 * This walks the entry's inline tree for such infoLinks and returns the raw
 * resolved profile nodes, deduped by targetId — the same Unit profile is
 * linked once per model variant (~6× for Kabalite Warriors). Resolution is
 * strictly by targetId: a shared library often carries several same-named
 * Unit profiles (Kabalite Warriors `comment:"Drukhari"` M7" vs
 * `comment:"Ynnari"` M8"), and the datasheet names the exact one. The
 * Unit-typeId gate excludes damage-tier profiles ("Damaged: X Wounds
 * Remaining"), which BSData types as Abilities, not Unit.
 *
 * Callers apply this only as a fallback — when the profiles already collected
 * for the entry contain no Unit-typed profile — so a datasheet that already
 * had a stat line (the overwhelming majority, and every currently-correct 10e
 * unit) is never touched and no duplicate stat row can appear. `withLinkedUnitProfile`
 * packages that guard.
 *
 * Residual: a unit whose model sub-entries are themselves reached only via an
 * entryLink to shared content (rare — e.g. Space Wolves' Wolf Guard
 * Headtakers) is not covered, since this walks the inline tree only.
 */
function collectLinkedUnitProfiles(
  entry: any,
  profileIndex: Map<string, any>,
  resolveEntry?: (id: string) => any,
): any[] {
  const found: any[] = [];
  const seen = new Set<string>();
  const followed = new Set<string>();
  const visit = (node: any, viaLink: boolean): void => {
    if (Array.isArray(node)) {
      node.forEach((n) => visit(n, viaLink));
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const link of ensureArray(node.infoLinks?.infoLink)) {
      if (link["@_type"] !== "profile" || link["@_hidden"] === "true") continue;
      const targetId = link["@_targetId"];
      if (!targetId || seen.has(targetId)) continue;
      const target = profileIndex.get(targetId);
      if (!target || target["@_typeId"] !== UNIT_PROFILE_TYPE_ID) continue;
      seen.add(targetId);
      found.push(target);
    }
    // A model entry reached through an entryLink (Cadian Shock Troops'
    // troopers link to shared model entries) isn't part of the inline tree
    // collectAllProfiles walked, so its own inline Unit profile counts too.
    if (viaLink) {
      for (const p of ensureArray(node.profiles?.profile)) {
        if (p["@_typeId"] !== UNIT_PROFILE_TYPE_ID || !p["@_id"] || seen.has(p["@_id"])) continue;
        seen.add(p["@_id"]);
        found.push(p);
      }
    }
    visit(node.selectionEntries?.selectionEntry, viaLink);
    visit(node.selectionEntryGroups?.selectionEntryGroup, viaLink);
    if (resolveEntry) {
      for (const link of ensureArray(node.entryLinks?.entryLink)) {
        const targetId = link["@_targetId"];
        if (!targetId || followed.has(targetId)) continue;
        const target = resolveEntry(targetId);
        // Only model entries (and groups of them): never wander into shared weapon pools.
        if (!target || target["@_type"] !== "model") continue;
        followed.add(targetId);
        visit(target, true);
      }
    }
  };
  visit(entry, false);
  return found;
}

/**
 * Returns `profiles` unchanged if it already has a Unit-typed stat profile;
 * otherwise appends any Unit profiles reachable from `entry` via
 * <infoLink type="profile"> (see collectLinkedUnitProfiles). No-op without a
 * `profileIndex`.
 */
export function withLinkedUnitProfile(
  entry: any,
  profiles: any[],
  profileIndex?: Map<string, any>,
  resolveEntry?: (id: string) => any,
): any[] {
  if (!profileIndex) return profiles;
  const inlineNames = new Set(
    profiles.filter((p: any) => p["@_typeId"] === UNIT_PROFILE_TYPE_ID).map((p: any) => p["@_name"]),
  );
  const linked = collectLinkedUnitProfiles(entry, profileIndex, resolveEntry).filter(
    (p: any) => !inlineNames.has(p["@_name"]),
  );
  return linked.length ? [...profiles, ...linked] : profiles;
}

function extractPoints(entry: any): number | null {
  const costs = ensureArray(entry.costs?.cost);
  const ptsCost = costs.find(
    (c: any) => c["@_typeId"] === POINTS_COST_TYPE_ID
  );
  if (!ptsCost) return null;
  return Number(ptsCost["@_value"]);
}

/**
 * BSData's "Faction: X" categoryLinks are NOT redundant bookkeeping that
 * duplicates the catalogue-derived `faction` field — they're how the actual
 * army-wide rules keyword (HERETIC ASTARTES, ADEPTUS ASTARTES, NECRONS,
 * ORKS, ...) is attached per-unit, the same keyword that ability/enhancement/
 * stratagem text constantly gates on (e.g. "HERETIC ASTARTES model only").
 * Previously dropped entirely (`!name.startsWith("Faction:")`), which is why
 * every unit in some catalogues (confirmed: all 137 Chaos Space Marines
 * units) had zero army-keyword tag at all. Multi-catalogue-embedded legions
 * also use this same mechanism for their own sub-tag (e.g. 10e's CSM
 * catalogue embeds Emperor's Children units tagged "Faction: Emperor's
 * Children" alongside the shared "Faction: Heretic Astartes"), so this
 * strips only the "Faction: " label prefix and keeps the value as a normal
 * keyword, rather than dropping the category link altogether.
 */
function extractOwnKeywords(entry: any): string[] {
  const links = ensureArray(entry.categoryLinks?.categoryLink);
  const names = links
    .filter((cl: any) => cl["@_hidden"] !== "true")
    .map((cl: any) => (cl["@_name"] as string).replace(/^Faction:\s*/, ""));
  // A few BSData entries (e.g. Grey Knights' Rhino) list the same categoryLink
  // name more than once — dedupe defensively rather than surface a repeated tag.
  return [...new Set(names)];
}

/**
 * A handful of named-character units (Fabius Bile, Traitor Enforcer, ...)
 * are structured in BSData as a thin top-level "unit" wrapper around one or
 * more nested "model" children (Fabius Bile actually has two — himself plus
 * an attached "Surgeon Acolyte" companion model) that carry the actual
 * keyword set — the wrapper's own categoryLinks are just a bare tag or two
 * (e.g. "Epic Hero" alone), while the real Infantry/Character/Chaos/faction
 * tags live on those direct children. Detected structurally (the entry has
 * direct "model"-type children under its own `selectionEntries`) rather
 * than by name: a normal multi-model squad's weapon-option variants are
 * nested inside `selectionEntryGroups` instead (Chosen, Nurglings, Wolf
 * Scouts, ...), a different shape this deliberately doesn't match, and
 * those squads already carry their full keyword set directly on the
 * top-level entry regardless. This only ever adds keywords, never removes
 * any, so it's a no-op for entries that don't have this exact shape.
 */
function extractKeywords(entry: any): string[] {
  const own = extractOwnKeywords(entry);
  if (entry["@_type"] !== "unit") return own;

  const modelChildren = ensureArray(entry.selectionEntries?.selectionEntry).filter(
    (c: any) => c["@_hidden"] !== "true" && c["@_type"] === "model",
  );
  const merged = [...own];
  for (const child of modelChildren) {
    for (const kw of extractKeywords(child)) {
      if (!merged.includes(kw)) merged.push(kw);
    }
  }
  return merged;
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
 * Whether a child is itself a wargear item (carries a Ranged/Melee weapon
 * profile directly, with no "Unit" profile of its own) rather than a model
 * slot — e.g. a standalone character's own top-level weapon options (Chaos
 * Daemons' The Changeling has "The Trickster's Staff" and "Infernal Flames"
 * as direct children, each a mandatory min=1/max=1 "selections" choice, the
 * exact same constraint shape a real model slot like "Aspiring Champion"
 * uses). Without this check, extractUnitSize counted each such weapon as
 * its own model, computing The Changeling — a single-model character — as
 * a 3-model unit. A real model slot carries its own "Unit" characteristics
 * profile (M/T/Sv/W/Ld/OC); a pure weapon item never does.
 */
function isPureWeaponChild(node: any): boolean {
  const profiles = ensureArray(node.profiles?.profile);
  const hasWeapon = profiles.some(
    (p: any) => p["@_typeId"] === RANGED_WEAPON_TYPE_ID || p["@_typeId"] === MELEE_WEAPON_TYPE_ID,
  );
  const hasUnitProfile = profiles.some((p: any) => p["@_typeId"] === UNIT_PROFILE_TYPE_ID);
  return hasWeapon && !hasUnitProfile;
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
 *
 * `children` excludes pure-weapon items (see isPureWeaponChild) before any
 * of the above runs — a standalone character's own top-level weapon
 * options (e.g. Chaos Daemons' The Changeling, whose direct children are
 * just "The Trickster's Staff" and "Infernal Flames") use the identical
 * mandatory min=1/max=1 "selections" constraint shape a real model slot
 * does, and without this exclusion each one was wrongly counted as its own
 * model — a single-model character computed to a 3-model unit.
 */
function extractUnitSize(entry: any, ctx: UnitParseContext = {}): UnitSize {
  const count = countUnitModels(entry, ctx);
  if (count && count.max > 0) {
    // An unbounded count (no max anywhere up the tree — rare, and a data
    // gap rather than a real "any number") falls back to the composition's
    // per-class floor, as extractComposition does.
    const max = Number.isFinite(count.max)
      ? count.max
      : extractComposition(entry, ctx).reduce((sum, c) => sum + c.max, 0);
    return { min: Math.max(1, count.min), max: Math.max(max, 1, count.min) };
  }
  return structuralUnitSize(entry);
}

function structuralUnitSize(entry: any): UnitSize {
  const children = [
    ...ensureArray(entry.selectionEntries?.selectionEntry),
    ...ensureArray(entry.selectionEntryGroups?.selectionEntryGroup),
  ].filter((c: any) => c["@_hidden"] !== "true" && !isPureWeaponChild(c));

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

// === Conditional visibility (BattleScribe `hidden` modifiers) ===

/**
 * The selection context an entry is read in, for evaluating BattleScribe's
 * conditional `hidden` modifiers. BSData shares one datasheet across every
 * Space Marine chapter catalogue and switches chapter-specific content on or
 * off with modifiers like "set hidden=true if the primary catalogue is not
 * Black Templars" (Templar Vows, on every chapter's Captain), or "set
 * hidden=true unless an ancestor is Boyz" on an option inside a shared
 * weapon list. Ignoring those merged every chapter's rules into every copy.
 *
 * `ancestors` holds, outermost first, the ids (entry id, entryLink id, link
 * targetId) and category ids of each enclosing selection entry — groups are
 * not selections, so they aren't pushed.
 */
export type VisibilityEnv = {
  primaryCatalogueId?: string;
  ancestors?: Set<string>[];
  /**
   * Category ids some modifier can add to a selection at roster-build time
   * (e.g. a Chaos "Mark of Khorne" upgrade adds the KHORNE category to its
   * unit). An enclosing entry *lacking* one of these isn't conclusive, so a
   * notInstanceOf check against it stays undecided.
   */
  dynamicCategoryIds?: Set<string>;
};

type Tri = boolean | null;

function andTri(values: Tri[]): Tri {
  if (values.some((v) => v === false)) return false;
  if (values.some((v) => v === null)) return null;
  return true;
}

function orTri(values: Tri[]): Tri {
  if (values.some((v) => v === true)) return true;
  if (values.some((v) => v === null)) return null;
  return false;
}

/**
 * Only `instanceOf`/`notInstanceOf` against the primary catalogue or an
 * enclosing entry can be decided statically; every other condition (roster
 * counts, points limits, detachment choice, ...) depends on a roster that
 * doesn't exist here, so it is unknown (null).
 */
function evalCondition(condition: any, env: VisibilityEnv): Tri {
  const type = condition["@_type"];
  if (type !== "instanceOf" && type !== "notInstanceOf") return null;
  const childId = condition["@_childId"];
  if (!childId) return null;
  const ancestors = env.ancestors ?? [];
  let hit: boolean;
  switch (condition["@_scope"]) {
    case "primary-catalogue":
      if (!env.primaryCatalogueId) return null;
      hit = childId === env.primaryCatalogueId;
      break;
    case "ancestor":
      if (ancestors.length === 0) return null;
      hit = ancestors.some((a) => a.has(childId));
      break;
    case "root-entry":
      if (ancestors.length === 0) return null;
      hit = ancestors[0].has(childId);
      break;
    case "parent":
      if (ancestors.length === 0) return null;
      hit = ancestors[ancestors.length - 1].has(childId);
      break;
    default:
      return null;
  }
  if (!hit && env.dynamicCategoryIds?.has(childId)) return null;
  return type === "instanceOf" ? hit : !hit;
}

function evalConditionSet(node: any, env: VisibilityEnv, combine: "and" | "or"): Tri {
  const values: Tri[] = [
    ...ensureArray(node.conditions?.condition).map((c: any) => evalCondition(c, env)),
    ...ensureArray(node.conditionGroups?.conditionGroup).map((g: any) =>
      evalConditionSet(g, env, g["@_type"] === "or" ? "or" : "and"),
    ),
  ];
  if (values.length === 0) return true;
  return combine === "or" ? orTri(values) : andTri(values);
}

/** Every modifier on a node, each paired with whether its enclosing modifierGroups apply. */
function allModifiers(node: any, env: VisibilityEnv): { modifier: any; groupApplies: Tri }[] {
  const out: { modifier: any; groupApplies: Tri }[] = [];
  const visit = (holder: any, groupApplies: Tri): void => {
    for (const modifier of ensureArray(holder.modifiers?.modifier)) out.push({ modifier, groupApplies });
    for (const group of ensureArray(holder.modifierGroups?.modifierGroup)) {
      visit(group, andTri([groupApplies, evalConditionSet(group, env, group["@_type"] === "or" ? "or" : "and")]));
    }
  };
  visit(node, true);
  return out;
}

/**
 * Whether `node` is hidden in this context. Only hides when certain: a
 * hide-modifier whose conditions can't be decided is ignored, and an
 * undecidable un-hide modifier on a base-hidden node is given the benefit of
 * the doubt — the pre-existing behaviour for everything this can't evaluate.
 * `ignoreBaseHidden` is for infoLink targets (shared rules/profiles), whose
 * own `hidden` attribute this parser has never honoured — BSData sets it on
 * rules like Templar Vows that are then shown conditionally by modifier.
 */
export function isHiddenIn(node: any, env: VisibilityEnv = {}, ignoreBaseHidden = false): boolean {
  let hidden = !ignoreBaseHidden && node?.["@_hidden"] === "true";
  for (const { modifier, groupApplies } of allModifiers(node, env)) {
    if (modifier["@_field"] !== "hidden" || modifier["@_type"] !== "set") continue;
    const applies = andTri([groupApplies, evalConditionSet(modifier, env, "and")]);
    const value = String(modifier["@_value"]) === "true";
    if (applies === true) hidden = value;
    else if (applies === null && !value) hidden = false;
  }
  return hidden;
}

/**
 * An entryLink and its target are one selection: the link's own `hidden` and
 * modifiers apply to the target (a link can un-hide a base-hidden shared
 * entry, or hide it in some catalogues), so both are evaluated together.
 */
export function isLinkHiddenIn(link: any, target: any, env: VisibilityEnv = {}): boolean {
  if (!target) return isHiddenIn(link, env);
  const merged = {
    "@_hidden": link["@_hidden"] === "true" || target["@_hidden"] === "true" ? "true" : "false",
    modifiers: { modifier: [...ensureArray(target.modifiers?.modifier), ...ensureArray(link.modifiers?.modifier)] },
    modifierGroups: {
      modifierGroup: [
        ...ensureArray(target.modifierGroups?.modifierGroup),
        ...ensureArray(link.modifierGroups?.modifierGroup),
      ],
    },
  };
  return isHiddenIn(merged, env);
}

// === Unit composition & wargear options ===

/**
 * Cross-catalogue context for parseEntryNode. `resolveEntry` looks a shared
 * entry/group up by id (fetch-data.ts's global index) so entryLinks — how
 * nearly every weapon option is referenced — can be followed;
 * `primaryCatalogueId` is the catalogue the unit is being listed under, for
 * chapter-/faction-conditional content (see VisibilityEnv).
 */
export type UnitParseContext = {
  resolveEntry?: (id: string) => any;
  profileIndex?: Map<string, any>;
  primaryCatalogueId?: string;
  dynamicCategoryIds?: Set<string>;
};

/**
 * Option pools that aren't part of a datasheet's own wargear: matched-play
 * Enhancements, the Warlord flag, Crusade-only upgrades (Weapon
 * Modifications/Upgrades, Battle Honours, ...). Mirrors fetch-data.ts's
 * UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN, plus "Weapon Upgrades" (the
 * per-weapon Crusade upgrade list linked under every 11e weapon).
 */
const NON_WARGEAR_NAME_PATTERN =
  /enhancement|warlord|crusade|weapon modifications?|weapon upgrades?|battle trait|battle scar|battle honours?|requisition|boons?/i;

const MAX_WARGEAR_DEPTH = 10;

/**
 * A node's "selections"/parent range as BattleScribe means it: a missing min
 * is 0 (optional) and a missing max is unbounded. (extractCountConstraint
 * instead reads a lone bound as a fixed count, which suits its own callers.)
 */
function selectionRange(node: any): UnitSize | null {
  let min: number | null = null;
  let max: number | null = null;
  for (const c of ensureArray(node?.constraints?.constraint)) {
    if (c["@_field"] !== "selections" || c["@_scope"] !== "parent") continue;
    const value = Number(c["@_value"]);
    if (c["@_type"] === "min") min = value;
    else if (c["@_type"] === "max") max = value;
  }
  if (min === null && max === null) return null;
  return { min: min ?? 0, max: max ?? Infinity };
}

/** An entry, group, or entryLink with the link's target resolved and merged in. */
type WNode = {
  name: string;
  kind: "entry" | "group";
  /** The entry's own type ("model", "upgrade", "unit"); "" for groups. */
  type: string;
  ids: string[];
  /** The entry/group itself, or the link's target (empty object if unresolved). */
  node: any;
  link: any | null;
  /** "selections" count scoped to parent; the link's own constraints win. */
  range: UnitSize | null;
  defaultId: string | undefined;
};

function toWNode(raw: any, kind: "entry" | "group"): WNode {
  return {
    name: String(raw["@_name"] ?? "").trim(),
    kind,
    type: kind === "entry" ? (raw["@_type"] ?? "upgrade") : "",
    ids: [raw["@_id"]].filter(Boolean),
    node: raw,
    link: null,
    range: selectionRange(raw),
    defaultId: raw["@_defaultSelectionEntryId"],
  };
}

function linkToWNode(link: any, ctx: UnitParseContext): WNode {
  const target = link["@_targetId"] ? ctx.resolveEntry?.(link["@_targetId"]) : undefined;
  const kind = link["@_type"] === "selectionEntryGroup" ? "group" : "entry";
  return {
    name: String(link["@_name"] || target?.["@_name"] || "").trim(),
    kind,
    type: kind === "entry" ? (target?.["@_type"] ?? "upgrade") : "",
    ids: [link["@_id"], link["@_targetId"], target?.["@_id"]].filter(Boolean),
    node: target ?? {},
    link,
    range: selectionRange(link) ?? selectionRange(target),
    defaultId: target?.["@_defaultSelectionEntryId"] ?? link["@_defaultSelectionEntryId"],
  };
}

function ancestorSet(w: WNode): Set<string> {
  const set = new Set(w.ids);
  for (const holder of [w.node, w.link]) {
    for (const cl of ensureArray(holder?.categoryLinks?.categoryLink)) {
      if (cl["@_targetId"]) set.add(cl["@_targetId"]);
    }
  }
  return set;
}

function withAncestor(env: VisibilityEnv, w: WNode): VisibilityEnv {
  if (w.kind !== "entry") return env;
  return { ...env, ancestors: [...(env.ancestors ?? []), ancestorSet(w)] };
}

function isWargearRelevant(w: WNode, env: VisibilityEnv): boolean {
  if (NON_WARGEAR_NAME_PATTERN.test(w.name)) return false;
  if (/crusade/i.test(String(w.node.comment ?? ""))) return false;
  if (w.range && w.range.max === 0) return false;
  const hidden = w.link ? isLinkHiddenIn(w.link, w.node, env) : isHiddenIn(w.node, env);
  return !hidden;
}

/** Visible children (entries, groups, resolved entryLinks) of `w`, read in `env`. */
function wChildren(w: WNode, ctx: UnitParseContext, env: VisibilityEnv): WNode[] {
  const out: WNode[] = [];
  for (const holder of w.link ? [w.node, w.link] : [w.node]) {
    for (const e of ensureArray(holder.selectionEntries?.selectionEntry)) out.push(toWNode(e, "entry"));
    for (const g of ensureArray(holder.selectionEntryGroups?.selectionEntryGroup)) out.push(toWNode(g, "group"));
    for (const l of ensureArray(holder.entryLinks?.entryLink)) out.push(linkToWNode(l, ctx));
  }
  return out.filter((c) => isWargearRelevant(c, env));
}

function isModelNode(w: WNode): boolean {
  return w.type === "model" || w.type === "unit";
}

function containsModels(w: WNode, ctx: UnitParseContext, env: VisibilityEnv, depth = 0): boolean {
  if (depth > MAX_WARGEAR_DEPTH) return false;
  const childEnv = withAncestor(env, w);
  return wChildren(w, ctx, childEnv).some(
    (c) => isModelNode(c) || containsModels(c, ctx, childEnv, depth + 1),
  );
}

// --- Composition ---

/**
 * "Intercessor w/ Grenade Launcher" → "Intercessor"; "Boy with Big Shoota" →
 * "Boy"; "Kataphron Destroyer (Heavy grav-cannon & Cognis flamer)" →
 * "Kataphron Destroyer".
 */
function baseModelName(name: string): string {
  return (
    name
      .replace(/\s+(?:w\/|with)\s.*$/i, "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim() || name
  );
}

/** Name of the Unit profile a model entry carries (inline, or via a profile infoLink), if any. */
function ownUnitProfileName(w: WNode, ctx: UnitParseContext): string | null {
  const inline = ensureArray(w.node.profiles?.profile).find((p: any) => p["@_typeId"] === UNIT_PROFILE_TYPE_ID);
  if (inline) return inline["@_name"] ?? null;
  for (const holder of [w.node, w.link].filter(Boolean)) {
    for (const link of ensureArray(holder.infoLinks?.infoLink)) {
      if (link["@_type"] !== "profile") continue;
      const target = ctx.profileIndex?.get(link["@_targetId"]);
      if (target?.["@_typeId"] === UNIT_PROFILE_TYPE_ID) return target["@_name"] ?? null;
    }
  }
  return null;
}

/**
 * Some datasheets name each trooper entry after its loadout alone — Chaos
 * Terminators' "4 Terminators" group holds "Accursed weapon and
 * combi-bolter", "Power fist and combi-weapon", ... (0-4 each) with no
 * per-model profile. A group made up entirely of three or more such
 * optional, unrelated-by-name model entries is one model type, named after
 * their shared Unit profile or else the group ("4 Terminators" →
 * "Terminators"); each loadout is then listed under it. A group that also
 * holds a mandatory or same-named model, or a sub-group (Corsair
 * Voidscarred's specialists sit beside a "Voidscarred" group), is left
 * alone, as are distinctly-profiled specialists.
 */
function loadoutNamedSiblingClass(group: WNode, siblings: WNode[], ctx: UnitParseContext): Map<WNode, string> {
  const renames = new Map<WNode, string>();
  const models = siblings.filter((c) => c.type === "model");
  const optional = models.filter((c) => !c.range || c.range.min === 0);
  const baseNames = new Set(optional.map((c) => baseModelName(c.name).toLowerCase()));
  if (optional.length < 3 || optional.length !== models.length || baseNames.size !== optional.length) return renames;
  if (siblings.some((c) => c.kind === "group")) return renames;
  const profileNames = new Set(optional.map((c) => ownUnitProfileName(c, ctx)));
  if (profileNames.size > 1) return renames;
  const name = [...profileNames][0] ?? group.name.replace(/^\d+(?:\s*-\s*\d+)?\s+/, "").trim();
  if (!name) return renames;
  for (const c of optional) renames.set(c, name);
  return renames;
}

/** Class identity: case- and plural-insensitive ("Termagants" entry + "Termagant w/ Spike rifle" variants). */
function classKey(model: string): string {
  const lower = model.toLowerCase();
  return lower.length > 3 && lower.endsWith("s") ? lower.slice(0, -1) : lower;
}

type ModelPlacement = { w: WNode; env: VisibilityEnv; groups: WNode[] };
type ModelClass = { model: string; min: number; max: number; placements: ModelPlacement[] };
type ModelCount = { classes: ModelClass[]; min: number; max: number };

function mergeClasses(parts: ModelCount[]): ModelClass[] {
  const byName = new Map<string, ModelClass>();
  for (const part of parts) {
    for (const c of part.classes) {
      const key = classKey(c.model);
      const existing = byName.get(key);
      if (existing) {
        existing.min += c.min;
        existing.max += c.max;
        existing.placements.push(...c.placements);
      } else {
        byName.set(key, { ...c, placements: [...c.placements] });
      }
    }
  }
  return [...byName.values()];
}

/**
 * Model counts under `w`: a model entry is its own range (default exactly 1);
 * a group sums its children, then clamps to its own constraint — BSData puts
 * the unit's real size on the group ("Intercessors" 5-10) while the members
 * carry looser per-entry ranges (Sergeant 1, Intercessor 4-9, Intercessor w/
 * Grenade Launcher 0-2). Per-class ranges are clamped against the rest of
 * the group the same way. Returns null when there are no models under `w`.
 */
function countModels(
  w: WNode,
  ctx: UnitParseContext,
  env: VisibilityEnv,
  groups: WNode[],
  depth: number,
  className?: string,
): ModelCount | null {
  if (depth > MAX_WARGEAR_DEPTH) return null;
  if (w.type === "model") {
    // No constraint of its own: optional and unbounded inside a constrained
    // group (which then sets the count — Strike Squad's plain "Grey Knight"
    // entry under "4-9 Grey Knights"), otherwise taken to be exactly one.
    const range = w.range ?? (groups[groups.length - 1]?.range ? { min: 0, max: Infinity } : { min: 1, max: 1 });
    return {
      classes: [{ model: className ?? baseModelName(w.name), min: range.min, max: range.max, placements: [{ w, env, groups }] }],
      min: range.min,
      max: range.max,
    };
  }

  const childEnv = withAncestor(env, w);
  const childGroups = w.kind === "group" ? [...groups, w] : groups;
  const children = wChildren(w, ctx, childEnv);
  const renames = w.kind === "group" ? loadoutNamedSiblingClass(w, children, ctx) : new Map<WNode, string>();
  const counted = children
    .map((c) => ({ c, count: countModels(c, ctx, childEnv, childGroups, depth + 1, renames.get(c)) }))
    .filter((x): x is { c: WNode; count: ModelCount } => x.count !== null);
  if (counted.length === 0) return null;
  const parts = counted.map((x) => x.count);

  // A pick-one group whose children are whole-unit bundles ("Unit
  // Composition": "1 Sergeant and 9 Shock Troopers" or "2 Sergeants and 18
  // Shock Troopers") constrains how many bundles are picked, not models: the
  // unit is one alternative or another.
  const isBundle = (c: WNode): boolean => c.kind === "entry" && !isModelNode(c);
  if (w.kind === "group" && w.range && w.range.max === 1 && counted.every((x) => isBundle(x.c))) {
    return alternativeCounts(parts, w.range.min === 0);
  }

  // A bundle elsewhere (Cadian Recon Squad's optional two-model "Weapons
  // Team" among single troopers) is picked a number of times, each pick
  // adding its models.
  const inGroup = w.kind === "group";
  const picks = (c: WNode): UnitSize => c.range ?? (inGroup ? { min: 0, max: 1 } : { min: 1, max: 1 });
  const scaled = counted.map(({ c, count }) => (isBundle(c) ? scaleCount(count, picks(c)) : count));
  const classes = mergeClasses(scaled);
  let min = scaled.reduce((sum, p) => sum + p.min, 0);
  let max = scaled.reduce((sum, p) => sum + p.max, 0);
  if (inGroup && w.range) {
    // The group's constraint counts selections — a bundle pick is one
    // selection however many models it brings — so clamp selections, then
    // add back each bundle's extra models.
    let selMin = 0;
    let selMax = 0;
    let extraMin = 0;
    let extraMax = 0;
    for (const { c, count } of counted) {
      if (isBundle(c)) {
        const r = picks(c);
        selMin += r.min;
        selMax += r.max;
        extraMin += r.min * Math.max(count.min - 1, 0);
        extraMax += r.max * Math.max(count.max - 1, 0);
      } else {
        selMin += count.min;
        selMax += count.max;
      }
    }
    min = Math.max(selMin, w.range.min) + extraMin;
    max = Math.min(selMax, w.range.max) + extraMax;
  }
  for (const c of classes) {
    const othersMin = classes.reduce((sum, o) => (o === c ? sum : sum + o.min), 0);
    const othersMax = classes.reduce((sum, o) => (o === c ? sum : sum + o.max), 0);
    c.max = Math.min(c.max, max - othersMin);
    c.min = Math.max(c.min, min - othersMax, 0);
    if (c.min > c.max) c.min = c.max;
  }
  return { classes, min, max };
}

/** One of several alternative bundles: each class ranges over what the alternatives give it. */
function alternativeCounts(alternatives: ModelCount[], optional: boolean): ModelCount {
  const names = new Map<string, ModelClass>();
  for (const alt of alternatives) {
    for (const c of alt.classes) {
      const key = classKey(c.model);
      if (!names.has(key)) names.set(key, { model: c.model, min: Infinity, max: 0, placements: [] });
    }
  }
  for (const [key, cls] of names) {
    for (const alt of alternatives) {
      const match = alt.classes.find((c) => classKey(c.model) === key);
      cls.min = Math.min(cls.min, match ? match.min : 0);
      cls.max = Math.max(cls.max, match ? match.max : 0);
      if (match) cls.placements.push(...match.placements);
    }
    if (optional) cls.min = 0;
  }
  return {
    classes: [...names.values()],
    min: optional ? 0 : Math.min(...alternatives.map((a) => a.min)),
    max: Math.max(...alternatives.map((a) => a.max)),
  };
}

function scaleCount(count: ModelCount, range: UnitSize): ModelCount {
  return {
    classes: count.classes.map((c) => ({ ...c, min: c.min * range.min, max: c.max * range.max })),
    min: count.min * range.min,
    max: count.max * range.max,
  };
}

function rootWNode(entry: any): WNode {
  return toWNode(entry, "entry");
}

function rootEnv(ctx: UnitParseContext): VisibilityEnv {
  return { primaryCatalogueId: ctx.primaryCatalogueId, ancestors: [], dynamicCategoryIds: ctx.dynamicCategoryIds };
}

/**
 * Every category id that some modifier adds to a selection ("add category"),
 * across the given catalogue/game-system nodes — see
 * VisibilityEnv.dynamicCategoryIds.
 */
export function collectDynamicCategoryIds(nodes: any[]): Set<string> {
  const ids = new Set<string>();
  const visit = (node: any): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const m of ensureArray(node.modifiers?.modifier)) {
      if (m["@_field"] === "category" && m["@_type"] === "add" && m["@_value"]) ids.add(String(m["@_value"]));
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value);
    }
  };
  nodes.forEach(visit);
  return ids;
}

/**
 * The unit's model classes. A "model"-typed root (a character or vehicle
 * datasheet with no "unit" wrapper) is itself one model, plus any model
 * children; a "unit"-typed root is purely its children. Null if the tree has
 * no model-typed entries at all (the caller then falls back to the older
 * structural heuristic in extractUnitSize).
 */
function countUnitModels(entry: any, ctx: UnitParseContext): ModelCount | null {
  const root = rootWNode(entry);
  const env = rootEnv(ctx);
  const inner = countModels({ ...root, type: "unit" }, ctx, env, [], 0);
  if (root.type !== "model") return inner;

  const self: ModelClass = { model: root.name, min: 1, max: 1, placements: [{ w: root, env, groups: [] }] };
  if (!inner) return { classes: [self], min: 1, max: 1 };
  return { classes: [self, ...inner.classes], min: 1 + inner.min, max: 1 + inner.max };
}

/** Model types with min/max counts, e.g. Intercessor Sergeant 1 + Intercessor 4-9. */
export function extractComposition(entry: any, ctx: UnitParseContext = {}): CompositionEntry[] {
  const count = countUnitModels(entry, ctx);
  if (!count) return [];
  return count.classes
    .filter((c) => c.max > 0)
    .map((c) => ({ model: c.model, min: c.min, max: Number.isFinite(c.max) ? c.max : Math.max(c.min, 1) }));
}

// --- Wargear ---

type LoadoutItem = { label: string; names: string[] };
type Alt = { name: string; ids: string[]; loadout: Loadout | null; notes: string[] };
type Choice = { label: string; min: number; max: number; def: number; alts: Alt[] };
type Loadout = {
  fixed: { name: string; count: number; notes: string[] }[];
  optional: { name: string; max: number; notes: string[] }[];
  choices: Choice[];
};

function emptyLoadout(): Loadout {
  return { fixed: [], optional: [], choices: [] };
}

function isEmptyLoadout(lo: Loadout): boolean {
  return lo.fixed.length === 0 && lo.optional.length === 0 && lo.choices.length === 0;
}

function mergeLoadout(into: Loadout, from: Loadout): void {
  for (const f of from.fixed) addFixed(into, f.name, f.count, f.notes);
  into.optional.push(...from.optional.filter((o) => !into.optional.some((x) => x.name === o.name)));
  into.choices.push(...from.choices);
}

function addFixed(lo: Loadout, name: string, count: number, notes: string[]): void {
  if (lo.fixed.some((f) => f.name === name)) return;
  lo.fixed.push({ name, count, notes });
}

function hasOwnWeaponOrAbilityProfile(w: WNode): boolean {
  return ensureArray(w.node.profiles?.profile).some((p: any) =>
    [RANGED_WEAPON_TYPE_ID, MELEE_WEAPON_TYPE_ID, ABILITY_TYPE_ID].includes(p["@_typeId"]),
  );
}

/** "5+ models" for a model-count condition (`selections` of "model" at least/greater than N), else null. */
function modelCountThreshold(m: any): number | null {
  const conditions = ensureArray(m.conditions?.condition);
  if (conditions.length !== 1 || ensureArray(m.conditionGroups?.conditionGroup).length > 0) return null;
  const c = conditions[0];
  if (c["@_childId"] !== "model" || c["@_field"] !== "selections") return null;
  const value = Number(c["@_value"]);
  if (!Number.isFinite(value)) return null;
  if (c["@_type"] === "atLeast" || c["@_type"] === "equalTo") return value;
  if (c["@_type"] === "greaterThan") return value + 1;
  return null;
}

/** "6 with 20+ models" for a modifier that raises constraint `constraint` once the unit is big enough. */
function constraintScalingNote(holder: any, constraint: any, env: VisibilityEnv): string | null {
  const base = Number(constraint["@_value"]);
  for (const { modifier } of allModifiers(holder, env)) {
    if (modifier["@_field"] !== constraint["@_id"]) continue;
    const threshold = modelCountThreshold(modifier);
    if (threshold === null) continue;
    const value = Number(modifier["@_value"]);
    if (modifier["@_type"] === "set") return `${value} with ${threshold}+ models`;
    if (modifier["@_type"] === "increment") return `${base + value} with ${threshold}+ models`;
  }
  return null;
}

/** "+1 per 10 models": a modifier raising constraint `constraint` by `value` for every `per` models in the unit. */
function perModelsIncrement(holder: any, constraint: any, env: VisibilityEnv): { value: number; per: number } | null {
  for (const { modifier } of allModifiers(holder, env)) {
    if (modifier["@_field"] !== constraint["@_id"] || modifier["@_type"] !== "increment") continue;
    const repeat = ensureArray(modifier.repeats?.repeat)[0];
    if (!repeat || repeat["@_childId"] !== "model") continue;
    const per = Number(repeat["@_value"]);
    const value = Number(modifier["@_value"]) * (Number(repeat["@_repeats"]) || 1);
    if (Number.isFinite(per) && per > 0 && Number.isFinite(value)) return { value, per };
  }
  return null;
}

/**
 * Per-unit limits on an option, as readable notes: a `selections` max scoped
 * to the unit ("max 1 per unit"), any model-count scaling of it, and
 * BSData's own validation text ("Max 1 {this} per 5 models").
 */
function limitNotes(w: WNode, env: VisibilityEnv): string[] {
  const notes: string[] = [];
  for (const holder of [w.link, w.node].filter(Boolean)) {
    for (const c of ensureArray(holder.constraints?.constraint)) {
      if (c["@_field"] !== "selections" || c["@_type"] !== "max" || c["@_scope"] !== "unit") continue;
      const perModels = perModelsIncrement(holder, c, env);
      if (perModels) {
        const base = Number(c["@_value"]);
        notes.push(
          base === 0
            ? `max ${perModels.value} per ${perModels.per} models`
            : `max ${base} per unit, +${perModels.value} per ${perModels.per} models`,
        );
        continue;
      }
      const scaling = constraintScalingNote(holder, c, env);
      notes.push(`max ${c["@_value"]} per unit${scaling ? `, ${scaling}` : ""}`);
    }
    for (const { modifier } of allModifiers(holder, env)) {
      if (modifier["@_type"] !== "add" || modifier["@_field"] !== "error") continue;
      const text = String(modifier["@_value"] ?? "").replace(/\{this\}/g, w.name).trim();
      if (text) notes.push(text);
    }
  }
  return [...new Set(notes)];
}

/**
 * The options of a choice group. A sub-group among them is just more
 * options — Battle Sisters' "Weapon" choice holds a "Special Weapons" and a
 * "Heavy Weapons" list — so it's flattened into one list.
 */
function choiceAlternatives(group: WNode, ctx: UnitParseContext, env: VisibilityEnv, depth: number): WNode[] {
  if (depth > MAX_WARGEAR_DEPTH) return [];
  return wChildren(group, ctx, env)
    .filter((a) => !isModelNode(a))
    .flatMap((a) => (a.kind === "group" ? choiceAlternatives(a, ctx, env, depth + 1) : [a]));
}

function toAlt(w: WNode, ctx: UnitParseContext, env: VisibilityEnv, depth: number): Alt {
  const notes = limitNotes(w, env);
  if (w.kind === "group" || !hasOwnWeaponOrAbilityProfile(w)) {
    const loadout = buildLoadout(w, ctx, env, depth + 1);
    if (!isEmptyLoadout(loadout)) return { name: w.name, ids: w.ids, loadout, notes };
  }
  return { name: w.name, ids: w.ids, loadout: null, notes };
}

/**
 * A model's (or loadout bundle's) wargear: mandatory items, optional items,
 * and choice groups. A constrained group is a choice between its children —
 * a weapon ("Weapon 1": Bolt Rifle or Hand flamer or ...) or a whole bundle
 * (the Captain's "Wargear" group picks one of three named loadouts, each its
 * own nested items and choices). An unconstrained group is just a folder
 * ("Wargear") and is flattened. Model entries are skipped — they're
 * composition, handled by countModels.
 */
function buildLoadout(w: WNode, ctx: UnitParseContext, env: VisibilityEnv, depth: number): Loadout {
  const lo = emptyLoadout();
  if (depth > MAX_WARGEAR_DEPTH) return lo;
  const childEnv = withAncestor(env, w);
  for (const c of wChildren(w, ctx, childEnv)) {
    if (isModelNode(c) || containsModels(c, ctx, childEnv)) continue;

    if (c.kind === "group") {
      if (!c.range) {
        mergeLoadout(lo, buildLoadout(c, ctx, childEnv, depth + 1));
        continue;
      }
      const alts = choiceAlternatives(c, ctx, childEnv, depth).map((a) => toAlt(a, ctx, childEnv, depth + 1));
      if (alts.length === 0) continue;
      if (alts.length === 1 && c.range.min >= 1) {
        const only = alts[0];
        if (only.loadout) mergeLoadout(lo, only.loadout);
        else addFixed(lo, only.name, c.range.min, only.notes);
        continue;
      }
      const def = c.defaultId ? alts.findIndex((a) => a.ids.includes(c.defaultId!)) : -1;
      lo.choices.push({ label: c.name, min: c.range.min, max: c.range.max, def, alts });
      continue;
    }

    const notes = limitNotes(c, childEnv);
    if (c.range && c.range.min === 0) {
      lo.optional.push({ name: c.name, max: c.range.max, notes });
      continue;
    }
    const sub = hasOwnWeaponOrAbilityProfile(c) ? null : buildLoadout(c, ctx, childEnv, depth + 1);
    if (sub && !isEmptyLoadout(sub)) mergeLoadout(lo, sub);
    else addFixed(lo, c.name, c.range?.min ?? 1, notes);
  }
  return lo;
}

function withNotes(name: string, notes: string[]): string {
  return notes.length ? `${name} (${notes.join("; ")})` : name;
}

function joinOr(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `one of (${labels.join(", ")})`;
}

/**
 * What an alternative gives: a single item, or a bundle's contents. Some
 * bundles mark their own contents optional ("1 Blast pistol and 1 Power
 * weapon", each 0-1), so those count too; failing all else, its name.
 */
function altItems(alt: Alt): LoadoutItem[] {
  if (!alt.loadout) return [{ label: withNotes(alt.name, alt.notes), names: [alt.name] }];
  const items = defaultItems(alt.loadout);
  if (items.length > 0) return items;
  const optional = alt.loadout.optional.map((o) => ({ label: o.name, names: [o.name] }));
  return optional.length > 0 ? optional : [{ label: alt.name, names: [alt.name] }];
}

function altLabel(alt: Alt): string {
  return altItems(alt)
    .map((i) => i.label)
    .join(" and ");
}

function altNames(alt: Alt): string[] {
  return altItems(alt).flatMap((i) => i.names);
}

/** What the model carries if no option is taken. A choice with no default reads "A or B". */
function defaultItems(lo: Loadout): LoadoutItem[] {
  const items: LoadoutItem[] = lo.fixed.map((f) => ({
    label: f.count > 1 ? `${f.count}x ${f.name}` : f.name,
    names: [f.name],
  }));
  for (const ch of lo.choices) {
    if (ch.def >= 0) {
      items.push(...altItems(ch.alts[ch.def]));
    } else if (ch.min >= 1 && ch.max === 1) {
      items.push({ label: joinOr(ch.alts.map(altLabel)), names: ch.alts.flatMap(altNames) });
    }
  }
  return items;
}

function optionLines(lo: Loadout): string[] {
  const lines: string[] = [];
  for (const ch of lo.choices) {
    if (ch.max > 1) {
      lines.push(`${ch.label}: choose ${rangeText({ min: ch.min, max: ch.max })} from: ${ch.alts.map(altLabel).join(", ")}`);
      continue;
    }
    if (ch.def >= 0) {
      const def = ch.alts[ch.def];
      const others = ch.alts.filter((_, i) => i !== ch.def);
      // Swapping one default item reads "X can be replaced with ..." even if
      // some options are bundles ("Bolt Rifle and Astartes grenade
      // launcher"); swapping a whole multi-item default loadout reads as
      // alternative loadouts.
      if (altItems(def).length <= 1) {
        lines.push(
          `${def.name} can be replaced with ${others.length > 1 ? "one of: " : ""}${others.map(altLabel).join(", ")}`,
        );
        continue;
      }
      const defItems = altItems(def);
      for (const other of others) {
        const otherItems = altItems(other);
        const otherNames = new Set(otherItems.flatMap((i) => i.names));
        const replaced = defItems.filter((i) => !i.names.some((n) => otherNames.has(n))).map((i) => i.label);
        lines.push(
          `Alternative loadout: ${otherItems.map((i) => i.label).join(", ")}${replaced.length ? ` (replaces ${replaced.join(", ")})` : ""}`,
        );
      }
      if (def.loadout) lines.push(...optionLines(def.loadout));
      continue;
    }
    // A mandatory choice with no default is already spelled out in the
    // default loadout as "A or B" / "one of (A, B, C)".
    if (ch.min >= 1) continue;
    lines.push(`Optional ${ch.label}: ${ch.alts.length > 1 ? "one of " : ""}${ch.alts.map(altLabel).join(", ")}`);
  }
  if (lo.optional.length > 0) {
    const items = lo.optional.map((o) =>
      withNotes(o.max > 1 && Number.isFinite(o.max) ? `up to ${o.max}x ${o.name}` : o.name, o.notes),
    );
    lines.push(`Can also take: ${items.join(", ")}`);
  }
  return lines;
}

function rangeText(range: UnitSize | null): string {
  if (!range) return "any number";
  if (!Number.isFinite(range.max)) return range.min > 0 ? `${range.min}+` : "any number";
  if (range.min === range.max) return `${range.max}`;
  return range.min > 0 ? `${range.min}-${range.max}` : `up to ${range.max}`;
}

/** Limits on a sub-group a loadout variant sits in, e.g. Boyz' "Special Weapons: max 3 total, 6 with 20+ models". */
function groupLimitNotes(
  placement: ModelPlacement,
  base: ModelPlacement,
  ctx: UnitParseContext,
  env: VisibilityEnv,
): string[] {
  const notes: string[] = [];
  // Only groups of variants alone (Boyz' "Special Weapons"), not the squad
  // group the base model also sits in ("9-18 Boyz").
  const holdsBase = (g: WNode, depth = 0): boolean =>
    depth <= MAX_WARGEAR_DEPTH &&
    wChildren(g, ctx, env).some((c) => c.name === base.w.name || (c.kind === "group" && holdsBase(c, depth + 1)));
  for (const g of placement.groups.filter((g) => !base.groups.includes(g) && !holdsBase(g))) {
    if (!g.range || !Number.isFinite(g.range.max)) continue;
    const holder = g.link ?? g.node;
    const maxConstraint = ensureArray(holder.constraints?.constraint).find(
      (c: any) => c["@_field"] === "selections" && c["@_scope"] === "parent" && c["@_type"] === "max",
    );
    const scaling = maxConstraint ? constraintScalingNote(holder, maxConstraint, env) : null;
    notes.push(`${g.name}: max ${g.range.max} total${scaling ? `, ${scaling}` : ""}`);
  }
  return notes;
}

/**
 * A loadout variant BSData models as its own model entry ("Intercessor w/
 * Grenade Launcher", up to 2) read as an option on the base model: what it
 * adds/swaps relative to the base loadout, and how many can take it.
 */
function variantOptionLine(
  ctx: UnitParseContext,
  className: string,
  baseItems: LoadoutItem[],
  base: ModelPlacement,
  variant: ModelPlacement,
  variantLoadout: Loadout,
): string {
  const variantItems = defaultItems(variantLoadout);
  const baseLabels = new Set(baseItems.map((i) => i.label));
  const variantLabels = new Set(variantItems.map((i) => i.label));
  const added = variantItems.filter((i) => !baseLabels.has(i.label)).map((i) => i.label);
  const removed = baseItems.filter((i) => !variantLabels.has(i.label)).map((i) => i.label);
  const addedNotes = variantLoadout.fixed.filter((f) => added.includes(f.name)).flatMap((f) => f.notes);
  const notes = [...new Set([...addedNotes, ...groupLimitNotes(variant, base, ctx, variant.env)])];

  const max = variant.w.range?.max;
  const who =
    max === undefined || !Number.isFinite(max) ? `Any number of ${className} models` : `Up to ${max} ${className} model${max === 1 ? "" : "s"}`;
  const swap =
    added.length === 0
      ? `can be equipped as ${variant.w.name}`
      : removed.length > 0
        ? `can each replace ${removed.join(" and ")} with ${added.join(" and ")}`
        : `can each add ${added.join(" and ")}`;
  return withNotes(`${who} ${swap}`, notes);
}

/**
 * Default loadout and options for each model type in the unit (see
 * ModelWargear). Loadout variants of a model type are folded into that
 * type's options when it has a plain base entry (Intercessor + "Intercessor
 * w/ Grenade Launcher"); otherwise (Devastator Marine w/ Boltgun / w/ Heavy
 * Weapon, no plain one) each variant is listed with its own count.
 */
export function extractWargear(entry: any, ctx: UnitParseContext = {}): ModelWargear[] {
  const count = countUnitModels(entry, ctx);
  const root = rootWNode(entry);
  const out: ModelWargear[] = [];
  const push = (model: string, lo: Loadout, extraOptions: string[] = []): void => {
    const def = defaultItems(lo).map((i) => i.label);
    const options = [...optionLines(lo), ...extraOptions];
    if (def.length === 0 && options.length === 0) return;
    out.push({ model, default: def, options });
  };

  if (!count) {
    // No model entries at all: whatever wargear hangs off the unit itself.
    push(root.name, buildLoadout(root, ctx, rootEnv(ctx), 0));
    return out;
  }

  for (const cls of count.classes) {
    if (cls.max <= 0) continue;
    // The same model entry can sit in several alternative bundles (Cadian
    // Shock Troops' 10- and 20-model compositions both link "Shock
    // Trooper"); list it once, with its largest count.
    const byEntry = new Map<string, ModelPlacement>();
    for (const p of cls.placements) {
      const key = p.w.name.toLowerCase();
      const seen = byEntry.get(key);
      if (!seen || (p.w.range?.max ?? 0) > (seen.w.range?.max ?? 0)) byEntry.set(key, p);
    }
    const placements = [...byEntry.values()];
    const loadouts = placements.map((p) => buildLoadout(p.w, ctx, p.env, 0));
    if (placements.length === 1) {
      push(placements[0].w.name, loadouts[0]);
      continue;
    }
    // The base is the plainly-named entry ("Intercessor"), else the one its
    // group selects by default (10e Boyz: "Boy w/ Slugga and choppa").
    let baseIdx = placements.findIndex((p) => classKey(p.w.name) === classKey(cls.model));
    if (baseIdx < 0) {
      baseIdx = placements.findIndex((p) => {
        const defaultId = p.groups[p.groups.length - 1]?.defaultId;
        return defaultId !== undefined && p.w.ids.includes(defaultId);
      });
    }
    if (baseIdx < 0) {
      placements.forEach((p, i) => {
        const range = p.w.range ?? { min: 0, max: cls.max };
        push(`${p.w.name} (${rangeText({ min: range.min, max: Math.min(range.max, cls.max) })})`, loadouts[i]);
      });
      continue;
    }
    const base = placements[baseIdx];
    const baseItems = defaultItems(loadouts[baseIdx]);
    const variantLines: string[] = [];
    placements.forEach((p, i) => {
      if (i === baseIdx || p.w.name === base.w.name) return;
      variantLines.push(variantOptionLine(ctx, cls.model, baseItems, base, p, loadouts[i]));
      variantLines.push(...optionLines(loadouts[i]).map((line) => `${p.w.name}: ${line}`));
    });
    push(base.w.name, loadouts[baseIdx], variantLines);
  }
  return out;
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
  allProfiles?: any[],
  context: UnitParseContext = {},
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
    unitSize: extractUnitSize(entry, context),
    composition: extractComposition(entry, context),
    wargear: extractWargear(entry, context),
    gameSystem: "wh40k-10e" as const,
  };
}

export {
  extractFaction,
  collectAllProfiles,
  buildRuleIndex,
  buildProfileIndex,
  extractUnitSize,
  ruleLinksToAbilityProfiles,
};

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
        composition: extractComposition(entry),
        wargear: extractWargear(entry),
        gameSystem: "wh40k-10e" as const,
      };
    });
}

// === Detachment & Enhancement extraction ===

/**
 * A detachment's "Detachment Points" cost (1-3), read the same way unit
 * points are (a <cost> entry keyed by typeId). 11th Edition only — BSData's
 * 10e catalogues never have this cost type at all, so this returns null for
 * every 10e detachment.
 */
function extractDetachmentPoints(entry: any): number | null {
  const costs = ensureArray(entry.costs?.cost);
  const dpCost = costs.find((c: any) => c["@_typeId"] === DETACHMENT_POINTS_TYPE_ID);
  if (!dpCost) return null;
  return Number(dpCost["@_value"]);
}

/**
 * Which Force Disposition(s) a detachment can select when mustering, read
 * from its categoryLinks. BSData tags each detachment selectionEntry with
 * one (occasionally two) of the five disposition names alongside other,
 * unrelated categoryLinks — a "3DP Detachment" redundancy flag, and
 * mutual-exclusion tags (see extractDetachmentRestrictionTags below) —
 * filtered out here by only keeping names that match one of the five known
 * values. 11th Edition only, same as extractDetachmentPoints above.
 */
function extractDetachmentDispositions(entry: any): Disposition[] {
  const links = ensureArray(entry.categoryLinks?.categoryLink);
  const names = links
    .filter((cl: any) => cl["@_hidden"] !== "true")
    .map((cl: any) => cl["@_name"] as string);
  return KNOWN_DISPOSITIONS.filter((d) => names.includes(d));
}

/**
 * A detachment's mutual-exclusion tag(s) (e.g. "Nightmare", "Doomed",
 * "Grace", "Covens", "Kabal") — confirmed against BSData/wh40k-11e's own
 * rule text, which spells this out explicitly on (at least) one member of
 * each pair/group: "This detachment has the NIGHTMARE tag and cannot be
 * taken with another NIGHTMARE detachment." (Chaos Space Marines'
 * Murdertalon Raiders). These are just the categoryLinks left over once the
 * five known dispositions and the "NDP Detachment" redundancy flag are
 * removed — every other categoryLink checked on a detachment turned out to
 * follow this same pattern, always appearing on exactly the other
 * detachment(s) it's mutually exclusive with (Space Marines' "Doomed" is a
 * rare 3-way group: The Lost Brethren/Rage-Cursed Onslaught/Wrath of the
 * Doomed, no two of which can be combined).
 *
 * Gated on extractDetachmentPoints being non-null (i.e. this is a real
 * 11e-tagged detachment) rather than trusting "not a known disposition" the
 * way extractDetachmentDispositions can: 10e detachments have no Detachment
 * Points concept at all but can still carry an unrelated, coincidental
 * categoryLink (e.g. a stray "Grenades" tag was found on 10e's own "Gladius
 * Task Force" entry) that would otherwise be wrongly reported as a
 * restriction tag.
 */
function extractDetachmentRestrictionTags(entry: any): string[] {
  if (extractDetachmentPoints(entry) === null) return [];

  const links = ensureArray(entry.categoryLinks?.categoryLink);
  const names = links
    .filter((cl: any) => cl["@_hidden"] !== "true")
    .map((cl: any) => cl["@_name"] as string)
    .filter((name: string) => !KNOWN_DISPOSITIONS.includes(name as Disposition))
    .filter((name: string) => !/^\dDP Detachment$/i.test(name));
  return [...new Set(names)];
}

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
 * Build an index of shared profiles from a catalogue (or game system) node,
 * for resolving <infoLink type="profile"> — the profile-based counterpart to
 * buildRuleIndex/<infoLink type="rule"> (see ruleLinksToAbilityProfiles).
 * Profiles may be in <profiles>, <sharedProfiles>, or both.
 */
function buildProfileIndex(catNode: any): Map<string, any> {
  const index = new Map<string, any>();
  const directProfiles = ensureArray(catNode.profiles?.profile);
  const sharedProfiles = ensureArray(catNode.sharedProfiles?.profile);
  for (const profile of [...directProfiles, ...sharedProfiles]) {
    if (profile["@_id"]) {
      index.set(profile["@_id"], profile);
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
      detachmentPoints: extractDetachmentPoints(entry),
      dispositions: extractDetachmentDispositions(entry),
      restrictionTags: extractDetachmentRestrictionTags(entry),
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

// === Crusade Honours (BSData/wh40k-11e only) ===
//
// Every Crusade Battle Trait / Crusade Relic / Battle Scar entry in BSData
// follows the exact same shape as an Enhancement: a selectionEntry with an
// Abilities-typed profile whose "Description" characteristic holds the rule
// text (see extractEnhancementDescription above, reused here unchanged).
// What differs is where these entries live:
//   - Generic (universal): gameSystem-level "Main Rules Battle Scars".
//   - Faction-specific: a catalogue's own top-level shared group tagged
//     `comment: "Crusade content"` (e.g. CSM's "Codex Battle Traits",
//     "Codex Crusade Relics", "Chaos Boons").
//   - Campaign-specific: gameSystem-level groups named "<Campaign> Battle
//     Traits" / "<Campaign> Crusade Relics" (Tyrannic War, Pariah Nexus,
//     Nachmund Gauntlet, Armageddon), reachable either nested under a
//     generic wrapper group or as their own top-level shared group —
//     BSData is inconsistent about which, so campaign groups are found by
//     recursively walking every shared group's subgroups rather than
//     assuming a fixed nesting depth.
// Confirmed against BSData/wh40k-11e's "Warhammer 40,000.json" (game
// system) and "Chaos - Chaos Space Marines.json" (catalogue) — see
// docs/design/11e-support.md for the investigation notes.

/** Relic pools are further split by tier; matches BSData's own subgroup names exactly. */
const CRUSADE_RELIC_TIERS: readonly CrusadeRelicTier[] = ["Antiquity", "Legendary", "Artificer"];

/**
 * Recursively collect every selectionEntryGroup (at any nesting depth, not
 * following entryLinks) under `roots` whose own name matches `pattern`.
 * Used to find campaign-specific Battle Trait/Crusade Relic pools without
 * assuming a fixed nesting depth (see comment above).
 */
function collectGroupsMatching(roots: any[], pattern: RegExp): any[] {
  const results: any[] = [];
  function walk(node: any): void {
    const name: string = node["@_name"] ?? "";
    if (pattern.test(name)) results.push(node);
    for (const child of ensureArray(node.selectionEntryGroups?.selectionEntryGroup)) {
      walk(child);
    }
  }
  roots.forEach(walk);
  return results;
}

/** Build CrusadeHonour records from a flat list of selectionEntry nodes. */
function honoursFromEntries(
  entries: any[],
  category: CrusadeHonourCategory,
  scope: CrusadeHonourScope,
  faction: string | null,
  campaign: string | null,
  relicTier: CrusadeRelicTier | null,
): CrusadeHonour[] {
  const out: CrusadeHonour[] = [];
  for (const entry of entries) {
    if (entry["@_hidden"] === "true") continue;
    const description = extractEnhancementDescription(entry);
    if (!description) continue;
    out.push({
      id: entry["@_id"],
      name: entry["@_name"],
      description,
      category,
      scope,
      faction,
      campaign,
      relicTier,
      gameSystem: "wh40k-11e" as const,
    });
  }
  return out;
}

/** Extract a relic pool's entries, splitting by its Antiquity/Legendary/Artificer tier subgroups. */
function honoursFromRelicPool(
  relicGroup: any,
  scope: CrusadeHonourScope,
  faction: string | null,
  campaign: string | null,
): CrusadeHonour[] {
  const out: CrusadeHonour[] = [];
  const tierGroups = ensureArray(relicGroup.selectionEntryGroups?.selectionEntryGroup);
  for (const tierGroup of tierGroups) {
    const tierName: string = tierGroup["@_name"] ?? "";
    const tier = CRUSADE_RELIC_TIERS.find((t) => tierName.startsWith(t)) ?? null;
    const entries = ensureArray(tierGroup.selectionEntries?.selectionEntry);
    out.push(...honoursFromEntries(entries, "relic", scope, faction, campaign, tier));
  }
  return out;
}

/**
 * Extract the generic (universal Battle Scars) and campaign-specific
 * (Battle Traits + Crusade Relics per campaign) Crusade Honours from the
 * game system file. Called once per game system, not per catalogue.
 */
export function parseGenericCrusadeHonours(gameSystemNode: any): CrusadeHonour[] {
  const honours: CrusadeHonour[] = [];
  const roots = ensureArray(gameSystemNode.sharedSelectionEntryGroups?.selectionEntryGroup);

  // Generic: Main Rules Battle Scars — universal, no faction/campaign gating.
  const battleScarGroups = collectGroupsMatching(roots, /^Main Rules Battle Scars$/i);
  for (const group of battleScarGroups) {
    const entries = ensureArray(group.selectionEntries?.selectionEntry);
    honours.push(...honoursFromEntries(entries, "battleScar", "generic", null, null, null));
  }

  // Campaign: "<Campaign> Battle Traits" (excludes the bare "Battle Traits"
  // wrapper and faction-specific "Codex Battle Traits", neither of which
  // matches the required "<something> Battle Traits" prefix pattern).
  const campaignTraitGroups = collectGroupsMatching(roots, /^(.+) Battle Traits$/i);
  for (const group of campaignTraitGroups) {
    const name: string = group["@_name"] ?? "";
    const campaign = name.replace(/\s*Battle Traits\s*$/i, "").trim();
    const entries = ensureArray(group.selectionEntries?.selectionEntry);
    honours.push(...honoursFromEntries(entries, "battleTrait", "campaign", null, campaign, null));
  }

  // Campaign: "<Campaign> Crusade Relics" (excludes faction-specific "Codex Crusade Relics").
  const campaignRelicGroups = collectGroupsMatching(roots, /^(.+) Crusade Relics$/i);
  for (const group of campaignRelicGroups) {
    const name: string = group["@_name"] ?? "";
    const campaign = name.replace(/\s*Crusade Relics\s*$/i, "").trim();
    honours.push(...honoursFromRelicPool(group, "campaign", null, campaign));
  }

  return honours;
}

/**
 * Extract a catalogue's own faction-specific Crusade Honours: its Codex
 * Battle Traits, Codex Crusade Relics, and any Boon-style table (e.g.
 * Chaos Boons). Only considers the catalogue's own top-level shared groups
 * tagged `comment: "Crusade content"` — BSData's own marker for this
 * content, which avoids hardcoding "Codex" as if every faction used that
 * exact wording.
 */
export function parseFactionCrusadeHonours(catNode: any, faction: string): CrusadeHonour[] {
  const honours: CrusadeHonour[] = [];
  const groups = ensureArray(catNode.sharedSelectionEntryGroups?.selectionEntryGroup);

  for (const group of groups) {
    if (group.comment !== "Crusade content") continue;
    const name: string = group["@_name"] ?? "";

    if (/Battle Traits$/i.test(name)) {
      const entries = ensureArray(group.selectionEntries?.selectionEntry);
      honours.push(...honoursFromEntries(entries, "battleTrait", "faction", faction, null, null));
    } else if (/Crusade Relics$/i.test(name)) {
      honours.push(...honoursFromRelicPool(group, "faction", faction, null));
    } else if (/Boons?$/i.test(name)) {
      const entries = ensureArray(group.selectionEntries?.selectionEntry);
      honours.push(...honoursFromEntries(entries, "boon", "faction", faction, null, null));
    }
  }

  return honours;
}
