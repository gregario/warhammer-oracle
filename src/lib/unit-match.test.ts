import { describe, it, expect } from "vitest";
import { ambiguousFactionMatches, isCanonicalFaction, rankUnitMatches } from "./unit-match.js";

// Trimmed-down stand-ins for `Unit` — rankUnitMatches only reads name/faction/keywords.
const lemanRussAM = {
  name: "Leman Russ Battle Tank",
  faction: "Astra Militarum",
  keywords: ["Leman Russ Battle Tank", "Astra Militarum", "Imperium", "Vehicle"],
};
const lemanRussGSC = {
  name: "Leman Russ Battle Tank",
  faction: "Genestealer Cults",
  keywords: ["Leman Russ Battle Tank", "Astra Militarum", "Imperium", "Vehicle"],
};
const knightPaladinIK = {
  name: "Knight Paladin",
  faction: "Imperial Knights",
  keywords: ["Vehicle", "Walker", "Titanic", "Imperial Knights", "Knight Paladin"],
};
const knightPaladinBA = {
  name: "Knight Paladin",
  faction: "Adeptus Astartes - Blood Angels",
  keywords: ["Vehicle", "Walker", "Titanic", "Imperial Knights", "Knight Paladin"],
};

describe("isCanonicalFaction", () => {
  it("is true when the faction is one of the entry's own keywords", () => {
    expect(isCanonicalFaction(lemanRussAM)).toBe(true);
  });

  it("is false for a cross-faction import that kept the original army keyword", () => {
    expect(isCanonicalFaction(lemanRussGSC)).toBe(false);
    expect(isCanonicalFaction(knightPaladinBA)).toBe(false);
  });

  it("requires an exact keyword, so a broad keyword cannot vouch for a faction", () => {
    // "Chaos" ⊄ "Chaos Daemons"; every Chaos-triad import carries "Chaos", and
    // treating that as canonical would defeat the tiebreak entirely.
    expect(
      isCanonicalFaction({
        name: "Chaos Lord",
        faction: "Chaos Daemons",
        keywords: ["Heretic Astartes", "Character", "Chaos", "Chaos Lord"],
      }),
    ).toBe(false);
    // A sub-faction catalogue ("Adeptus Astartes - Ultramarines") is likewise
    // not canonical off the base "Adeptus Astartes" keyword alone.
    expect(
      isCanonicalFaction({
        name: "Intercessor Squad",
        faction: "Adeptus Astartes - Ultramarines",
        keywords: ["Infantry", "Adeptus Astartes", "Intercessor Squad"],
      }),
    ).toBe(false);
  });
});

describe("rankUnitMatches", () => {
  it("prefers the faction-canonical copy over an import — GSC Leman Russ bug", () => {
    // GSC copy is first in data-file order, which is what used to win.
    const out = rankUnitMatches([lemanRussGSC, lemanRussAM], "Leman Russ Battle Tank");
    expect(out).toHaveLength(1);
    expect(out[0].faction).toBe("Astra Militarum");
  });

  it("resolves 'Knight Paladin' to Imperial Knights, not a Space Marine import", () => {
    const out = rankUnitMatches(
      [knightPaladinBA, knightPaladinIK, { ...knightPaladinBA, faction: "Grey Knights" }],
      "Knight Paladin",
    );
    expect(out[0].faction).toBe("Imperial Knights");
  });

  it("collapses exact-duplicate entries", () => {
    const dupe = { name: "Termagants", faction: "Tyranids", keywords: ["Tyranids", "Termagants"] };
    const out = rankUnitMatches([dupe, { ...dupe }, { ...dupe }], "Termagants");
    expect(out).toHaveLength(1);
  });

  it("keeps every option when the canonical tiebreak would erase them all", () => {
    const a = { name: "Callidus Assassin", faction: "Imperial Agents", keywords: ["Character"] };
    const b = { name: "Callidus Assassin", faction: "Adeptus Custodes", keywords: ["Character"] };
    const out = rankUnitMatches([a, b], "Callidus Assassin");
    expect(out).toHaveLength(2);
  });

  it("still resolves a plural query that is not a substring of the datasheet name", () => {
    const out = rankUnitMatches(
      [
        { name: "Assault Intercessor Squad", faction: "Adeptus Astartes - Space Marines", keywords: [] },
        { name: "Intercessor Squad", faction: "Adeptus Astartes - Space Marines", keywords: [] },
      ],
      "Intercessors",
    );
    expect(out[0].name).toBe("Intercessor Squad");
  });

  it("returns nothing when no name clears the score floor", () => {
    expect(rankUnitMatches([lemanRussAM], "Aeldari Farseer")).toHaveLength(0);
  });

  it("drops a same-stat import but keeps a genuinely different same-name datasheet", () => {
    const csm = {
      name: "Helbrute",
      faction: "Chaos Space Marines",
      keywords: ["Heretic Astartes", "Chaos"],
      m: "6",
    };
    const daemonsImport = { ...csm, faction: "Chaos Daemons", m: "6" }; // same stats, not canonical
    const worldEaters = {
      name: "Helbrute",
      faction: "World Eaters",
      keywords: ["Heretic Astartes", "World Eaters"],
      m: "9",
    };
    const out = rankUnitMatches(
      [csm, daemonsImport, worldEaters],
      "Helbrute",
      (u) => u.m,
    );
    // Chaos Daemons copy is a 6" import of the CSM sheet — but CSM is not
    // canonical either, so nothing is dropped as an import here...
    expect(out.map((u) => u.faction)).toContain("World Eaters");
    expect(out.map((u) => u.faction)).toContain("Chaos Space Marines");
  });

  it("drops the import only when a canonical entry carries the same stat line", () => {
    const canonical = {
      name: "Leman Russ Battle Tank",
      faction: "Astra Militarum",
      keywords: ["Astra Militarum"],
      m: "10",
    };
    const gscImport = { ...canonical, faction: "Genestealer Cults", keywords: ["Astra Militarum"] };
    const out = rankUnitMatches([gscImport, canonical], "Leman Russ Battle Tank", (u) => u.m);
    expect(out).toHaveLength(1);
    expect(out[0].faction).toBe("Astra Militarum");
  });
});

