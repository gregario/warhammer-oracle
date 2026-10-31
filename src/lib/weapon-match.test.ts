import { describe, it, expect } from "vitest";
import {
  countCurrent,
  describeVariantDifference,
  groupWeaponVariants,
  isCurrentDatasheet,
  matchWeaponName,
  splitWeaponName,
  weaponProfileKey,
} from "./weapon-match.js";
import type { WeaponEntry } from "./weapon-match.js";

/** One datasheet's plasma gun (standard + supercharge), with optional per-profile overrides. */
function plasma(carrierId: string, carrier: string, overrides: Partial<WeaponEntry>[] = [{}, {}]): WeaponEntry[] {
  const base: WeaponEntry[] = [
    {
      carrierId,
      carrier,
      name: "➤ Plasma gun - standard",
      cells: ['24"', "1", "7", "-2", "1"],
      keywords: ["Rapid Fire 1"],
      skill: "4+",
    },
    {
      carrierId,
      carrier,
      name: "➤ Plasma gun - supercharge",
      cells: ['24"', "1", "8", "-3", "2"],
      keywords: ["Hazardous", "Rapid Fire 1"],
      skill: "4+",
    },
  ];
  return base.map((e, i) => ({ ...e, ...overrides[i] }));
}

/** Imperial Navy Breachers' plasma gun: one point less AP on each profile. */
const BREACHERS: Partial<WeaponEntry>[] = [
  { cells: ['24"', "1", "7", "-1", "1"] },
  { cells: ['24"', "1", "8", "-2", "2"] },
];

describe("splitWeaponName", () => {
  it("strips the multi-profile arrow and splits off the profile label", () => {
    expect(splitWeaponName("➤ Plasma gun - standard")).toEqual({ base: "Plasma gun", label: "standard" });
    expect(splitWeaponName("➤ Plasma pistol- supercharge")).toEqual({
      base: "Plasma pistol",
      label: "supercharge",
    });
    expect(splitWeaponName("➤ Grenade Launcher (Frag)")).toEqual({ base: "Grenade Launcher", label: "Frag" });
  });

  it("leaves single-profile names and in-name hyphens alone", () => {
    expect(splitWeaponName("Lascannon")).toEqual({ base: "Lascannon", label: "" });
    expect(splitWeaponName("Combi-weapon")).toEqual({ base: "Combi-weapon", label: "" });
  });

  it("only treats a parenthetical as a profile for arrowed names unless asked", () => {
    expect(splitWeaponName("Lascannon (Heavy)")).toEqual({ base: "Lascannon (Heavy)", label: "" });
    expect(splitWeaponName("Plasma gun (standard)", true)).toEqual({ base: "Plasma gun", label: "standard" });
  });
});

describe("weaponProfileKey", () => {
  it("ignores keyword order and case", () => {
    const a = { label: "supercharge", cells: ["8"], keywords: ["Hazardous", "Rapid Fire 1"] };
    const b = { label: "Supercharge", cells: ["8"], keywords: ["RAPID FIRE 1", "hazardous"] };
    expect(weaponProfileKey(a)).toBe(weaponProfileKey(b));
  });

  it("distinguishes a real stat difference", () => {
    const a = { label: "", cells: ["-2"], keywords: [] };
    const b = { label: "", cells: ["-1"], keywords: [] };
    expect(weaponProfileKey(a)).not.toBe(weaponProfileKey(b));
  });
});

describe("matchWeaponName", () => {
  const names = [
    "Plasma gun",
    "Plasma gun",
    "Twin Plasma Gun",
    "EtaCarn plasma gun",
    "Plasma pistol",
    "Lascannon",
  ];

  it("answers only the exact weapon name, not longer names containing it", () => {
    const m = matchWeaponName(names, "plasma gun");
    expect([...m.names]).toEqual(["plasma gun"]);
    expect(m.closest).toBe(false);
  });

  it("answers a plural query", () => {
    expect([...matchWeaponName(names, "lascannons").names]).toEqual(["lascannon"]);
  });

  it("offers suggestions instead of guessing between several partial matches", () => {
    const m = matchWeaponName(names, "plasma");
    expect(m.names.size).toBe(0);
    expect(m.suggestions).toEqual(expect.arrayContaining(["Plasma gun", "Plasma pistol"]));
  });

  it("answers a lone misspelling as a flagged closest match", () => {
    const m = matchWeaponName(names, "lascanon");
    expect([...m.names]).toEqual(["lascannon"]);
    expect(m.closest).toBe(true);
  });

  it("returns nothing for an unrelated name", () => {
    const m = matchWeaponName(names, "xyzzy");
    expect(m.names.size).toBe(0);
    expect(m.suggestions).toEqual([]);
  });
});

