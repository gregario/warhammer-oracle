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

describe("lookup_crusade", () => {
  it("is registered", async () => {
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "lookup_crusade")).toBeDefined();
  });

  it("requires at least one filter", async () => {
    const result = await client.callTool({ name: "lookup_crusade", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Provide at least one of");
  });

  it("returns a faction's own Codex Battle Traits plus generic content when filtered by faction", async () => {
    const result = await client.callTool({
      name: "lookup_crusade",
      arguments: { faction: "Chaos Space Marines", name: "Living Hull" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Living Hull");
    expect(text).toContain("Chaos Space Marines");
    expect(text).toContain("Wounds characteristic");
    expect(text).toContain("[Mode: 40k 11e]");
  });

  it("does not leak another faction's Battle Traits into a faction-filtered query", async () => {
    const result = await client.callTool({
      name: "lookup_crusade",
      arguments: { faction: "Chaos Space Marines", name: "Living Hull" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    // "Living Hull" is CSM-only; a different faction's same-named trait would be a bug.
    expect(text.match(/Living Hull/g)?.length).toBe(1);
  });

  it("filters by campaign", async () => {
    const result = await client.callTool({
      name: "lookup_crusade",
      arguments: { campaign: "Tyrannic War", category: "battleTrait" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Tyrannic War");
    expect(text).toContain("Battle Trait");
  });

  it("filters by category alone (generic Battle Scars)", async () => {
    const result = await client.callTool({
      name: "lookup_crusade",
      arguments: { category: "battleScar" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Generic");
    expect(text).toContain("Battle Scar");
  });

  it("searches by name across all scopes", async () => {
    const result = await client.callTool({
      name: "lookup_crusade",
      arguments: { name: "Warp Stalker" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Warp Stalker");
    expect(text).toContain("Boon");
  });

  it("returns a not-found message for a nonexistent name", async () => {
    const result = await client.callTool({
      name: "lookup_crusade",
      arguments: { name: "Totally Fake Honour XYZZY" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("No Crusade content found");
  });
});
