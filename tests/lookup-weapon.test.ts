import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { UNITS_11E } from "../src/data/units-11e.js";

let client: Client;

beforeAll(async () => {
  const server = createServer();
  client = new Client({ name: "test-client", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);
});

async function lookup(args: Record<string, string>): Promise<string> {
  const result = await client.callTool({ name: "lookup_weapon", arguments: args });
  return (result.content as Array<{ type: string; text: string }>)[0].text;
}

/** The text before the variants list, i.e. the answer the LLM should lead with. */
function standardSection(text: string): string {
  return text.split("### Variants")[0];
}

describe("lookup_weapon tool", () => {
  it("is registered and its description steers weapon questions away from lookup_unit", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "lookup_weapon");
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("lookup_unit");
    expect(tool!.description).toContain("plasma gun");
  });

  it("leads with the standard plasma gun profile and lists datasheet variants after it", async () => {
    const text = await lookup({ weapon_name: "plasma gun" });
    expect(text).toContain("[Mode: 40k 11e]");
    expect(text).toContain("# Plasma gun");

    const standard = standardSection(text);
    expect(standard).toContain("**Standard profile**");
    expect(standard).toContain('| standard | 24" | 1 | 7 | -2 | 1 | Rapid Fire 1 |');
    expect(standard).toContain('| supercharge | 24" | 1 | 8 | -3 | 2 | Hazardous, Rapid Fire 1 |');
    expect(standard).not.toContain("Breachers");
    expect(standard).not.toContain("Tormentors");

    const variants = text.split("### Variants")[1];
    expect(variants).toMatch(/Imperial Navy Breachers.*standard: AP -1 \(vs -2\); supercharge: AP -2 \(vs -3\)/);
    expect(variants).toMatch(/Tormentors.*: \+Precision/);
  });

  it("does not mix other weapons whose names contain the query into the answer", async () => {
    const text = await lookup({ weapon_name: "plasma gun" });
    expect(text).not.toMatch(/twin plasma gun/i);
    expect(text).not.toMatch(/etacarn/i);
    expect(text).not.toContain("Rhino Primaris");
    expect(text).not.toContain("Einhyr Hearthguard");
  });

  it("answers a longer weapon name when that is what was asked for", async () => {
    const text = await lookup({ weapon_name: "Twin plasma gun" });
    expect(text).toContain("# Twin Plasma Gun");
    expect(text).toContain("Twin-linked");
  });

  it("treats keyword order as irrelevant when grouping profiles", async () => {
    // The data lists the supercharge profile both ways round.
    const orders = new Set(
      UNITS_11E.flatMap((u) => u.rangedWeapons)
        .filter((w) => w.name === "➤ Plasma gun - supercharge")
        .map((w) => w.keywords.join(", ")),
    );
    expect(orders).toContain("Hazardous, Rapid Fire 1");
    expect(orders).toContain("Rapid Fire 1, Hazardous");

    const text = await lookup({ weapon_name: "plasma gun" });
    expect(text).not.toContain("Rapid Fire 1, Hazardous");
    // Only the two real exceptions (Breachers and Tormentors) are variants.
    const variants = text.split("### Variants")[1];
    expect(variants.trim().split("\n").filter((l) => l.startsWith("- "))).toHaveLength(2);
  });

  it("keeps bearer skill out of the profile", async () => {
    const text = await lookup({ weapon_name: "plasma gun" });
    expect(standardSection(text)).not.toContain("| BS |");
    expect(text).toContain("BS is not part of the weapon");
  });

  it("judges the standard profile on current datasheets, not [Legends]/[Crucible] entries", async () => {
    // Legends/Crucible boltguns (A2, no Rapid Fire) are numerous enough to
    // outvote the real profile if every entry gets a vote.
    const standard = standardSection(await lookup({ weapon_name: "boltgun" }));
    expect(standard).toContain("**Standard profile**");
    expect(standard).toContain("current datasheet");
    expect(standard).toContain('| 24" | 1 | 4 | 0 | 1 | Rapid Fire 1 |');
  });

  it("looks up a melee weapon", async () => {
    const text = await lookup({ weapon_name: "power fist" });
    expect(text).toContain("# Power fist");
    expect(standardSection(text)).toContain("| Melee | 3 | 8 | -2 | 2 | - |");
    expect(text).toContain("WS is not part of the weapon");
    expect(text).toContain("### Variants");
  });

  it("restricts to a faction's datasheets when faction is given", async () => {
    const text = await lookup({ weapon_name: "plasma gun", faction: "Astra Militarum" });
    expect(text).toContain("**Standard profile**");
    expect(text).toContain("Imperial Navy Breachers");
    expect(text).not.toContain("Tormentors");
    expect(text).not.toContain("Plague Marines");
    expect(text).toContain('faction "Astra Militarum"');
  });

  it("reports nothing when the faction has no such weapon", async () => {
    const text = await lookup({ weapon_name: "plasma gun", faction: "T'au" });
    expect(text).toContain('No weapon found named "plasma gun"');
    expect(text).toContain("faction filter");
  });

  it("suggests weapon names when nothing matches exactly", async () => {
    const text = await lookup({ weapon_name: "plasma" });
    expect(text).toContain('No weapon found named "plasma"');
    expect(text).toContain("Did you mean");
    expect(text).toContain("- Plasma gun");
    expect(text).toContain("- Plasma pistol");
  });

  it("returns a friendly message for an unknown weapon", async () => {
    const text = await lookup({ weapon_name: "Totally Fake Weapon XYZZY" });
    expect(text).toContain('No weapon found named "Totally Fake Weapon XYZZY"');
  });

  it("answers a misspelled name with its closest match, flagged as such", async () => {
    const text = await lookup({ weapon_name: "lascanon" });
    expect(text).toContain("showing the closest match");
    expect(text).toContain("# Lascannon");
    expect(standardSection(text)).toContain('| 48" | 1 | 12 | -3 | D6+1 | - |');
  });

  it("supports 10th Edition data", async () => {
    const text = await lookup({ weapon_name: "plasma gun", game_mode: "40k_10e" });
    expect(text).toContain("[Mode: 40k 10e]");
    expect(text).toContain("# Plasma gun");
  });

  it("supports Kill Team weapons", async () => {
    const text = await lookup({ weapon_name: "plasma gun", game_mode: "kill_team" });
    expect(text).toContain("[Mode: Kill Team]");
    expect(text).toContain("| Profile | Type | ATK | DMG | Keywords |");
    expect(text).toContain("Hit is not part of the weapon");
  });
});
