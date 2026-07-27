import { describe, it, expect } from "vitest";
import { UNITS } from "../src/data/units.js";
import { UNITS_11E } from "../src/data/units-11e.js";
import { DETACHMENTS } from "../src/data/detachments.js";
import { DETACHMENTS_11E } from "../src/data/detachments-11e.js";
import { ENHANCEMENTS_11E } from "../src/data/enhancements-11e.js";
import { SHARED_RULES } from "../src/data/rules.js";
import { SHARED_RULES_11E } from "../src/data/rules-11e.js";
import { STRATAGEMS } from "../src/data/stratagems.js";

describe("UNITS data integrity", () => {
  it("has entries from multiple factions (>10)", () => {
    const factions = new Set(UNITS.map((u) => u.faction));
    expect(factions.size).toBeGreaterThan(10);
  });

  it("has a substantial number of units", () => {
    expect(UNITS.length).toBeGreaterThan(500);
  });

  it("every unit has name and faction", () => {
    for (const unit of UNITS) {
      expect(unit.name).toBeTruthy();
      expect(unit.faction).toBeTruthy();
    }
  });

  it("every unit has a valid id", () => {
    for (const unit of UNITS) {
      expect(unit.id).toBeTruthy();
      expect(typeof unit.id).toBe("string");
    }
  });

  it("every unit has gameSystem set to wh40k-10e", () => {
    for (const unit of UNITS) {
      expect(unit.gameSystem).toBe("wh40k-10e");
    }
  });

  it("most units have at least one profile", () => {
    const withProfiles = UNITS.filter((u) => u.profiles.length > 0);
    const ratio = withProfiles.length / UNITS.length;
    // At least 60% of units should have profiles
    expect(ratio).toBeGreaterThan(0.6);
  });

  it("some units have points costs", () => {
    const withPoints = UNITS.filter((u) => u.points !== null && u.points > 0);
    expect(withPoints.length).toBeGreaterThan(0);
  });

  it("some units have ranged weapons", () => {
    const withRanged = UNITS.filter((u) => u.rangedWeapons.length > 0);
    expect(withRanged.length).toBeGreaterThan(50);
  });

  it("some units have melee weapons", () => {
    const withMelee = UNITS.filter((u) => u.meleeWeapons.length > 0);
    expect(withMelee.length).toBeGreaterThan(50);
  });

  it("some units have abilities", () => {
    const withAbilities = UNITS.filter((u) => u.abilities.length > 0);
    expect(withAbilities.length).toBeGreaterThan(50);
  });

  it("includes well-known factions", () => {
    const factions = new Set(UNITS.map((u) => u.faction));
    // Catalogue names use BSData conventions (may include sub-faction prefixes)
    expect(factions.has("Necrons")).toBe(true);
    expect(factions.has("Orks")).toBe(true);
    expect(factions.has("Chaos Space Marines")).toBe(true);
  });

  it("includes well-known units", () => {
    const names = new Set(UNITS.map((u) => u.name));
    // These are iconic units that should be present
    expect(names.has("Necron Warriors")).toBe(true);
  });

  it("no duplicate unit ids within same faction", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const unit of UNITS) {
      const key = `${unit.faction}::${unit.id}`;
      if (seen.has(key)) {
        dupes.push(`${unit.faction} / ${unit.name} (${unit.id})`);
      }
      seen.add(key);
    }
    expect(dupes).toEqual([]);
  });

  it("every unit has a structurally valid unitSize (min >= 1, max >= min)", () => {
    for (const unit of UNITS) {
      expect(unit.unitSize.min, `${unit.faction} / ${unit.name}`).toBeGreaterThanOrEqual(1);
      expect(unit.unitSize.max, `${unit.faction} / ${unit.name}`).toBeGreaterThanOrEqual(unit.unitSize.min);
    }
  });

  it("Obliterators are a fixed 2-model unit (regression check for the bug that motivated unitSize)", () => {
    const oblits = UNITS.filter((u) => u.name === "Obliterators");
    expect(oblits.length).toBeGreaterThan(0);
    for (const u of oblits) {
      expect(u.unitSize).toEqual({ min: 2, max: 2 });
    }
  });

  it("Obliterators and Warp Talons have weapons (regression check for the deep-nesting weapon-extraction bug)", () => {
    for (const name of ["Obliterators", "Warp Talons"]) {
      const units = UNITS.filter((u) => u.name === name);
      expect(units.length, name).toBeGreaterThan(0);
      for (const u of units) {
        expect(u.rangedWeapons.length + u.meleeWeapons.length, `${name} (${u.faction})`).toBeGreaterThan(0);
      }
    }
  });

  it("fewer than 30 units have zero weapons (regression check — was 148 before the deep-nesting fix, is now ~15 legitimately unarmed units: terrain, transports, mines)", () => {
    const zeroWeapons = UNITS.filter((u) => u.rangedWeapons.length === 0 && u.meleeWeapons.length === 0);
    expect(zeroWeapons.length).toBeLessThan(30);
  });

  it("no unit has a runaway profile count from over-following a shared entryLink pool (regression check for the ~397-ability blowup bug)", () => {
    for (const unit of UNITS) {
      expect(unit.abilities.length, `${unit.faction} / ${unit.name}`).toBeLessThan(100);
    }
  });
});

