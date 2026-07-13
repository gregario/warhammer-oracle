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

describe("lookup_detachment", () => {
  it("is registered", async () => {
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "lookup_detachment")).toBeDefined();
  });

  it("finds a detachment by name", async () => {
    const result = await client.callTool({
      name: "lookup_detachment",
      arguments: { name: "Gladius Task Force" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Gladius Task Force");
    expect(text).toContain("Warhammer 40,000");
    expect(text).toContain("Detachment Ability");
  });

  it("filters by faction", async () => {
    const result = await client.callTool({
      name: "lookup_detachment",
      arguments: { name: "Warhost", faction: "Aeldari" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Aeldari");
  });

  it("shows enhancements when available", async () => {
    const result = await client.callTool({
      name: "lookup_detachment",
      arguments: { name: "Warhost", faction: "Aeldari" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Enhancements");
  });

  it("returns helpful message when not found", async () => {
    const result = await client.callTool({
      name: "lookup_detachment",
      arguments: { name: "xyznonexistent" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("No detachment found");
  });

  it("defaults to 11th Edition and notes detachment stratagems aren't checked yet", async () => {
    const result = await client.callTool({
      name: "lookup_detachment",
      arguments: { name: "Gladius Task Force" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("[Mode: 40k 11e]");
    expect(text).toContain("only a few 11th Edition factions/detachments are covered so far");
  });

  it("returns 10th Edition stratagems when game_mode is pinned to 40k_10e", async () => {
    const result = await client.callTool({
      name: "lookup_detachment",
      arguments: { name: "Gladius Task Force", game_mode: "40k_10e" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("[Mode: 40k 10e]");
  });
});
