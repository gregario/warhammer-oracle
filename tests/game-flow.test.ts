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

describe("game_flow", () => {
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
    expect(names).toContain("game_flow");
  });

  it("no args returns full 40k turn sequence overview", async () => {
    const result = await callTool(client, "game_flow", {});
    const text = textOf(result);

    expect(text).toContain("40k");
    // Should contain all 5 phases
    expect(text).toContain("Command");
    expect(text).toContain("Movement");
    expect(text).toContain("Shooting");
    expect(text).toContain("Charge");
    expect(text).toContain("Fight");
  });

  it("shows all phase names in order", async () => {
    const result = await callTool(client, "game_flow", {});
    const text = textOf(result);

    const commandIdx = text.indexOf("Command");
    const movementIdx = text.indexOf("Movement");
    const shootingIdx = text.indexOf("Shooting");
    const chargeIdx = text.indexOf("Charge");
    const fightIdx = text.indexOf("Fight");

    expect(commandIdx).toBeLessThan(movementIdx);
    expect(movementIdx).toBeLessThan(shootingIdx);
    expect(shootingIdx).toBeLessThan(chargeIdx);
    expect(chargeIdx).toBeLessThan(fightIdx);
  });

  it("with current_phase highlights that phase and shows what's next", async () => {
    const result = await callTool(client, "game_flow", { current_phase: "Shooting" });
    const text = textOf(result);

    expect(text).toContain("YOU ARE HERE");
    expect(text).toContain("Shooting");
    // Should indicate Charge is next
    expect(text).toContain("Charge");
    expect(text).toMatch(/next/i);
  });

  it("game_mode switches to kill_team", async () => {
    const result = await callTool(client, "game_flow", { game_mode: "kill_team" });
    const text = textOf(result);

    expect(text).toContain("kill_team");
    expect(text).toContain("Initiative");
    expect(text).toContain("Strategy");
    expect(text).toContain("Firefight");
    // Should NOT contain 40k-only phases
    expect(text).not.toContain("Charge");
  });

  it("game_mode switches to combat_patrol", async () => {
    const result = await callTool(client, "game_flow", { game_mode: "combat_patrol" });
    const text = textOf(result);

    expect(text).toContain("combat_patrol");
    expect(text).toContain("Command");
    expect(text).toContain("Movement");
    expect(text).toContain("Shooting");
    expect(text).toContain("Charge");
    expect(text).toContain("Fight");
  });

  it("unknown current_phase returns helpful message", async () => {
    const result = await callTool(client, "game_flow", { current_phase: "Psychic" });
    const text = textOf(result);

    expect(text).toContain("not found");
    // Should list available phases so the user knows what to try
    expect(text).toContain("Command");
    expect(text).toContain("Movement");
    expect(text).toContain("Shooting");
  });

  it("current_phase is case insensitive", async () => {
    const result = await callTool(client, "game_flow", { current_phase: "shooting" });
    const text = textOf(result);

    expect(text).toContain("YOU ARE HERE");
    expect(text).toContain("Shooting");
  });

  it("highlights last phase and indicates turn ends", async () => {
    const result = await callTool(client, "game_flow", { current_phase: "Fight" });
    const text = textOf(result);

    expect(text).toContain("YOU ARE HERE");
    expect(text).toContain("Fight");
    // After the last phase, should indicate turn wraps around or ends
    expect(text).toMatch(/new turn|next turn|turn ends|back to/i);
  });

  it("includes brief descriptions for each phase in overview", async () => {
    const result = await callTool(client, "game_flow", {});
    const text = textOf(result);

    // Each phase should have some descriptive text, not just the name
    // Check for a step snippet from at least one phase
    expect(text).toContain("CP");
  });
});