describe("UNITS_11E data integrity", () => {
  it("has entries from multiple factions (>10)", () => {
    const factions = new Set(UNITS_11E.map((u) => u.faction));
    expect(factions.size).toBeGreaterThan(10);
  });

  it("has a substantial number of units", () => {
    expect(UNITS_11E.length).toBeGreaterThan(500);
  });

  it("every unit has name and faction", () => {
    for (const unit of UNITS_11E) {
      expect(unit.name).toBeTruthy();
      expect(unit.faction).toBeTruthy();
    }
  });

  it("every unit has gameSystem set to wh40k-11e", () => {
    for (const unit of UNITS_11E) {
      expect(unit.gameSystem).toBe("wh40k-11e");
    }
  });

  it("most units have at least one profile", () => {
    const withProfiles = UNITS_11E.filter((u) => u.profiles.length > 0);
    const ratio = withProfiles.length / UNITS_11E.length;
    expect(ratio).toBeGreaterThan(0.6);
  });

  it("units have populated save characteristics (regression check for 11e's 'Sv' naming)", () => {
    const withSave = UNITS_11E.filter((u) =>
      u.profiles.some((p) => p.save.trim() !== ""),
    );
    const ratio = withSave.length / UNITS_11E.length;
    expect(ratio).toBeGreaterThan(0.6);
  });

  it("some units have ranged weapons, melee weapons, and abilities", () => {
    expect(UNITS_11E.filter((u) => u.rangedWeapons.length > 0).length).toBeGreaterThan(50);
    expect(UNITS_11E.filter((u) => u.meleeWeapons.length > 0).length).toBeGreaterThan(50);
    expect(UNITS_11E.filter((u) => u.abilities.length > 0).length).toBeGreaterThan(50);
  });

  it("includes well-known factions and units", () => {
    const factions = new Set(UNITS_11E.map((u) => u.faction));
    expect(factions.has("Necrons")).toBe(true);
    expect(factions.has("Orks")).toBe(true);
    expect(factions.has("Chaos Space Marines")).toBe(true);

    const names = new Set(UNITS_11E.map((u) => u.name));
    expect(names.has("Necron Warriors")).toBe(true);
  });

  it("no duplicate unit ids within same faction", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const unit of UNITS_11E) {
      const key = `${unit.faction}::${unit.id}`;
      if (seen.has(key)) {
        dupes.push(`${unit.faction} / ${unit.name} (${unit.id})`);
      }
      seen.add(key);
    }
    expect(dupes).toEqual([]);
  });

  it("every unit has a structurally valid unitSize (min >= 1, max >= min)", () => {
    for (const unit of UNITS_11E) {
      expect(unit.unitSize.min, `${unit.faction} / ${unit.name}`).toBeGreaterThanOrEqual(1);
      expect(unit.unitSize.max, `${unit.faction} / ${unit.name}`).toBeGreaterThanOrEqual(unit.unitSize.min);
    }
  });

  it("Obliterators are a fixed 2-model unit (regression check for the bug that motivated unitSize)", () => {
    const oblits = UNITS_11E.filter((u) => u.name === "Obliterators");
    expect(oblits.length).toBeGreaterThan(0);
    for (const u of oblits) {
      expect(u.unitSize).toEqual({ min: 2, max: 2 });
    }
  });

  it("matches known unit sizes verified against Wahapedia (Khorne Berzerkers 10-20, Noise Marines fixed 6)", () => {
    const berzerkers = UNITS_11E.filter((u) => u.name === "Khorne Berzerkers");
    expect(berzerkers.length).toBeGreaterThan(0);
    for (const u of berzerkers) expect(u.unitSize).toEqual({ min: 10, max: 20 });

    const noiseMarines = UNITS_11E.filter((u) => u.name === "Noise Marines");
    expect(noiseMarines.length).toBeGreaterThan(0);
    for (const u of noiseMarines) expect(u.unitSize).toEqual({ min: 6, max: 6 });
  });

  it("Obliterators and Warp Talons have weapons (regression check for the deep-nesting weapon-extraction bug)", () => {
    for (const name of ["Obliterators", "Warp Talons"]) {
      const units = UNITS_11E.filter((u) => u.name === name);
      expect(units.length, name).toBeGreaterThan(0);
      for (const u of units) {
        expect(u.rangedWeapons.length + u.meleeWeapons.length, `${name} (${u.faction})`).toBeGreaterThan(0);
      }
    }
  });

  it("Bloodletters, Ravenwing Command Squad, and Cadian Shock Troops have weapons (regression check for the entryLink weapon-reference gap)", () => {
    for (const name of ["Bloodletters", "Ravenwing Command Squad", "Cadian Shock Troops"]) {
      const units = UNITS_11E.filter((u) => u.name === name);
      expect(units.length, name).toBeGreaterThan(0);
      for (const u of units) {
        expect(u.rangedWeapons.length + u.meleeWeapons.length, `${name} (${u.faction})`).toBeGreaterThan(0);
      }
    }
  });

  it("fewer than 30 units have zero weapons (regression check — was 533 mid-fix before the entryLink denylist, is now ~15 legitimately unarmed units: terrain, transports, mines)", () => {
    const zeroWeapons = UNITS_11E.filter((u) => u.rangedWeapons.length === 0 && u.meleeWeapons.length === 0);
    expect(zeroWeapons.length).toBeLessThan(30);
  });

  it("no unit has a runaway profile count from over-following a shared entryLink pool (regression check for the ~397-ability blowup bug)", () => {
    for (const unit of UNITS_11E) {
      expect(unit.abilities.length, `${unit.faction} / ${unit.name}`).toBeLessThan(100);
    }
  });

  it("Chaos Space Marines vehicles/named characters carry the Heretic Astartes keyword (regression check for the 'Faction: X' categoryLink being dropped entirely instead of just un-prefixed)", () => {
    for (const name of ["Chaos Predator Annihilator", "Chaos Predator Destructor", "Defiler", "Helbrute", "Chosen"]) {
      const units = UNITS_11E.filter((u) => u.name === name && u.faction === "Chaos Space Marines");
      expect(units.length, name).toBeGreaterThan(0);
      for (const u of units) {
        expect(u.keywords, `${name} (${u.faction})`).toContain("Heretic Astartes");
      }
    }
  });

  it("most Chaos Space Marines units carry Heretic Astartes (Daemon-ally exceptions like Nurglings/Bloodletters legitimately don't)", () => {
    const csm = UNITS_11E.filter((u) => u.faction === "Chaos Space Marines");
    const withKeyword = csm.filter((u) => u.keywords.includes("Heretic Astartes"));
    expect(withKeyword.length / csm.length).toBeGreaterThan(0.7);
  });

  it("units generally carry their catalogue's army-wide keyword, not just faction-string metadata (Space Marines / Adeptus Astartes, Necrons / Necrons)", () => {
    const marines = UNITS_11E.filter((u) => u.faction === "Adeptus Astartes - Space Marines");
    expect(marines.length).toBeGreaterThan(0);
    const marinesWithKeyword = marines.filter((u) => u.keywords.includes("Adeptus Astartes"));
    expect(marinesWithKeyword.length / marines.length).toBeGreaterThan(0.5);

    const necrons = UNITS_11E.filter((u) => u.faction === "Necrons");
    expect(necrons.length).toBeGreaterThan(0);
    const necronsWithKeyword = necrons.filter((u) => u.keywords.includes("Necrons"));
    expect(necronsWithKeyword.length / necrons.length).toBeGreaterThan(0.5);
  });

  it("no unit has a suspiciously sparse keyword list (regression check for two bugs: phantom per-model wargear-loadout entries, and named-character units whose real keywords lived on an unmerged nested model child)", () => {
    const sparse = UNITS_11E.filter(
      (u) => u.keywords.length <= 2 && !u.keywords.some((k) => k.toLowerCase() === u.name.toLowerCase()),
    );
    expect(sparse.map((u) => `${u.faction} / ${u.name}`)).toEqual([]);
  });

  it("per-model wargear-loadout variants (Wolf Scout w/ plasma gun, Burna Boy, Sister Novitiate, ...) don't appear as their own phantom top-level units — only the real squad they belong to does", () => {
    const phantomNames = [
      "Wolf Scout", "Wolf Scout w/ plasma gun", "Wolf Scout w/ haywire mine",
      "Wolf Scout w/ runic stave and Thunderclap", "Wolf Scout Pack Leader",
      "Burna Boy", "Spanner", "Loota", "Runtherd", "Squighog Boy", "Nob on Smasha Squig",
      "Cyber-mastiff", "Jakhal", "Geminae Superia",
    ];
    for (const name of phantomNames) {
      expect(UNITS_11E.some((u) => u.name === name), name).toBe(false);
    }

    // The real squads they belong to must still be present and fully tagged.
    for (const name of ["Wolf Scouts", "Burna Boyz"]) {
      const units = UNITS_11E.filter((u) => u.name === name);
      expect(units.length, name).toBeGreaterThan(0);
      for (const u of units) expect(u.keywords.length, `${name} (${u.faction})`).toBeGreaterThan(2);
    }
  });

  it("named-character units built as a thin wrapper around one or more nested model children (Fabius Bile, Traitor Enforcer) inherit the real keyword set from those children", () => {
    for (const name of ["Fabius Bile", "Traitor Enforcer"]) {
      const units = UNITS_11E.filter((u) => u.name === name);
      expect(units.length, name).toBeGreaterThan(0);
      for (const u of units) {
        expect(u.keywords.length, `${name} (${u.faction})`).toBeGreaterThan(2);
        expect(u.keywords, `${name} (${u.faction})`).toContain("Chaos");
      }
    }
  });

  it("no unit has an implausibly large keyword list (regression check against a merge-logic runaway)", () => {
    for (const unit of UNITS_11E) {
      expect(unit.keywords.length, `${unit.faction} / ${unit.name}`).toBeLessThan(20);
    }
  });

  it("no unit has duplicate keywords", () => {
    const dupes: string[] = [];
    for (const unit of UNITS_11E) {
      if (new Set(unit.keywords).size !== unit.keywords.length) {
        dupes.push(`${unit.faction} / ${unit.name}`);
      }
    }
    expect(dupes).toEqual([]);
  });
});

