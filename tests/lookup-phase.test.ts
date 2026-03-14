import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

function callTool(client: Client, name: string, args: Record<string, unknown>) {
  return client.callTool({ name, arguments: args });
}

function textOf(result: Awaited<ReturnType<typeof callTool>>): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content.map((c) => c.text).join("\n");
}

describe("lookup_phase", () => {
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
    expect(names).toContain("lookup_phase");
  });

  it("returns Shooting phase step-by-step for 40k by default", async () => {
    const result = await callTool(client, "lookup_phase", { phase_name: "Shooting" });
    const text = textOf(result);

    expect(text).toContain("Shooting");
    // Should have numbered steps
    expect(text).toMatch(/1\./);
    expect(text).toMatch(/2\./);
    // Should mention a specific step from the 40k shooting phase
    expect(text).toContain("Roll to hit");
  });

  it("formats steps as a numbered list", async () => {
    const result = await callTool(client, "lookup_phase", { phase_name: "Command" });
    const text = textOf(result);

    expect(text).toMatch(/1\.\s/);
    expect(text).toMatch(/2\.\s/);
    expect(text).toMatch(/3\.\s/);
  });

  it("includes tips section", async () => {
    const result = await callTool(client, "lookup_phase", { phase_name: "Shooting" });
    const text = textOf(result);

    expect(text).toContain("Tips");
    // A specific tip from the 40k shooting phase
    expect(text).toContain("split fire");
  });

  it("switches to kill_team phases", async () => {
    const result = await callTool(client, "lookup_phase", {
      phase_name: "Firefight",
      game_mode: "kill_team",
    });
    const text = textOf(result);

    expect(text).toContain("Firefight");
    expect(text).toContain("Action Points");
  });

  it("switches to combat_patrol phases", async () => {
    const result = await callTool(client, "lookup_phase", {
      phase_name: "Shooting",
      game_mode: "combat_patrol",
    });
    const text = textOf(result);

    expect(text).toContain("Shooting");
    // Combat patrol specific tip
    expect(text).toContain("smaller armies");
  });

  it("returns helpful message with available phases for unknown phase", async () => {
    const result = await callTool(client, "lookup_phase", { phase_name: "Psychic" });
    const text = textOf(result);

    expect(text).toContain("not found");
    // Should list available phases
    expect(text).toContain("Command");
    expect(text).toContain("Movement");
    expect(text).toContain("Shooting");
  });

  it("is case insensitive", async () => {
    const result = await callTool(client, "lookup_phase", { phase_name: "shooting" });
    const text = textOf(result);

    expect(text).toContain("Shooting");
    expect(text).toMatch(/1\./);
  });

  it("matches partial/substring phase names", async () => {
    const result = await callTool(client, "lookup_phase", { phase_name: "fight" });
    const text = textOf(result);

    expect(text).toContain("Fight");
    expect(text).toContain("Pile in");
  });

  it("shows game mode in the output", async () => {
    const result = await callTool(client, "lookup_phase", {
      phase_name: "Initiative",
      game_mode: "kill_team",
    });
    const text = textOf(result);

    expect(text).toContain("kill_team");
  });
});
