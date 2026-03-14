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

describe("lookup_unit tool", () => {
  it("is registered and appears in listTools", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "lookup_unit");
    expect(tool).toBeDefined();
    expect(tool!.description).toBeTruthy();
  });

  it("returns a datasheet for a known unit", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Abaddon the Despoiler" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Abaddon the Despoiler");
    expect(text).toContain("Chaos Space Marines");
    expect(text).toContain("270");
  });

  it("shows unit stats (M, T, SV, W, LD, OC)", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Abaddon the Despoiler" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("M");
    expect(text).toContain("T");
    expect(text).toContain("SV");
    expect(text).toContain("W");
    expect(text).toContain("LD");
    expect(text).toContain("OC");
    // Actual stat values
    expect(text).toContain("5\""); // movement
    expect(text).toContain("2+"); // save
    expect(text).toContain("9"); // wounds
  });

  it("shows ranged weapons", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Abaddon the Despoiler" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Ranged Weapons");
    expect(text).toContain("Talon of Horus");
    expect(text).toContain("24\"");
    expect(text).toContain("Sustained Hits 1");
  });

  it("shows melee weapons", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Abaddon the Despoiler" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Melee Weapons");
    expect(text).toContain("Drach'nyen");
    expect(text).toContain("Devastating Wounds");
  });

  it("shows abilities", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Abaddon the Despoiler" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Abilities");
    expect(text).toContain("The Warmaster");
    expect(text).toContain("Dark Destiny");
  });

  it("shows keywords", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Abaddon the Despoiler" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Keywords");
    expect(text).toContain("Terminator");
    expect(text).toContain("Epic Hero");
  });

  it("returns friendly message for unknown unit", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Totally Fake Unit Name XYZZY" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("No unit found");
    expect(text).toContain("Totally Fake Unit Name XYZZY");
  });

  it("fuzzy matches partial names", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Abaddon" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Abaddon the Despoiler");
  });

  it("filters by faction when provided", async () => {
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Infernus Squad", faction: "Astartes" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Infernus Squad");
    expect(text).toContain("Adeptus Astartes");
  });

  it("faction filter narrows results", async () => {
    // Searching with a wrong faction should yield no results
    const result = await client.callTool({
      name: "lookup_unit",
      arguments: { unit_name: "Abaddon", faction: "T'au" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("No unit found");
  });
});