describe("DETACHMENTS_11E / ENHANCEMENTS_11E data integrity", () => {
  it("has a substantial number of detachments and enhancements", () => {
    expect(DETACHMENTS_11E.length).toBeGreaterThan(100);
    expect(ENHANCEMENTS_11E.length).toBeGreaterThan(100);
  });

  it("every detachment has gameSystem set to wh40k-11e and a named ability", () => {
    for (const det of DETACHMENTS_11E) {
      expect(det.gameSystem).toBe("wh40k-11e");
      expect(det.ability.name).toBeTruthy();
    }
  });

  it("every enhancement has gameSystem set to wh40k-11e", () => {
    for (const enh of ENHANCEMENTS_11E) {
      expect(enh.gameSystem).toBe("wh40k-11e");
    }
  });

  it("most 11e detachments carry a Detachment Points value (1-3) and at least one Force Disposition", () => {
    const withPoints = DETACHMENTS_11E.filter((d) => d.detachmentPoints !== null);
    expect(withPoints.length / DETACHMENTS_11E.length).toBeGreaterThan(0.8);
    for (const det of withPoints) {
      expect(det.detachmentPoints, det.name).toBeGreaterThanOrEqual(1);
      expect(det.detachmentPoints, det.name).toBeLessThanOrEqual(3);
      expect(det.dispositions.length, det.name).toBeGreaterThan(0);
    }

    // Detachments with no Detachment Points are specifically the Boarding
    // Actions-only ones (a separate ruleset with no DP/Disposition system),
    // not a data gap — confirmed for a couple of known examples.
    const boardingActionsOnly = DETACHMENTS_11E.filter((d) => d.detachmentPoints === null);
    expect(boardingActionsOnly.some((d) => d.name === "Tyranid Attack")).toBe(true);
  });

  it("only known Force Disposition values appear on detachments (decorative BSData tags like '3DP Detachment'/'Doomed'/'Grace'/'Nightmare' are filtered out)", () => {
    const known = new Set(["Take and Hold", "Purge the Foe", "Reconnaissance", "Priority Assets", "Disruption"]);
    for (const det of DETACHMENTS_11E) {
      for (const d of det.dispositions) {
        expect(known.has(d), `${det.name}: ${d}`).toBe(true);
      }
    }
  });

  it("10th Edition detachments never have Detachment Points or dispositions (the concept didn't exist before 11e)", () => {
    for (const det of DETACHMENTS) {
      expect(det.detachmentPoints, det.name).toBeNull();
      expect(det.dispositions, det.name).toEqual([]);
    }
  });
});

