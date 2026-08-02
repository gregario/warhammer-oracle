import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { DISPOSITIONS, MISSION_MATCHUPS } from "../src/data/dispositions.js";

function callTool(client: Client, name: string, args: Record<string, unknown>) {
  return client.callTool({ name, arguments: args });
}

function textOf(result: Awaited<ReturnType<typeof callTool>>): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content.map((c) => c.text).join("\n");
}

describe("determine_primary_mission", () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer();
    client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  });

  it("is registered as a tool", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("determine_primary_mission");
  });

  it("covers all 15 unique disposition pairings with no duplicates", () => {
    const seen = new Set<string>();
    for (const m of MISSION_MATCHUPS) {
      const key = [m.dispositionA, m.dispositionB].sort().join(" vs ");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    const expectedPairs = (DISPOSITIONS.length * (DISPOSITIONS.length + 1)) / 2;
    expect(MISSION_MATCHUPS.length).toBe(expectedPairs);
  });

  it("mirror matchups give both players the same mission", () => {
    for (const disposition of DISPOSITIONS) {
      const mirror = MISSION_MATCHUPS.find(
        (m) => m.dispositionA === disposition && m.dispositionB === disposition,
      );
      expect(mirror).toBeDefined();
      expect(mirror!.missionA).toBe(mirror!.missionB);
    }
  });

  it("returns each player's mission for a known cross matchup", async () => {
    const result = await callTool(client, "determine_primary_mission", {
      your_disposition: "Take and Hold",
      opponent_disposition: "Purge the Foe",
    });
    const text = textOf(result);

    expect(text).toContain("Immovable Object");
    expect(text).toContain("Unstoppable Force");
  });

  it("is order-invariant — swapping sides swaps the missions correctly", async () => {
    const result = await callTool(client, "determine_primary_mission", {
      your_disposition: "Purge the Foe",
      opponent_disposition: "Take and Hold",
    });
    const text = textOf(result);

    expect(text).toContain("Unstoppable Force");
    expect(text).toContain("Immovable Object");
  });

  it("returns the same mission for both players in a mirror matchup", async () => {
    const result = await callTool(client, "determine_primary_mission", {
      your_disposition: "Disruption",
      opponent_disposition: "Disruption",
    });
    const text = textOf(result);

    expect(text).toContain("Outmanoeuvre");
  });

  it("discloses that this is names only, not full mission text", async () => {
    const result = await callTool(client, "determine_primary_mission", {
      your_disposition: "Reconnaissance",
      opponent_disposition: "Priority Assets",
    });
    const text = textOf(result);

    expect(text.toLowerCase()).toContain("not full scoring");
  });
});
