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
