// === Game Modes ===

export type GameMode = "40k" | "40k_10e" | "40k_11e" | "combat_patrol" | "kill_team";

export type GameSystem = "wh40k-10e" | "wh40k-11e" | "wh40k-killteam";

// === Unit Data (from BSData .cat files) ===

export type UnitProfile = {
  name: string;
  movement: string;
  toughness: string;
  save: string;
  wounds: string;
  leadership: string;
  objectiveControl: string;
};

export type KillTeamOperativeProfile = {
  name: string;
  apl: string;
  movement: string;
  save: string;
  wounds: string;
};

export type RangedWeapon = {
  name: string;
  range: string;
  attacks: string;
  ballisticSkill: string;
  strength: string;
  armourPenetration: string;
  damage: string;
  keywords: string[];
};

export type MeleeWeapon = {
  name: string;
  range: string;
  attacks: string;
  weaponSkill: string;
  strength: string;
  armourPenetration: string;
  damage: string;
  keywords: string[];
};

export type KillTeamWeapon = {
  name: string;
  attacks: string;
  hit: string;
  damage: string;
  weaponRules: string;
  type: "ranged" | "melee";
};

export type Ability = {
  name: string;
  description: string;
};

export type UnitSize = {
  min: number;
  max: number;
};

export type Unit = {
  id: string;
  name: string;
  faction: string;
  keywords: string[];
  profiles: UnitProfile[];
  rangedWeapons: RangedWeapon[];
  meleeWeapons: MeleeWeapon[];
  abilities: Ability[];
  points: number | null;
  unitSize: UnitSize;
  gameSystem: GameSystem;
};

export type KillTeamOperative = {
  id: string;
  name: string;
  faction: string;
  keywords: string[];
  profile: KillTeamOperativeProfile;
  weapons: KillTeamWeapon[];
  abilities: Ability[];
  uniqueActions: Ability[];
  gameSystem: GameSystem;
};

// === Rules Content (hand-curated) ===

export type KeywordDefinition = {
  name: string;
  description: string;
  plainEnglish: string;
  gameModes: GameMode[];
  examples?: string[];
};

export type Phase = {
  name: string;
  order: number;
  steps: string[];
  tips: string[];
  gameMode: GameMode;
};

export type TurnSequence = {
  gameMode: GameMode;
  phases: Phase[];
};

// === Detachments & Enhancements (from BSData) ===

export type Detachment = {
  id: string;
  name: string;
  faction: string;
  ability: { name: string; description: string };
  /** 1-3, from BSData's "Detachment Points" cost. 11th Edition only — always null for 10e data. */
  detachmentPoints: number | null;
  /** Which Force Disposition(s) this detachment can select when mustering. 11th Edition only — always [] for 10e data. */
  dispositions: Disposition[];
  /**
   * Mutual-exclusion tag(s) from BSData (e.g. "Nightmare", "Doomed", "Grace",
   * "Covens"). Detachments sharing any tag in this list cannot both be used
   * in the same army — e.g. Chaos Space Marines' Murdertalon Raiders and
   * Nightmare Hunt both carry "Nightmare" and are mutually exclusive. 11th
   * Edition only — always [] for 10e data. Usually empty; most detachments
   * have no such restriction.
   */
  restrictionTags: string[];
  gameSystem: GameSystem;
};

export type Enhancement = {
  id: string;
  name: string;
  faction: string;
  detachment: string;
  description: string;
  points: number | null;
  gameSystem: GameSystem;
};

// === Crusade Honours (from BSData) ===
//
// Crusade Battle Traits, Crusade Relics, and Battle Scars are deliberately
// NOT merged into Unit.abilities — every named character across every
// faction shares the same handful of Crusade-only ability pools (see
// UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN in fetch-data.ts), so duplicating
// them onto each unit would bloat the dataset without adding unit-specific
// signal. This is a separate, queryable data domain instead. 11th Edition
// only (BSData/wh40k-10e's XML schema wasn't investigated for this content;
// scope matched to the DetachmentPoints/Disposition precedent).

/** Where a Crusade Honour comes from: the universal rulebook pool, a
 * faction's own codex-specific pool, or a campaign supplement's pool. */
export type CrusadeHonourScope = "generic" | "faction" | "campaign";

export type CrusadeHonourCategory = "battleTrait" | "relic" | "battleScar" | "boon";

/** Crusade Relics are tiered by rarity/power; only present when category === "relic". */
export type CrusadeRelicTier = "Antiquity" | "Legendary" | "Artificer";

export type CrusadeHonour = {
  id: string;
  name: string;
  description: string;
  category: CrusadeHonourCategory;
  scope: CrusadeHonourScope;
  /** Set when scope === "faction" (e.g. "Chaos Space Marines"). */
  faction: string | null;
  /** Set when scope === "campaign" (e.g. "Tyrannic War", "Armageddon"). */
  campaign: string | null;
  relicTier: CrusadeRelicTier | null;
  gameSystem: GameSystem;
};

// === Stratagems (hand-curated) ===

export type Stratagem = {
  name: string;
  faction: string;
  detachment: string | null;
  type: "battle_tactic" | "epic_deed" | "strategic_ploy" | "wargear" | "core";
  cpCost: number;
  phase: string;
  when: string;
  target: string;
  effect: string;
  restrictions?: string;
  gameModes: GameMode[];
};

// === Force Dispositions & Mission Matchups (hand-curated) ===

export type Disposition =
  | "Take and Hold"
  | "Purge the Foe"
  | "Reconnaissance"
  | "Priority Assets"
  | "Disruption";

export type MissionMatchup = {
  dispositionA: Disposition;
  dispositionB: Disposition;
  missionA: string;
  missionB: string;
};

// === Kill Team Ploys (hand-curated) ===

export type Ploy = {
  name: string;
  faction: string;
  type: "strategic" | "tactical";
  cpCost: number;
  when: string;
  effect: string;
  restrictions?: string;
  gameMode: "kill_team";
};
