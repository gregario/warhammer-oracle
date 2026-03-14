import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

let client: Client;

beforeAll(async () => {
  const server = createServer();
  client = new Client({ name: "test-client", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);
});

function getText(result: Awaited<ReturnType<typeof client.callTool>>): string {
  return (result.content as Array<{ type: string; text: string }>)[0].text;
}

describe("search_units tool", () => {
  it("is registered and appears in listTools", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "search_units");
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("Search");
  });

  it("searches by faction name", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Necrons" },
    });
    const text = getText(result);
    expect(text).toContain("Necrons");
    // Should return compact format, not full datasheets
    expect(text).not.toContain("### Unit Profiles");
    expect(text).not.toContain("Ranged Weapons");
  });

  it("searches by unit keyword", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Vehicle" },
    });
    const text = getText(result);
    expect(text).toContain("Vehicle");
    // Compact format check
    expect(text).toContain("pts");
    expect(text).toContain("Keywords:");
  });

  it("searches by unit name", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "warrior" },
    });
    const text = getText(result);
    // Should find units with "warrior" in name
    expect(text.toLowerCase()).toContain("warrior");
    expect(text).toContain("Keywords:");
  });

  it("filters by max_points", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Necrons", max_points: 100 },
    });
    const text = getText(result);
    expect(text).toContain("Necrons");
    // All returned units should have points <= 100
    // Extract all point values from compact lines (format: "— Npts —")
    const pointMatches = text.match(/— (\d+)pts —/g);
    expect(pointMatches).toBeTruthy();
    for (const match of pointMatches!) {
      const pts = parseInt(match.replace("— ", "").replace("pts —", ""));
      expect(pts).toBeLessThanOrEqual(100);
    }
  });

  it("caps results at 10", async () => {
    // "Infantry" is a very common keyword — should match many more than 10
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Infantry" },
    });
    const text = getText(result);
    // Count the number of result lines (each starts with **)
    const resultLines = text.split("\n").filter((l) => l.startsWith("**"));
    expect(resultLines.length).toBeLessThanOrEqual(10);
    // Should indicate more results exist
    expect(text).toContain("Showing 10 of");
  });

  it("returns compact format (name, faction, points, keywords)", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Abaddon" },
    });
    const text = getText(result);
    // Should have compact format
    expect(text).toContain("**Abaddon the Despoiler**");
    expect(text).toContain("Chaos Space Marines");
    expect(text).toContain("pts");
    expect(text).toContain("Keywords:");
    // Should NOT have full datasheet sections
    expect(text).not.toContain("### Unit Profiles");
    expect(text).not.toContain("### Ranged Weapons");
    expect(text).not.toContain("### Abilities");
  });

  it("returns friendly message for no results", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Totally Nonexistent Unit XYZZY" },
    });
    const text = getText(result);
    expect(text).toContain("No units found");
    expect(text).toContain("Totally Nonexistent Unit XYZZY");
    expect(text).toContain("broader search");
  });

  it("combines faction filter with query", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Character", faction: "Necrons" },
    });
    const text = getText(result);
    // All results should be Necrons
    const lines = text.split("\n").filter((l) => l.startsWith("**"));
    for (const line of lines) {
      expect(line).toContain("Necrons");
    }
  });

  it("shows filter info in no-results message", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "XYZZY Nonexistent", faction: "Necrons", max_points: 50 },
    });
    const text = getText(result);
    expect(text).toContain("No units found");
    expect(text).toContain("Necrons");
    expect(text).toContain("50");
  });
});
