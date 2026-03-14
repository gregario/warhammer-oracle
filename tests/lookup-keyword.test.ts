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

describe("lookup_keyword tool", () => {
  it("is registered and appears in listTools", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "lookup_keyword");
    expect(tool).toBeDefined();
    expect(tool!.description).toBeTruthy();
  });

  it("returns official definition AND plain English for curated keyword", async () => {
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "Devastating Wounds" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Devastating Wounds");
    // Official description
    expect(text).toContain("Critical wounds");
    // Plain English
    expect(text).toContain("skips the enemy's armour save");
  });

  it("returns examples when available", async () => {
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "Devastating Wounds" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Examples");
    expect(text).toContain("weapon with Damage 2");
  });

  it("shows applicable game modes", async () => {
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "Devastating Wounds" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("40k");
    expect(text).toContain("combat_patrol");
  });

  it("falls back to SHARED_RULES for keywords not in curated list", async () => {
    // "Lance" is in SHARED_RULES but not in curated KEYWORDS
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "Lance" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Lance");
    expect(text).toContain("Charge move");
    expect(text).toContain("rules data");
  });

  it("returns friendly message for completely unknown keyword", async () => {
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "Totally Made Up Keyword XYZZY" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("not found");
    expect(text).toContain("Totally Made Up Keyword XYZZY");
  });

  it("performs case insensitive search", async () => {
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "devastating wounds" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Devastating Wounds");
    expect(text).toContain("skips the enemy's armour save");
  });

  it("performs case insensitive search on SHARED_RULES fallback", async () => {
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "lance" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Lance");
  });

  it("filters by game_mode when provided", async () => {
    // Devastating Wounds applies to 40k and combat_patrol, not kill_team
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "Devastating Wounds", game_mode: "kill_team" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    // Should indicate it's not applicable to kill_team
    expect(text).toContain("not applicable to kill_team");
  });

  it("returns curated keyword when game_mode matches", async () => {
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "Devastating Wounds", game_mode: "40k" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Devastating Wounds");
    expect(text).toContain("skips the enemy's armour save");
  });

  it("does not show examples section when keyword has no examples", async () => {
    // "Heavy" has no examples in the curated list
    const result = await client.callTool({
      name: "lookup_keyword",
      arguments: { keyword: "Heavy" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Heavy");
    expect(text).toContain("Stand still and you shoot better");
    expect(text).not.toContain("Examples");
  });
});
