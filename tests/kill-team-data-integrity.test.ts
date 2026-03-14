import { describe, it, expect } from "vitest";
import { KILL_TEAM_OPERATIVES } from "../src/data/kill-team-operatives.js";
import { KILL_TEAM_SHARED_RULES } from "../src/data/kill-team-rules.js";

describe("KILL_TEAM_OPERATIVES data integrity", () => {
  it("has entries from multiple factions (>10)", () => {
    const factions = new Set(KILL_TEAM_OPERATIVES.map((o) => o.faction));
    expect(factions.size).toBeGreaterThan(10);
  });

  it("has a substantial number of operatives", () => {
    expect(KILL_TEAM_OPERATIVES.length).toBeGreaterThan(200);
  });

  it("every operative has name and faction", () => {
    for (const op of KILL_TEAM_OPERATIVES) {
      expect(op.name).toBeTruthy();
      expect(op.faction).toBeTruthy();
    }
  });

  it("every operative has a valid id", () => {
    for (const op of KILL_TEAM_OPERATIVES) {
      expect(op.id).toBeTruthy();
      expect(typeof op.id).toBe("string");
    }
  });

  it("every operative has gameSystem set to wh40k-killteam", () => {
    for (const op of KILL_TEAM_OPERATIVES) {
      expect(op.gameSystem).toBe("wh40k-killteam");
    }
  });

  it("every operative has a profile with APL, Move, Save, Wounds", () => {
    for (const op of KILL_TEAM_OPERATIVES) {
      expect(op.profile).toBeDefined();
      expect(op.profile.apl).toBeTruthy();
      expect(op.profile.movement).toBeTruthy();
      expect(op.profile.save).toBeTruthy();
      expect(op.profile.wounds).toBeTruthy();
    }
  });

  it("most operatives have weapons", () => {
    const withWeapons = KILL_TEAM_OPERATIVES.filter((o) => o.weapons.length > 0);
    const ratio = withWeapons.length / KILL_TEAM_OPERATIVES.length;
    expect(ratio).toBeGreaterThan(0.8);
  });

  it("weapons have correct type (ranged or melee)", () => {
    for (const op of KILL_TEAM_OPERATIVES) {
      for (const w of op.weapons) {
        expect(["ranged", "melee"]).toContain(w.type);
      }
    }
  });

  it("weapon names do not contain prefix symbols", () => {
    for (const op of KILL_TEAM_OPERATIVES) {
      for (const w of op.weapons) {
        expect(w.name).not.toMatch(/^[\u2316\u2694]/);
      }
    }
  });

  it("some operatives have abilities", () => {
    const withAbilities = KILL_TEAM_OPERATIVES.filter((o) => o.abilities.length > 0);
    expect(withAbilities.length).toBeGreaterThan(50);
  });

  it("includes well-known factions", () => {
    const factions = new Set(KILL_TEAM_OPERATIVES.map((o) => o.faction));
    expect(factions.has("Angels of Death")).toBe(true);
    expect(factions.has("Kommandos")).toBe(true);
    expect(factions.has("Legionaries")).toBe(true);
  });

  it("includes well-known operatives", () => {
    const names = new Set(KILL_TEAM_OPERATIVES.map((o) => o.name));
    expect(names.has("Space Marine Captain")).toBe(true);
  });

  it("no duplicate operative ids within same faction", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const op of KILL_TEAM_OPERATIVES) {
      const key = `${op.faction}::${op.id}`;
      if (seen.has(key)) {
        dupes.push(`${op.faction} / ${op.name} (${op.id})`);
      }
      seen.add(key);
    }
    expect(dupes).toEqual([]);
  });
});

describe("KILL_TEAM_SHARED_RULES data integrity", () => {
  it("has rules entries", () => {
    expect(KILL_TEAM_SHARED_RULES.length).toBeGreaterThan(5);
  });

  it("every rule has name and description", () => {
    for (const rule of KILL_TEAM_SHARED_RULES) {
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
    }
  });

  it("includes common Kill Team weapon rules", () => {
    const names = new Set(KILL_TEAM_SHARED_RULES.map((r) => r.name));
    expect(names.has("Brutal")).toBe(true);
    expect(names.has("Lethal x+")).toBe(true);
  });

  it("rule descriptions are non-trivial", () => {
    for (const rule of KILL_TEAM_SHARED_RULES) {
      expect(rule.description.length).toBeGreaterThan(20);
    }
  });
});
