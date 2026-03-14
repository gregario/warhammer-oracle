import { XMLParser } from "fast-xml-parser";
import type {
  Unit,
  UnitProfile,
  RangedWeapon,
  MeleeWeapon,
  Ability,
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

function getCharacteristic(
  characteristics: any[],
  name: string
): string {
  const char = characteristics.find(
    (c: any) => c["@_name"] === name
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

/** Collect all profiles from direct profiles, sub-entries, and entry groups */
function collectAllProfiles(entry: any): any[] {
  const directProfiles = ensureArray(entry.profiles?.profile);

  // Profiles from selectionEntries (sub-entries)
  const subEntries = ensureArray(entry.selectionEntries?.selectionEntry);
  const subProfiles = subEntries.flatMap((sub: any) =>
    ensureArray(sub.profiles?.profile)
  );

  // Profiles from selectionEntryGroups
  const groups = ensureArray(
    entry.selectionEntryGroups?.selectionEntryGroup
  );
  const groupProfiles = groups.flatMap((group: any) => {
    const groupEntries = ensureArray(
      group.selectionEntries?.selectionEntry
    );
    return groupEntries.flatMap((ge: any) =>
      ensureArray(ge.profiles?.profile)
    );
  });

  return [...directProfiles, ...subProfiles, ...groupProfiles];
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
    gameSystem: "wh40k-10e" as const,
  };
}

export { extractFaction, collectAllProfiles };

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
        gameSystem: "wh40k-10e" as const,
      };
    });
}
