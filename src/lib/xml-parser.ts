import { XMLParser } from "fast-xml-parser";
import type {
  Unit,
  UnitProfile,
  RangedWeapon,
  MeleeWeapon,
  Ability,
} from "../types.js";

// === Profile type IDs from BattleScribe 40k 10th Edition ===
const UNIT_PROFILE_TYPE_ID = "c547-1836-d8a-ff4f";
const RANGED_WEAPON_TYPE_ID = "f77d-b953-8fa4-b762";
const MELEE_WEAPON_TYPE_ID = "8a40-4aaa-c780-9046";
const ABILITY_TYPE_ID = "9cc3-6d83-4dd3-9b64";
const POINTS_COST_TYPE_ID = "51b2-306e-1021-d207";

// Tags that may appear as single element or array
const ARRAY_TAGS = [
  "selectionEntry",
  "selectionEntryGroup",
  "profile",
  "characteristic",
  "cost",
  "categoryLink",
  "rule",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (_name: string, jpath: string) => {
    const tag = jpath.split(".").pop() ?? "";
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

// === Public API ===

export type GameSystemResult = {
  id: string;
  name: string;
  rules: { id: string; name: string; description: string }[];
};

export function parseGameSystem(xml: string): GameSystemResult {
  const parsed = parser.parse(xml);
  const gs = parsed.gameSystem;

  const rules = ensureArray(gs.rules?.rule).map((r: any) => ({
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

export function parseCatalogue(xml: string): Unit[] {
  const parsed = parser.parse(xml);
  const cat = parsed.catalogue;
  const faction = extractFaction(cat["@_name"]);

  const entries = ensureArray(cat.selectionEntries?.selectionEntry);

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
