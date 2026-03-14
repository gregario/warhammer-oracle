import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TURN_SEQUENCES } from "../data/phases.js";
import type { Phase, GameMode } from "../types.js";

function findPhase(phaseName: string, gameMode: GameMode): Phase | undefined {
  const sequence = TURN_SEQUENCES.find((s) => s.gameMode === gameMode);
  if (!sequence) return undefined;

  const lowerName = phaseName.toLowerCase();

  // Exact match first (case insensitive)
  const exact = sequence.phases.find((p) => p.name.toLowerCase() === lowerName);
  if (exact) return exact;

  // Substring match
  const substring = sequence.phases.find((p) =>
    p.name.toLowerCase().includes(lowerName),
  );
  if (substring) return substring;

  // Reverse substring — query contains the phase name
  const reverseSubstring = sequence.phases.find((p) =>
    lowerName.includes(p.name.toLowerCase()),
  );
  return reverseSubstring;
}

function getAvailablePhases(gameMode: GameMode): string[] {
  const sequence = TURN_SEQUENCES.find((s) => s.gameMode === gameMode);
  if (!sequence) return [];
  return sequence.phases.map((p) => p.name);
}

function formatPhase(phase: Phase): string {
  const sections: string[] = [];

  sections.push(`# ${phase.name} Phase`);
  sections.push(`**Game Mode:** ${phase.gameMode}`);

  // Numbered steps
  const steps = phase.steps.map((s, i) => `${i + 1}. ${s}`);
  sections.push(`## Steps\n\n${steps.join("\n")}`);

  // Tips
  if (phase.tips.length > 0) {
    const tips = phase.tips.map((t) => `- ${t}`);
    sections.push(`## Tips\n\n${tips.join("\n")}`);
  }

  return sections.join("\n\n");
}

export function registerLookupPhase(server: McpServer): void {
  server.tool(
    "lookup_phase",
    "Look up a game phase by name. Returns step-by-step instructions and tips for the phase in the specified game mode.",
    {
      phase_name: z
        .string()
        .describe(
          "Name or partial name of the phase to look up (e.g. 'Shooting', 'Command', 'Firefight')",
        ),
      game_mode: z
        .enum(["40k", "combat_patrol", "kill_team"])
        .optional()
        .default("40k")
        .describe("Game mode (default: 40k). Use kill_team for Kill Team phases."),
    },
    async ({ phase_name, game_mode }) => {
      const mode = game_mode as GameMode;
      const phase = findPhase(phase_name, mode);

      if (!phase) {
        const available = getAvailablePhases(mode);
        return {
          content: [
            {
              type: "text" as const,
              text: `Phase "${phase_name}" not found for ${mode}.\n\nAvailable phases: ${available.join(", ")}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: formatPhase(phase),
          },
        ],
      };
    },
  );
}
