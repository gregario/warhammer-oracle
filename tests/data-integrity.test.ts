import { describe, it, expect } from "vitest";
import { UNITS } from "../src/data/units.js";
import { UNITS_11E } from "../src/data/units-11e.js";
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
