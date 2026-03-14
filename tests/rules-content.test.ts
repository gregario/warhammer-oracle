import { describe, it, expect } from "vitest";
import { KEYWORDS } from "../src/data/keywords.js";
import { TURN_SEQUENCES } from "../src/data/phases.js";
import type { KeywordDefinition, TurnSequence, GameMode } from "../src/types.js";

// === Keywords Tests ===

describe("KEYWORDS", () => {
  it("exports an array of KeywordDefinition objects", () => {
    expect(Array.isArray(KEYWORDS)).toBe(true);
    expect(KEYWORDS.length).toBeGreaterThanOrEqual(20);
    expect(KEYWORDS.length).toBeLessThanOrEqual(30);
  });

  it("has required weapon keywords", () => {
    const names = KEYWORDS.map((k) => k.name);
    const requiredWeaponKeywords = [
      "Devastating Wounds",
      "Lethal Hits",
      "Sustained Hits",
      "Anti-X",
      "Blast",
      "Heavy",
      "Rapid Fire",
      "Assault",
      "Pistol",
      "Torrent",
      "Twin-linked",
      "Melta",
      "Hazardous",
      "Precision",
      "Indirect Fire",
    ];
    for (const keyword of requiredWeaponKeywords) {
      expect(names).toContain(keyword);
    }
  });

  it("has required unit keywords", () => {
    const names = KEYWORDS.map((k) => k.name);
    const requiredUnitKeywords = [
      "Feel No Pain",
      "Lone Operative",
      "Stealth",
      "Scouts",
      "Deep Strike",
      "Deadly Demise",
      "Fights First",
      "Infiltrators",
      "Invulnerable Save",
      "Leader",
    ];
    for (const keyword of requiredUnitKeywords) {
      expect(names).toContain(keyword);
    }
  });

  it("every keyword has a plainEnglish explanation longer than 10 characters", () => {
    for (const keyword of KEYWORDS) {
      expect(keyword.plainEnglish.length).toBeGreaterThan(10);
    }
  });

  it("every keyword has a description", () => {
    for (const keyword of KEYWORDS) {
      expect(keyword.description.length).toBeGreaterThan(0);
    }
  });

  it("every keyword specifies at least one game mode", () => {
    const validModes: GameMode[] = ["40k", "combat_patrol", "kill_team"];
    for (const keyword of KEYWORDS) {
      expect(keyword.gameModes.length).toBeGreaterThanOrEqual(1);
      for (const mode of keyword.gameModes) {
        expect(validModes).toContain(mode);
      }
    }
  });

  it("plainEnglish is different from description (not just restating)", () => {
    for (const keyword of KEYWORDS) {
      expect(keyword.plainEnglish).not.toBe(keyword.description);
    }
  });

  it("has no duplicate keyword names", () => {
    const names = KEYWORDS.map((k) => k.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// === Turn Sequences Tests ===

describe("TURN_SEQUENCES", () => {
  it("exports an array with sequences for all three game modes", () => {
    expect(Array.isArray(TURN_SEQUENCES)).toBe(true);
    const modes = TURN_SEQUENCES.map((s) => s.gameMode);
    expect(modes).toContain("40k");
    expect(modes).toContain("combat_patrol");
    expect(modes).toContain("kill_team");
  });

  it("has exactly 3 sequences", () => {
    expect(TURN_SEQUENCES).toHaveLength(3);
  });

  describe("40k sequence", () => {
    it("has 5 phases in order: Command, Movement, Shooting, Charge, Fight", () => {
      const seq = TURN_SEQUENCES.find((s) => s.gameMode === "40k")!;
      expect(seq.phases).toHaveLength(5);

      const phaseNames = seq.phases.map((p) => p.name);
      expect(phaseNames).toEqual([
        "Command",
        "Movement",
        "Shooting",
        "Charge",
        "Fight",
      ]);
    });

    it("phases have sequential order numbers", () => {
      const seq = TURN_SEQUENCES.find((s) => s.gameMode === "40k")!;
      const orders = seq.phases.map((p) => p.order);
      expect(orders).toEqual([1, 2, 3, 4, 5]);
    });

    it("every phase has steps and tips", () => {
      const seq = TURN_SEQUENCES.find((s) => s.gameMode === "40k")!;
      for (const phase of seq.phases) {
        expect(phase.steps.length).toBeGreaterThanOrEqual(1);
        expect(phase.tips.length).toBeGreaterThanOrEqual(1);
        expect(phase.gameMode).toBe("40k");
      }
    });
  });

  describe("combat_patrol sequence", () => {
    it("has 5 phases matching 40k structure", () => {
      const seq = TURN_SEQUENCES.find((s) => s.gameMode === "combat_patrol")!;
      expect(seq.phases).toHaveLength(5);

      const phaseNames = seq.phases.map((p) => p.name);
      expect(phaseNames).toEqual([
        "Command",
        "Movement",
        "Shooting",
        "Charge",
        "Fight",
      ]);
    });

    it("every phase has steps and tips", () => {
      const seq = TURN_SEQUENCES.find(
        (s) => s.gameMode === "combat_patrol"
      )!;
      for (const phase of seq.phases) {
        expect(phase.steps.length).toBeGreaterThanOrEqual(1);
        expect(phase.tips.length).toBeGreaterThanOrEqual(1);
        expect(phase.gameMode).toBe("combat_patrol");
      }
    });
  });

  describe("kill_team sequence", () => {
    it("has phases for the Kill Team turn structure", () => {
      const seq = TURN_SEQUENCES.find((s) => s.gameMode === "kill_team")!;
      expect(seq.phases.length).toBeGreaterThanOrEqual(2);
    });

    it("every phase has steps and tips", () => {
      const seq = TURN_SEQUENCES.find((s) => s.gameMode === "kill_team")!;
      for (const phase of seq.phases) {
        expect(phase.steps.length).toBeGreaterThanOrEqual(1);
        expect(phase.tips.length).toBeGreaterThanOrEqual(1);
        expect(phase.gameMode).toBe("kill_team");
      }
    });

    it("phases have sequential order numbers", () => {
      const seq = TURN_SEQUENCES.find((s) => s.gameMode === "kill_team")!;
      const orders = seq.phases.map((p) => p.order);
      for (let i = 0; i < orders.length; i++) {
        expect(orders[i]).toBe(i + 1);
      }
    });
  });
});
