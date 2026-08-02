import { describe, it, expect } from "vitest";
import { UNITS } from "../src/data/units.js";
import { UNITS_11E } from "../src/data/units-11e.js";
import { DETACHMENTS } from "../src/data/detachments.js";
import { DETACHMENTS_11E } from "../src/data/detachments-11e.js";
import { ENHANCEMENTS_11E } from "../src/data/enhancements-11e.js";
import { CRUSADE_HONOURS_11E } from "../src/data/crusade-11e.js";
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

  it("fewer than 30 *distinct* units have zero weapons (regression check — was 148 before the deep-nesting fix, is now ~22 legitimately unarmed units: terrain, transports, mines; checked by distinct name rather than raw count since fixing the unitOnly entryLink bug made legitimately-unarmed shared fortifications/terrain, e.g. Searchlight, correctly multiply across every faction that can include them as allies)", () => {
    const zeroWeapons = UNITS.filter((u) => u.rangedWeapons.length === 0 && u.meleeWeapons.length === 0);
    const distinctNames = new Set(zeroWeapons.map((u) => u.name));
    expect(distinctNames.size).toBeLessThan(30);
  });

  it("no unit has a runaway profile count from over-following a shared entryLink pool (regression check for the ~397-ability blowup bug)", () => {
    for (const unit of UNITS) {
      expect(unit.abilities.length, `${unit.faction} / ${unit.name}`).toBeLessThan(100);
    }
  });

  it("Crucible/made-to-order characters keep their full Specialism/Ability/Weapon customization menu (NOT a bug — confirmed against official 'Crucible Champions' rules pages: a real Crucible character is built by picking up to one Specialism, exactly one Ability, and its weapons from real menus, so a large option count is correct and expected, structurally identical to how an ordinary squad's wargear options are already listed in full)", () => {
    const champions = UNITS.filter((u) => u.name === "Champion of the Chapter [Crucible]");
    expect(champions.length).toBeGreaterThan(0);
    for (const u of champions) {
      // Its own always-true content should still be present...
      expect(u.abilities.map((a) => a.name), u.faction).toContain("Exemplar Warrior");
      // ...alongside the full Specialism/Ability/Weapon menus (dozens of options).
      expect(u.abilities.length, `${u.faction} abilities`).toBeGreaterThan(15);
      expect(u.rangedWeapons.length + u.meleeWeapons.length, `${u.faction} weapons`).toBeGreaterThan(15);
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

  it("fewer than 30 *distinct* units have zero weapons (regression check — was 533 mid-fix before the entryLink denylist, is now ~22 legitimately unarmed units: terrain, transports, mines; checked by distinct name rather than raw count — see the UNITS (10e) version of this test for why)", () => {
    const zeroWeapons = UNITS_11E.filter((u) => u.rangedWeapons.length === 0 && u.meleeWeapons.length === 0);
    const distinctNames = new Set(zeroWeapons.map((u) => u.name));
    expect(distinctNames.size).toBeLessThan(30);
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

  it("most Chaos Space Marines units carry Heretic Astartes (legitimate exceptions: Daemon-ally units like Nurglings/Bloodletters, Chaos Knights ally imports, and un-retagged Horus Heresy [Legends] vehicles)", () => {
    const csm = UNITS_11E.filter((u) => u.faction === "Chaos Space Marines");
    const withKeyword = csm.filter((u) => u.keywords.includes("Heretic Astartes"));
    // Lower than it might look at a glance: fixing the unitOnly entryLink bug also
    // correctly surfaced every ally-importable Chaos Knight and Chaos Daemon named
    // character/unit under the Chaos Space Marines faction too (the exact same
    // intentional pattern already established for Imperial Knights' Canis Rex
    // appearing under 17 Imperium factions), which naturally dilutes this ratio.
    expect(withKeyword.length / csm.length).toBeGreaterThan(0.5);
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
    // "Searchlight" is a real, minimal shared-fortification unit (10pts, one ability,
    // tagged just "Allies: Unaligned Forces") — legitimately sparse, not a data gap.
    const knownLegitimatelySparse = new Set(["Searchlight"]);
    const sparse = UNITS_11E.filter(
      (u) =>
        u.keywords.length <= 2 &&
        !u.keywords.some((k) => k.toLowerCase() === u.name.toLowerCase()) &&
        !knownLegitimatelySparse.has(u.name),
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

  it("Chaos Daemons' The Changeling (and similar named single-model characters) are present with complete, correct data (regression check for the unitOnly entryLink bug that dropped every standalone type=\"model\" character reached via a library's own root-level entryLinks)", () => {
    for (const name of ["The Changeling", "Skulltaker", "Skullmaster", "The Blue Scribes"]) {
      const units = UNITS_11E.filter((u) => u.name === name && u.faction === "Chaos Daemons");
      expect(units.length, name).toBeGreaterThan(0);
      for (const u of units) {
        expect(u.profiles.length, `${name} profile`).toBeGreaterThan(0);
        expect(u.rangedWeapons.length + u.meleeWeapons.length, `${name} weapons`).toBeGreaterThan(0);
        expect(u.unitSize, `${name} unitSize`).toEqual({ min: 1, max: 1 });
      }
    }
  });

  it("no unit picked up the universal 'Mighty Champions' Crusade-only ability bloat (regression check: a 'Crusade' wrapper group's nested entryLink, e.g. to 'Mighty Champions', isn't caught by the link-name-only denylist since the group's name carries the 'crusade' signal, not the link's own name)", () => {
    const championBloatNames = [
      "Front-line Champions", "Inspirational Champions", "Logistical Champions",
      "Nemesis Champions", "Restorative Champions", "Strategic Champions", "Subtle Champions",
    ];
    for (const unit of UNITS_11E) {
      for (const ability of unit.abilities) {
        expect(championBloatNames, `${unit.faction} / ${unit.name}`).not.toContain(ability.name);
      }
    }
  });

  it("no single-model named character has an inflated unitSize from counting its own top-level weapon options as model slots (regression check: The Changeling's two weapons, each a mandatory min=1/max=1 child, previously computed to a 3-model unit)", () => {
    for (const name of ["The Changeling", "Skulltaker", "Skullmaster", "The Blue Scribes"]) {
      const units = UNITS_11E.filter((u) => u.name === name && u.faction === "Chaos Daemons");
      for (const u of units) {
        expect(u.unitSize, `${name}`).toEqual({ min: 1, max: 1 });
      }
    }
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

  it("Chaos Space Marines' Murdertalon Raiders and Nightmare Hunt share a mutual-exclusion tag (regression check for the 'cannot be taken with another X detachment' rule)", () => {
    const raiders = DETACHMENTS_11E.find((d) => d.name === "Murdertalon Raiders" && d.faction === "Chaos Space Marines");
    const nightmareHunt = DETACHMENTS_11E.find((d) => d.name === "Nightmare Hunt" && d.faction === "Chaos Space Marines");
    expect(raiders).toBeDefined();
    expect(nightmareHunt).toBeDefined();
    expect(raiders!.restrictionTags).toContain("Nightmare");
    expect(nightmareHunt!.restrictionTags).toContain("Nightmare");
  });

  it("most 11e detachments have no restriction tag; every tag present is a non-empty string", () => {
    const withTags = DETACHMENTS_11E.filter((d) => d.restrictionTags.length > 0);
    expect(withTags.length).toBeGreaterThan(0);
    expect(withTags.length / DETACHMENTS_11E.length).toBeLessThan(0.3);

    for (const det of withTags) {
      for (const tag of det.restrictionTags) {
        expect(tag.trim().length, `${det.faction} / ${det.name}`).toBeGreaterThan(0);
      }
    }
  });

  it("most detachments carrying a restriction tag share it with at least one other detachment in the same faction (Doomed is a rare 3-way group; a handful are currently singletons — BSData hasn't published their exclusion partner yet)", () => {
    const withTags = DETACHMENTS_11E.filter((d) => d.restrictionTags.length > 0);
    const paired = withTags.filter((det) =>
      DETACHMENTS_11E.some(
        (other) =>
          other.id !== det.id &&
          other.faction === det.faction &&
          other.restrictionTags.some((tag) => det.restrictionTags.includes(tag)),
      ),
    );
    expect(paired.length / withTags.length).toBeGreaterThan(0.7);
  });

  it("10th Edition detachments never have a restriction tag (regression check for a stray BSData categoryLink, e.g. 'Grenades' on 10e's own Gladius Task Force, being wrongly reported as one)", () => {
    for (const det of DETACHMENTS) {
      expect(det.restrictionTags, det.name).toEqual([]);
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

describe("Crusade Honours (11th Edition only)", () => {
  it("has a substantial number of entries", () => {
    expect(CRUSADE_HONOURS_11E.length).toBeGreaterThan(500);
  });

  it("every entry has a non-empty name and description", () => {
    for (const h of CRUSADE_HONOURS_11E) {
      expect(h.name.length).toBeGreaterThan(0);
      expect(h.description.length).toBeGreaterThan(0);
    }
  });

  it("scope and its matching field are consistent: generic has neither faction nor campaign", () => {
    for (const h of CRUSADE_HONOURS_11E) {
      if (h.scope === "generic") {
        expect(h.faction).toBeNull();
        expect(h.campaign).toBeNull();
      }
    }
  });

  it("scope and its matching field are consistent: faction has faction set, campaign null", () => {
    for (const h of CRUSADE_HONOURS_11E) {
      if (h.scope === "faction") {
        expect(h.faction).not.toBeNull();
        expect(h.campaign).toBeNull();
      }
    }
  });

  it("scope and its matching field are consistent: campaign has campaign set, faction null", () => {
    for (const h of CRUSADE_HONOURS_11E) {
      if (h.scope === "campaign") {
        expect(h.campaign).not.toBeNull();
        expect(h.faction).toBeNull();
      }
    }
  });

  it("relicTier is only set on relic-category entries, and only to a known tier", () => {
    const knownTiers = new Set(["Antiquity", "Legendary", "Artificer"]);
    for (const h of CRUSADE_HONOURS_11E) {
      if (h.relicTier !== null) {
        expect(h.category).toBe("relic");
        expect(knownTiers.has(h.relicTier)).toBe(true);
      }
    }
  });

  it("every category value is one of the known Crusade content types", () => {
    const knownCategories = new Set(["battleTrait", "relic", "battleScar", "boon"]);
    for (const h of CRUSADE_HONOURS_11E) {
      expect(knownCategories.has(h.category)).toBe(true);
    }
  });

  it("includes at least one entry per campaign supplement", () => {
    const campaigns = new Set(CRUSADE_HONOURS_11E.filter((h) => h.scope === "campaign").map((h) => h.campaign));
    expect(campaigns.has("Tyrannic War")).toBe(true);
    expect(campaigns.has("Pariah Nexus")).toBe(true);
    expect(campaigns.has("Armageddon")).toBe(true);
  });

  it("includes Chaos Space Marines' faction-specific Battle Traits, Relics, and Boons", () => {
    const csm = CRUSADE_HONOURS_11E.filter((h) => h.faction === "Chaos Space Marines");
    expect(csm.some((h) => h.name === "Living Hull" && h.category === "battleTrait")).toBe(true);
    expect(csm.some((h) => h.category === "relic")).toBe(true);
    expect(csm.some((h) => h.category === "boon")).toBe(true);
  });

  it("includes the universal Battle Scars table", () => {
    const scars = CRUSADE_HONOURS_11E.filter((h) => h.category === "battleScar");
    expect(scars.length).toBeGreaterThanOrEqual(6);
    expect(scars.every((h) => h.scope === "generic")).toBe(true);
  });

  it("has no duplicate ids within the same faction/campaign scope", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const h of CRUSADE_HONOURS_11E) {
      const key = `${h.faction ?? ""}::${h.campaign ?? ""}::${h.id}`;
      if (seen.has(key)) dupes.push(`${h.faction ?? h.campaign ?? "generic"} / ${h.name}`);
      seen.add(key);
    }
    expect(dupes).toEqual([]);
  });
});
