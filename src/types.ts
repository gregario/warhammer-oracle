// === Game Modes ===

export type GameMode = "40k" | "combat_patrol" | "kill_team";

export type GameSystem = "wh40k-10e" | "wh40k-killteam";

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
