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

describe("compare_units tool", () => {
  it("is registered and appears in listTools", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "compare_units");
    expect(tool).toBeDefined();
    expect(tool!.description).toBeTruthy();
  });

  it("compares 2 units and shows both datasheets", async () => {
    const result = await client.callTool({
      name: "compare_units",
      arguments: { units: ["Abaddon the Despoiler", "Haarken Worldclaimer"] },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Abaddon the Despoiler");
    expect(text).toContain("Haarken Worldclaimer");
    expect(text).toContain("Chaos Space Marines");
  });

  it("shows stats, weapons, abilities for each unit", async () => {
    const result = await client.callTool({
      name: "compare_units",
      arguments: { units: ["Abaddon the Despoiler", "Haarken Worldclaimer"] },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    // Stats
    expect(text).toContain("M");
    expect(text).toContain("T");
    expect(text).toContain("SV");
    // Abaddon weapons
    expect(text).toContain("Talon of Horus");
    expect(text).toContain("Drach'nyen");
    // Haarken weapons
    expect(text).toContain("Hellspear");
    // Abilities
    expect(text).toContain("Abilities");
    expect(text).toContain("The Warmaster");
    // Keywords
    expect(text).toContain("Keywords");
    expect(text).toContain("Terminator");
    expect(text).toContain("Jump Pack");
  });

  it("shows clear separators between units", async () => {
    const result = await client.callTool({
      name: "compare_units",
      arguments: { units: ["Abaddon the Despoiler", "Haarken Worldclaimer"] },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("---");
  });

  it("handles unknown unit name gracefully", async () => {
    const result = await client.callTool({
      name: "compare_units",
      arguments: { units: ["Abaddon the Despoiler", "Totally Fake Unit XYZZY"] },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Totally Fake Unit XYZZY");
    expect(text).toContain("not found");
    // Should still show the found unit
    expect(text).toContain("Abaddon the Despoiler");
    expect(text).toContain("Chaos Space Marines");
  });

  it("handles mix of found and not found units", async () => {
    const result = await client.callTool({
      name: "compare_units",
      arguments: {
        units: ["Abaddon the Despoiler", "Nonexistent Unit A", "Haarken Worldclaimer", "Nonexistent Unit B"],
      },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Nonexistent Unit A");
    expect(text).toContain("Nonexistent Unit B");
    expect(text).toContain("not found");
    expect(text).toContain("Abaddon the Despoiler");
    expect(text).toContain("Haarken Worldclaimer");
  });

  it("returns error when no units found at all", async () => {
    const result = await client.callTool({
      name: "compare_units",
      arguments: { units: ["Fake Unit One", "Fake Unit Two"] },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("No units found");
    expect(result.isError).toBe(true);
  });

  it("works with fuzzy/partial names", async () => {
    const result = await client.callTool({
      name: "compare_units",
      arguments: { units: ["Abaddon", "Haarken"] },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Abaddon the Despoiler");
    expect(text).toContain("Haarken Worldclaimer");
  });
});