describe("groupWeaponVariants", () => {
  it("groups datasheets whose profiles differ only in keyword order, case, or bearer skill", () => {
    const variants = groupWeaponVariants([
      ...plasma("a", "Cadian Shock Troops"),
      ...plasma("b", "Kasrkin", [{ skill: "3+" }, { keywords: ["Rapid Fire 1", "Hazardous"], skill: "3+" }]),
      ...plasma("c", "Plague Marines", [{}, { keywords: ["RAPID FIRE 1", "hazardous"] }]),
    ]);
    expect(variants).toHaveLength(1);
    expect(variants[0].carriers).toEqual(["Cadian Shock Troops", "Kasrkin", "Plague Marines"]);
    expect(variants[0].skills).toEqual(["4+", "3+"]);
  });

  it("counts a datasheet imported into several faction lists once", () => {
    const variants = groupWeaponVariants([
      ...plasma("a", "Traitor Guardsmen Squad"),
      ...plasma("a", "Traitor Guardsmen Squad"),
    ]);
    expect(variants[0].carriers).toEqual(["Traitor Guardsmen Squad"]);
  });

  it("sorts the most-carried profile set first", () => {
    const variants = groupWeaponVariants([
      ...plasma("x", "Imperial Navy Breachers", BREACHERS),
      ...plasma("a", "Cadian Shock Troops"),
      ...plasma("b", "Kasrkin"),
    ]);
    expect(variants.map((v) => v.carriers)).toEqual([
      ["Cadian Shock Troops", "Kasrkin"],
      ["Imperial Navy Breachers"],
    ]);
  });
});

describe("describeVariantDifference", () => {
  const headers = ["Range", "A", "S", "AP", "D"];
  const [standard] = groupWeaponVariants(plasma("a", "Cadian Shock Troops"));

  it("names the changed stat per profile", () => {
    const [breachers] = groupWeaponVariants(
      plasma("x", "Imperial Navy Breachers", BREACHERS),
    );
    expect(describeVariantDifference(standard, breachers, headers)).toBe(
      "standard: AP -1 (vs -2); supercharge: AP -2 (vs -3)",
    );
  });

  it("says a change shared by every profile once", () => {
    const [tormentors] = groupWeaponVariants(
      plasma("t", "Tormentors", [
        { keywords: ["Precision", "Rapid Fire 1"] },
        { keywords: ["Hazardous", "Precision", "Rapid Fire 1"] },
      ]),
    );
    expect(describeVariantDifference(standard, tormentors, headers)).toBe("+Precision");
  });

  it("notes a datasheet that carries only some of the profiles", () => {
    const [partial] = groupWeaponVariants(plasma("p", "Martial Agent").slice(0, 1));
    expect(describeVariantDifference(standard, partial, headers)).toBe("only the standard profile");
  });
});

describe("current-datasheet ranking", () => {
  it("recognises [Legends] and [Crucible] entries", () => {
    expect(isCurrentDatasheet("Cadian Shock Troops")).toBe(true);
    expect(isCurrentDatasheet("Rapier Carrier [Legends]")).toBe(false);
    expect(isCurrentDatasheet("Exalted Champion [Crucible]")).toBe(false);
    expect(countCurrent(["A", "B [Legends]", "C [Crucible]"])).toBe(1);
  });

  it("ranks the profile carried by more current datasheets first, even when outnumbered overall", () => {
    const entries = [
      ...plasma("c1", "Current One"),
      ...plasma("c2", "Current Two"),
      ...plasma("l1", "Old One [Legends]", BREACHERS),
      ...plasma("l2", "Old Two [Legends]", BREACHERS),
      ...plasma("l3", "Old Three [Crucible]", BREACHERS),
    ];
    const [first, second] = groupWeaponVariants(entries);
    expect(first.carriers).toEqual(["Current One", "Current Two"]);
    expect(second.carriers).toHaveLength(3);
  });
});
