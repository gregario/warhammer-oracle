import type { Disposition, MissionMatchup } from "../types.js";

// === Force Dispositions & Mission Matchups (11th Edition Matched Play) ===
//
// When mustering an army, a player selects one Force Disposition. To determine
// each player's Primary Mission, each player finds their OPPONENT's Force
// Disposition and reads off the mission listed for that pairing — in a
// non-mirror matchup, the two players get different Primary Missions.
//
// Sourcing: the mechanic itself, and 7 of the 15 unique pairings below
// (every pairing involving "Take and Hold", "Purge the Foe", and
// "Disruption"), are verified directly from Games Workshop's free
// "Warhammer Event Companion" PDF, which documents a curated subset of the
// full Chapter Approved Mission Deck for streamlined event play. The
// remaining 8 pairings (anything involving "Reconnaissance" or "Priority
// Assets" against something other than "Take and Hold") are sourced from
// game-datamissions.com, a fan-maintained compilation — cross-checked
// cell-by-cell against the 7 GW-verified pairings with a 100% match before
// being trusted. Note: this project does not have, and does not include,
// each Primary Mission's actual scoring/VP text — only its name. Full
// mission text isn't freely published by GW or (as far as could be
// determined) reproduced in full by any fan site either; it lives in the
// physical/paid Chapter Approved Mission Deck or the Warhammer 40,000 App.
//
// Also not yet tracked: which Force Disposition(s) are available to a given
// detachment/army. Faction Packs convey this via an icon, not text, so it
// isn't recoverable from the plain-text extraction this project's stratagem
// curation otherwise relies on.

export const DISPOSITIONS: Disposition[] = [
  "Take and Hold",
  "Purge the Foe",
  "Reconnaissance",
  "Priority Assets",
  "Disruption",
];

export const MISSION_MATCHUPS: MissionMatchup[] = [
  // Verified directly from GW's free Warhammer Event Companion PDF.
  {
    dispositionA: "Take and Hold",
    dispositionB: "Take and Hold",
    missionA: "Battlefield Dominance",
    missionB: "Battlefield Dominance",
  },
  {
    dispositionA: "Take and Hold",
    dispositionB: "Purge the Foe",
    missionA: "Immovable Object",
    missionB: "Unstoppable Force",
  },
  {
    dispositionA: "Take and Hold",
    dispositionB: "Disruption",
    missionA: "Determined Acquisition",
    missionB: "Death Trap",
  },
  {
    dispositionA: "Take and Hold",
    dispositionB: "Priority Assets",
    missionA: "Inescapable Dominion",
    missionB: "Secure Asset",
  },
  {
    dispositionA: "Purge the Foe",
    dispositionB: "Purge the Foe",
    missionA: "Meatgrinder",
    missionB: "Meatgrinder",
  },
  {
    dispositionA: "Purge the Foe",
    dispositionB: "Disruption",
    missionA: "Punishment",
    missionB: "Delaying Action",
  },
  {
    dispositionA: "Disruption",
    dispositionB: "Disruption",
    missionA: "Outmanoeuvre",
    missionB: "Outmanoeuvre",
  },
  // Sourced from game-datamissions.com, cross-validated against the above.
  {
    dispositionA: "Take and Hold",
    dispositionB: "Reconnaissance",
    missionA: "Purge and Secure",
    missionB: "Reconnaissance Sweep",
  },
  {
    dispositionA: "Purge the Foe",
    dispositionB: "Reconnaissance",
    missionA: "Consecrate",
    missionB: "Triangulation",
  },
  {
    dispositionA: "Purge the Foe",
    dispositionB: "Priority Assets",
    missionA: "Destroyer's Wrath",
    missionB: "Vital Link",
  },
  {
    dispositionA: "Disruption",
    dispositionB: "Reconnaissance",
    missionA: "Smoke and Mirrors",
    missionB: "Surveil the Foe",
  },
  {
    dispositionA: "Disruption",
    dispositionB: "Priority Assets",
    missionA: "Locate and Deny",
    missionB: "Extract Relic",
  },
  {
    dispositionA: "Reconnaissance",
    dispositionB: "Reconnaissance",
    missionA: "Gather Intel",
    missionB: "Gather Intel",
  },
  {
    dispositionA: "Reconnaissance",
    dispositionB: "Priority Assets",
    missionA: "Search and Scour",
    missionB: "Vanguard Operation",
  },
  {
    dispositionA: "Priority Assets",
    dispositionB: "Priority Assets",
    missionA: "Sabotage",
    missionB: "Sabotage",
  },
];
