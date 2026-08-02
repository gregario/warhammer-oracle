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

describe("lookup_enhancement", () => {
  it("is registered", async () => {
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "lookup_enhancement")).toBeDefined();
  });

  it("finds an enhancement by name", async () => {
    const result = await client.callTool({
      name: "lookup_enhancement",
      arguments: { name: "Guiding Presence" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Guiding Presence");
    expect(text).toContain("Warhammer 40,000");
    expect(text).toContain("pts");
  });

  it("filters by faction", async () => {
    const result = await client.callTool({
      name: "lookup_enhancement",
      arguments: { name: "Guiding Presence", faction: "Aeldari" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Aeldari");
  });

  it("filters by detachment", async () => {
    const result = await client.callTool({
      name: "lookup_enhancement",
      arguments: { name: "Guiding Presence", detachment: "Armoured Warhost" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Armoured Warhost");
  });

  it("returns helpful message when not found", async () => {
    const result = await client.callTool({
      name: "lookup_enhancement",
      arguments: { name: "xyznonexistent" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("No enhancement found");
  });

  it("defaults to 11th Edition data", async () => {
    const result = await client.callTool({
      name: "lookup_enhancement",
      arguments: { name: "Guiding Presence" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("[Mode: 40k 11e]");
  });

  it("returns 10th Edition data when game_mode is pinned to 40k_10e", async () => {
    const result = await client.callTool({
      name: "lookup_enhancement",
      arguments: { name: "Guiding Presence", game_mode: "40k_10e" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("[Mode: 40k 10e]");
  });
});
