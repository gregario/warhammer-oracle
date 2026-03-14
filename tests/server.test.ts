import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

const EXPECTED_TOOLS = [
  "lookup_unit",
  "lookup_keyword",
  "lookup_phase",
  "search_units",
  "compare_units",
  "game_flow",
] as const;

describe("server integration", () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer();
    client = new Client({ name: "test-client", version: "1.0.0" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(ct), server.connect(st)]);
  });

  it("creates a server without error", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it("registers exactly 6 tools", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(6);
  });

  it("registers all expected tool names", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("every tool has a description", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description, `${tool.name} should have a description`).toBeTruthy();
    }
  });

  describe("smoke tests — each tool responds without error", () => {
    it("lookup_unit", async () => {
      const result = await client.callTool({
        name: "lookup_unit",
        arguments: { unit_name: "Abaddon the Despoiler" },
      });
      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
    });

    it("lookup_keyword", async () => {
      const result = await client.callTool({
        name: "lookup_keyword",
        arguments: { keyword: "Deadly Demise" },
      });
      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
    });

    it("lookup_phase", async () => {
      const result = await client.callTool({
        name: "lookup_phase",
        arguments: { phase_name: "Shooting" },
      });
      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
    });

    it("search_units", async () => {
      const result = await client.callTool({
        name: "search_units",
        arguments: { query: "chaos" },
      });
      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
    });

    it("compare_units", async () => {
      const result = await client.callTool({
        name: "compare_units",
        arguments: { units: ["Abaddon the Despoiler", "Haarken Worldclaimer"] },
      });
      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
    });

    it("game_flow", async () => {
      const result = await client.callTool({
        name: "game_flow",
        arguments: {},
      });
      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
    });
  });
});
