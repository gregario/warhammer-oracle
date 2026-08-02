import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { STRATAGEMS } from "../data/stratagems.js";
import { fuzzySearch } from "../lib/search.js";
import type { Stratagem } from "../types.js";

function formatCompact(strat: Stratagem): string {
  const detStr = strat.detachment ? ` [${strat.detachment}]` : "";
  return `**${strat.name}** (${strat.faction}${detStr}) — ${strat.cpCost} CP | ${strat.phase} | ${strat.type.replace("_", " ")}`;
}

export function registerSearchStratagems(server: McpServer): void {
  server.tool(
    "search_stratagems",
    "Search Warhammer 40,000 stratagems by name, faction, phase, or detachment. Returns a compact list (max 10). For Kill Team ploys, use lookup_ploy instead.",
    {
      query: z.string().describe("Search query — matches against name, faction, phase, and effect"),
      faction: z
        .string()
        .optional()
        .describe("Optional faction filter (e.g. 'Core', 'Adeptus Astartes')"),
      phase: z
        .string()
        .optional()
        .describe("Optional phase filter (e.g. 'Fight phase', 'Shooting')"),
      detachment: z
        .string()
        .optional()
        .describe("Optional detachment filter (e.g. 'Gladius Task Force')"),
    },
    async ({ query, faction, phase, detachment }) => {
      let candidates: Stratagem[] = [...STRATAGEMS];

      if (faction) {
        candidates = fuzzySearch(candidates, faction, ["faction"]);
      }
      if (phase) {
        candidates = fuzzySearch(candidates, phase, ["phase"]);
      }
      if (detachment) {
        candidates = candidates.filter(
          (s) => s.detachment && s.detachment.toLowerCase().includes(detachment.toLowerCase()),
        );
      }

      const matches = fuzzySearch(candidates, query, ["name", "effect", "phase"]);
      const limited = matches.slice(0, 10);

      if (limited.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No Warhammer 40,000 stratagems found matching "${query}".${faction ? ` (faction: "${faction}")` : ""}\n\nNote: For Kill Team ploys, use the lookup_ploy tool instead.`,
            },
          ],
        };
      }

      const header =
        "**Game:** Warhammer 40,000\n\n> Core stratagems reflect the 11th Edition Core Rules. Detachment-specific stratagems reflect 11th Edition faction packs where available (currently Space Marines, Chaos Space Marines) — other factions may still be on 10th Edition Codexes or missing entirely.\n\n";
      const lines = limited.map(formatCompact);
      const footer =
        matches.length > 10
          ? `\n\n_Showing 10 of ${matches.length} results. Narrow your search for more specific results._`
          : "";

      return {
        content: [
          {
            type: "text" as const,
            text: header + lines.join("\n") + footer,
          },
        ],
      };
    },
  );
}
