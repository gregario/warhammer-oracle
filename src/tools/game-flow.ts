import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TURN_SEQUENCES } from "../data/phases.js";
import type { GameMode, Phase } from "../types.js";

/** Brief one-line summary of a phase for the overview listing. */
function phaseSummary(phase: Phase): string {
  // Use the first step as a concise description
  return phase.steps[0];
}

function findPhaseIndex(phaseName: string, phases: Phase[]): number {
  const lower = phaseName.toLowerCase();

  // Exact match (case insensitive)
  const exact = phases.findIndex((p) => p.name.toLowerCase() === lower);
  if (exact !== -1) return exact;

  // Substring match
  const substring = phases.findIndex((p) =>
    p.name.toLowerCase().includes(lower),
  );
  if (substring !== -1) return substring;

  // Reverse substring
  const reverse = phases.findIndex((p) =>
    lower.includes(p.name.toLowerCase()),
  );
  return reverse;
}

function formatOverview(phases: Phase[], gameMode: GameMode): string {
  const lines: string[] = [];
  lines.push(`# Turn Sequence — ${gameMode}`);
  lines.push("");

  for (const phase of phases) {
    lines.push(`## ${phase.order}. ${phase.name} Phase`);
    lines.push(phaseSummary(phase));
    lines.push("");
  }

  return lines.join("\n");
}

function formatCurrentPhase(
  phases: Phase[],
  currentIndex: number,
  gameMode: GameMode,
): string {
  const lines: string[] = [];
  lines.push(`# Turn Sequence — ${gameMode}`);
  lines.push("");

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    if (i === currentIndex) {
      lines.push(`## → YOU ARE HERE: ${phase.name} Phase`);
      lines.push(phaseSummary(phase));
    } else if (i < currentIndex) {
      lines.push(`## ~~${phase.order}. ${phase.name} Phase~~ ✓`);
    } else if (i === currentIndex + 1) {
      lines.push(`## **Next → ${phase.name} Phase**`);
      lines.push(phaseSummary(phase));
    } else {
      lines.push(`## ${phase.order}. ${phase.name} Phase`);
    }
    lines.push("");
  }

  // If on the last phase, note that the turn wraps
  if (currentIndex === phases.length - 1) {
    lines.push(
      "---\nAfter this phase, the turn ends. Your opponent takes their turn, then it's back to the **Command Phase** for a new turn.",
    );
  }

  return lines.join("\n");
}

export function registerGameFlow(server: McpServer): void {
  server.tool(
    "game_flow",
    "Show the full turn sequence for a game mode, or highlight the current phase and what comes next.",
    {
      current_phase: z
        .string()
        .optional()
        .describe(
          "Name of the phase you're currently in (e.g. 'Shooting', 'Command'). If omitted, shows the full turn sequence overview.",
        ),
      game_mode: z
        .enum(["40k", "combat_patrol", "kill_team"])
        .optional()
        .default("40k")
        .describe(
          "Game mode (default: 40k). Use kill_team for Kill Team phases.",
        ),
    },
    async ({ current_phase, game_mode }) => {
      const mode = game_mode as GameMode;
      const sequence = TURN_SEQUENCES.find((s) => s.gameMode === mode);

      if (!sequence) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown game mode "${mode}". Available modes: 40k, combat_patrol, kill_team.`,
            },
          ],
        };
      }

      // No current phase — show full overview
      if (!current_phase) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatOverview(sequence.phases, mode),
            },
          ],
        };
      }

      // Find the current phase
      const idx = findPhaseIndex(current_phase, sequence.phases);
      if (idx === -1) {
        const available = sequence.phases.map((p) => p.name);
        return {
          content: [
            {
              type: "text" as const,
              text: `Phase "${current_phase}" not found for ${mode}.\n\nAvailable phases: ${available.join(", ")}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: formatCurrentPhase(sequence.phases, idx, mode),
          },
        ],
      };
    },
  );
}