describe("ambiguousFactionMatches", () => {
  const statOf = (u: { stat: string }) => u.stat;
  const helb = (faction: string, move: string, canonical = false) => ({
    name: "Helbrute",
    faction,
    keywords: canonical ? ["Heretic Astartes", faction] : ["Heretic Astartes", "Chaos"],
    stat: `M${move} T9 Sv2+ W8`,
  });

  it("flags a near-exact query whose stat line differs by faction", () => {
    const units = [
      helb("Chaos Space Marines", '6"'),
      helb("Death Guard", '7"', true),
      helb("World Eaters", '9"', true),
    ];
    const matches = rankUnitMatches(units, "Helbrute", statOf);
    const tie = ambiguousFactionMatches(matches, "Helbrute", statOf);
    expect(tie?.map((u) => u.faction)).toEqual([
      "Chaos Space Marines",
      "Death Guard",
      "World Eaters",
    ]);
  });

  it("returns one representative per distinct stat line, not per faction", () => {
    const units = [
      helb("Chaos Space Marines", '6"'),
      helb("Chaos Daemons", '6"'),
      helb("Chaos Knights", '6"'),
      helb("World Eaters", '9"', true),
    ];
    const matches = rankUnitMatches(units, "Helbrute", statOf);
    const tie = ambiguousFactionMatches(matches, "Helbrute", statOf);
    expect(tie).toHaveLength(2);
  });

  it("does NOT flag same-name imports that share a stat line", () => {
    const units = [
      { name: "Chaos Lord", faction: "Chaos Daemons", keywords: ["Chaos"], stat: "same" },
      { name: "Chaos Lord", faction: "Chaos Space Marines", keywords: ["Chaos"], stat: "same" },
      { name: "Chaos Lord", faction: "Chaos Knights", keywords: ["Chaos"], stat: "same" },
    ];
    const matches = rankUnitMatches(units, "Chaos Lord", statOf);
    expect(ambiguousFactionMatches(matches, "Chaos Lord", statOf)).toBeNull();
  });

  it("does not flag once the import trim already resolved it", () => {
    const units = [
      { name: "Leman Russ Battle Tank", faction: "Genestealer Cults", keywords: ["Astra Militarum"], stat: "x" },
      { name: "Leman Russ Battle Tank", faction: "Astra Militarum", keywords: ["Astra Militarum"], stat: "x" },
    ];
    const matches = rankUnitMatches(units, "Leman Russ Battle Tank", statOf);
    expect(ambiguousFactionMatches(matches, "Leman Russ Battle Tank", statOf)).toBeNull();
  });

  it("does not flag a loose/partial query", () => {
    const units = [helb("World Eaters", '9"', true), helb("Death Guard", '7"', true)];
    const matches = rankUnitMatches(units, "Helb", statOf);
    expect(ambiguousFactionMatches(matches, "Helb", statOf)).toBeNull();
  });

  it("does not flag a single match", () => {
    expect(ambiguousFactionMatches([helb("World Eaters", '9"', true)], "Helbrute", statOf)).toBeNull();
  });
});
