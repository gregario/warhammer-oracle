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

describe("lookup_unit with kill_team game_mode", () => {
  it("finds a Kill Team operative", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Space Marine Captain", game_mode: "kill_team" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Space Marine Captain");
    expect(text).toContain("Kill Team");
    expect(text).toContain("APL");
    expect(text).toContain("Move");
    expect(text).toContain("Save");
    expect(text).toContain("Wounds");
  });

  it("shows Kill Team weapons with ATK/HIT/DMG format", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Space Marine Captain", game_mode: "kill_team" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("ATK");
    expect(text).toContain("HIT");
    expect(text).toContain("DMG");
  });

  it("returns not found for nonexistent operative", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Totally Fake Operative XYZZY", game_mode: "kill_team" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("No Kill Team operative found");
  });

  it("does not return Kill Team operatives in default 40K mode", async () => {
    // Use a unit name that exists in 40K but also sounds like it could be KT
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Intercessor" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    // Should find a 40K unit, not a KT operative
    expect(text).not.toContain("Kill Team");
    // Should have 40K stat headers
    expect(text).toContain("OC");
  });

  it("supports faction filter in kill_team mode", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Captain", faction: "Angels of Death", game_mode: "kill_team" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Angels of Death");
  });
});

describe("search_units with kill_team game_mode", () => {
  it("searches Kill Team operatives", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Kommando", game_mode: "kill_team" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Kommandos");
    // Should show KT stats format
    expect(text).toContain("APL:");
    expect(text).toContain("Move:");
  });

  it("returns not found for nonexistent query", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Totally Fake XYZZY", game_mode: "kill_team" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("No Kill Team operatives found");
  });

  it("does not return Kill Team operatives in default mode", async () => {
    const result = await client.callTool({
      name: "search_units",
      arguments: { query: "Kommando" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    // Should search 40K units, not KT operatives
    expect(text).not.toContain("APL:");
  });
});

describe("compare_units with kill_team game_mode", () => {
  it("compares Kill Team operatives", async () => {
    const result = await client.callTool({
      name: "compare_units",
      arguments: {
        units: ["Space Marine Captain", "Assault Intercessor Sergeant"],
        game_mode: "kill_team",
      },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Space Marine Captain");
    expect(text).toContain("Assault Intercessor Sergeant");
    expect(text).toContain("Kill Team");
    expect(text).toContain("---");
  });

  it("returns error when no operatives found", async () => {
    const result = await client.callTool({
      name: "compare_units",
      arguments: {
        units: ["Fake Operative A", "Fake Operative B"],
        game_mode: "kill_team",
      },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("No Kill Team operatives found");
    expect(result.isError).toBe(true);
  });
});
