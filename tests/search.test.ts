import { describe, it, expect } from "vitest";
import { fuzzySearch } from "../src/lib/search.js";

interface TestItem {
  name: string;
  faction: string;
  tags: string[];
}

const items: TestItem[] = [
  { name: "Space Marine", faction: "Imperium", tags: ["elite", "power armour"] },
  { name: "Ork Boy", faction: "Orks", tags: ["horde", "melee"] },
  { name: "Fire Warrior", faction: "T'au Empire", tags: ["ranged", "elite"] },
  { name: "Tyranid Warrior", faction: "Tyranids", tags: ["synapse", "melee"] },
];

describe("fuzzySearch", () => {
  it("finds items by name substring", () => {
    const result = fuzzySearch(items, "Warrior", ["name"]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["Fire Warrior", "Tyranid Warrior"]);
  });

  it("is case insensitive", () => {
    const result = fuzzySearch(items, "space marine", ["name"]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Space Marine");
  });

  it("searches array fields (tags)", () => {
    const result = fuzzySearch(items, "melee", ["tags"]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["Ork Boy", "Tyranid Warrior"]);
  });

  it("returns all items for empty query", () => {
    expect(fuzzySearch(items, "", ["name"])).toHaveLength(4);
    expect(fuzzySearch(items, "  ", ["name"])).toHaveLength(4);
  });

  it("returns empty array for no match", () => {
    expect(fuzzySearch(items, "Necron", ["name", "faction", "tags"])).toHaveLength(0);
  });

  it("searches across multiple fields", () => {
    const result = fuzzySearch(items, "empire", ["name", "faction"]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Fire Warrior");
  });

  it("returns a copy, not the original array", () => {
    const result = fuzzySearch(items, "", ["name"]);
    expect(result).not.toBe(items);
    expect(result).toEqual(items);
  });
});
