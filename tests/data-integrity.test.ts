import { describe, it, expect } from "vitest";
import { UNITS } from "../src/data/units.js";
import { SHARED_RULES } from "../src/data/rules.js";

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