describe("SHARED_RULES_11E data integrity", () => {
  it("has rules entries", () => {
    expect(SHARED_RULES_11E.length).toBeGreaterThan(10);
  });

  it("every rule has name and description", () => {
    for (const rule of SHARED_RULES_11E) {
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
    }
  });

  it("includes common weapon keywords", () => {
    const names = new Set(SHARED_RULES_11E.map((r) => r.name));
    expect(names.has("Devastating Wounds")).toBe(true);
    expect(names.has("Lethal Hits")).toBe(true);
  });
});

describe("SHARED_RULES data integrity", () => {
  it("has rules entries", () => {
    expect(SHARED_RULES.length).toBeGreaterThan(10);
  });

  it("every rule has name and description", () => {
    for (const rule of SHARED_RULES) {
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
    }
  });

  it("includes common weapon keywords", () => {
    const names = new Set(SHARED_RULES.map((r) => r.name));
    expect(names.has("Devastating Wounds")).toBe(true);
    expect(names.has("Lethal Hits")).toBe(true);
  });

  it("includes weapon type rules", () => {
    const names = new Set(SHARED_RULES.map((r) => r.name));
    expect(names.has("Pistol")).toBe(true);
    expect(names.has("Hazardous")).toBe(true);
  });

  it("rule descriptions are non-trivial", () => {
    for (const rule of SHARED_RULES) {
      expect(rule.description.length).toBeGreaterThan(20);
    }
  });
});

