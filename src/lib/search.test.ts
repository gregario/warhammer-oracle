import { describe, it, expect } from "vitest";
import { fuzzySearch, normalizeName, scoreName, rankByName } from "./search.js";

describe("fuzzySearch", () => {
  const items = [
    { name: "Leman Russ Battle Tank", faction: "Astra Militarum" },
    { name: "Leman Russ Demolisher", faction: "Astra Militarum" },
    { name: "Rogal Dorn Battle Tank", faction: "Astra Militarum" },
  ];

  it("filters by substring, case-insensitively", () => {
    expect(fuzzySearch(items, "leman russ", ["name"]).map((i) => i.name)).toEqual([
      "Leman Russ Battle Tank",
      "Leman Russ Demolisher",
    ]);
  });

  it("returns a copy of everything for a blank query", () => {
    const out = fuzzySearch(items, "   ", ["name"]);
    expect(out).toHaveLength(3);
    expect(out).not.toBe(items);
  });
});

describe("normalizeName", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizeName("  T'au   Empire!! ")).toBe("t au empire");
  });
});

describe("scoreName", () => {
  it("scores an exact (normalized) match highest", () => {
    expect(scoreName("Leman Russ Battle Tank", "Leman Russ Battle Tank")).toBe(1);
    expect(scoreName("leman russ battle tank", "Leman Russ Battle Tank")).toBe(1);
  });

  it("treats a plural/singular variant as near-exact", () => {
    expect(scoreName("Intercessors", "Intercessor")).toBe(0.95);
    expect(scoreName("Termagant", "Termagants")).toBe(0.95);
  });

  it("ranks a leading-word-run prefix above an out-of-order subset", () => {
    const prefix = scoreName("Leman Russ", "Leman Russ Battle Tank");
    const subset = scoreName("Tank Battle", "Leman Russ Battle Tank");
    expect(prefix).toBeGreaterThan(subset);
    expect(subset).toBeGreaterThan(0);
  });

  it("resolves a plural query to the '... Squad' datasheet ahead of a named variant", () => {
    const squad = scoreName("Intercessors", "Intercessor Squad");
    const assaultSquad = scoreName("Intercessors", "Assault Intercessor Squad");
    expect(squad).toBeGreaterThan(0.5);
    // "Intercessor Squad" leads with the queried word; "Assault ..." buries it
    expect(squad).toBeGreaterThan(assaultSquad);
  });

  it("falls back to a trigram match for a near-miss with no shared whole word", () => {
    expect(scoreName("Kabalite Warrior", "Kabalite Warriors")).toBeGreaterThan(0.9);
    expect(scoreName("Bloodletter", "Bloodletters")).toBeGreaterThan(0.9);
    expect(scoreName("completely unrelated", "Leman Russ Battle Tank")).toBe(0);
  });

  it("is monotonic across the tiers for one datasheet", () => {
    const name = "Leman Russ Battle Tank";
    const exact = scoreName("Leman Russ Battle Tank", name);
    const prefix = scoreName("Leman Russ", name);
    const infix = scoreName("Battle Tank", name);
    const subset = scoreName("Tank Leman", name);
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(infix);
    expect(infix).toBeGreaterThan(subset);
    expect(subset).toBeGreaterThan(0);
  });
});

describe("rankByName", () => {
  const units = [
    { name: "Assault Intercessor Squad" },
    { name: "Intercessor Squad" },
    { name: "Heavy Intercessor Squad" },
    { name: "Bladeguard Veteran Squad" },
  ];

  it("orders by score and drops non-matches", () => {
    const ranked = rankByName(units, "Intercessors", (u) => u.name);
    expect(ranked.map((r) => r.item.name)).toEqual([
      "Intercessor Squad",
      "Assault Intercessor Squad",
      "Heavy Intercessor Squad",
    ]);
  });

  it("respects minScore", () => {
    expect(rankByName(units, "Intercessors", (u) => u.name, 0.99)).toHaveLength(0);
  });

  it("keeps data-file order among equal scores (stable)", () => {
    const tied = [
      { name: "Leman Russ Battle Tank", tag: "a" },
      { name: "Leman Russ Battle Tank", tag: "b" },
    ];
    expect(rankByName(tied, "Leman Russ Battle Tank", (u) => u.name).map((r) => r.item.tag)).toEqual([
      "a",
      "b",
    ]);
  });
});
