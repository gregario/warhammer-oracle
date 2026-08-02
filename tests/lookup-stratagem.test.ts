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

describe("lookup_stratagem", () => {
  it("is registered", async () => {
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "lookup_stratagem")).toBeDefined();
  });

  it("finds a core stratagem by name", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Command Re-roll" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Command Re-Roll");
    expect(text).toContain("1");
    expect(text).toContain("Warhammer 40,000");
  });

  it("always includes game mode label", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Fire Overwatch" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Warhammer 40,000");
  });

  it("filters by faction", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Honour the Chapter", faction: "Adeptus Astartes" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Honour the Chapter");
    expect(text).toContain("Adeptus Astartes");
  });

  it("suggests lookup_ploy for not found", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "xyznonexistent" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("lookup_ploy");
  });

  it("asks for disambiguation when an exact name collides across factions", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Spiteful Demise" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Multiple stratagems named");
    expect(text).toContain("Legiones Daemonica");
    expect(text).toContain("Chaos Knights");
  });

  it("resolves a name collision when disambiguated by faction", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Spiteful Demise", faction: "Chaos Knights" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Spiteful Demise");
    expect(text).toContain("Chaos Knights");
    expect(text).not.toContain("Multiple stratagems named");
  });
});