describe("STRATAGEMS data integrity", () => {
  const VALID_TYPES = new Set(["battle_tactic", "epic_deed", "strategic_ploy", "wargear", "core"]);

  it("has a substantial number of stratagems", () => {
    expect(STRATAGEMS.length).toBeGreaterThan(400);
  });

  it("every stratagem has non-empty name, faction, phase, when, target, and effect", () => {
    for (const strat of STRATAGEMS) {
      expect(strat.name).toBeTruthy();
      expect(strat.faction).toBeTruthy();
      expect(strat.phase).toBeTruthy();
      expect(strat.when).toBeTruthy();
      expect(strat.target).toBeTruthy();
      expect(strat.effect).toBeTruthy();
    }
  });

  it("every stratagem has a valid type", () => {
    for (const strat of STRATAGEMS) {
      expect(VALID_TYPES.has(strat.type)).toBe(true);
    }
  });

  it("every stratagem has a non-negative CP cost", () => {
    for (const strat of STRATAGEMS) {
      expect(typeof strat.cpCost).toBe("number");
      expect(strat.cpCost).toBeGreaterThanOrEqual(0);
    }
  });

  it("every stratagem has a non-empty gameModes list including 40k", () => {
    for (const strat of STRATAGEMS) {
      expect(strat.gameModes.length).toBeGreaterThan(0);
      expect(strat.gameModes).toContain("40k");
    }
  });

  it("Core Stratagems have no detachment, faction 'Core', and type 'core'", () => {
    const core = STRATAGEMS.filter((s) => s.type === "core");
    expect(core.length).toBeGreaterThan(0);
    for (const strat of core) {
      expect(strat.faction).toBe("Core");
      expect(strat.detachment).toBeNull();
    }
  });

  it("detachment-specific stratagems never use type 'core'", () => {
    for (const strat of STRATAGEMS) {
      if (strat.detachment !== null) {
        expect(strat.type).not.toBe("core");
      }
    }
  });

  it("no duplicate (faction, detachment, name) combos", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const strat of STRATAGEMS) {
      const key = `${strat.faction}::${strat.detachment}::${strat.name}`;
      if (seen.has(key)) {
        dupes.push(`${strat.faction} / ${strat.detachment} / ${strat.name}`);
      }
      seen.add(key);
    }
    expect(dupes).toEqual([]);
  });

  it("includes stratagems from every hand-curated faction covered so far", () => {
    const factions = new Set(STRATAGEMS.map((s) => s.faction));
    expect(factions.has("Core")).toBe(true);
    expect(factions.has("Adeptus Astartes")).toBe(true);
    expect(factions.has("Heretic Astartes")).toBe(true);
    expect(factions.has("Legiones Daemonica")).toBe(true);
    expect(factions.has("Chaos Knights")).toBe(true);
    expect(factions.has("Death Guard")).toBe(true);
    expect(factions.has("Emperor's Children")).toBe(true);
    expect(factions.has("Thousand Sons")).toBe(true);
    expect(factions.has("World Eaters")).toBe(true);
    expect(factions.has("T'au Empire")).toBe(true);
  });

  it("every non-Core stratagem has a non-null detachment", () => {
    for (const strat of STRATAGEMS) {
      if (strat.faction !== "Core") {
        expect(strat.detachment).not.toBeNull();
      }
    }
  });
});
