import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ENHANCEMENTS } from "../data/enhancements.js";
import { ENHANCEMENTS_11E } from "../data/enhancements-11e.js";
import { fuzzySearch } from "../lib/search.js";
import { formatModeStamp } from "../lib/format.js";
import type { Enhancement, GameSystem } from "../types.js";

function formatEnhancement(enh: Enhancement, gameSystem: GameSystem): string {
  const sections: string[] = [];

  sections.push(formatModeStamp(gameSystem));

  const ptsStr = enh.points !== null ? `${enh.points} pts` : "?? pts";
  sections.push(
    `# ${enh.name}\n\n**Game:** Warhammer 40,000 | **Faction:** ${enh.faction} | **Detachment:** ${enh.detachment} | **Cost:** ${ptsStr}`,
  );

  sections.push(`### Effect\n\n${enh.description}`);

  return sections.join("\n\n");
}

export function registerLookupEnhancement(server: McpServer): void {
  server.tool(
    "lookup_enhancement",
    "Look up a Warhammer 40,000 enhancement by name. Returns the points cost, detachment, and effect.",
    {
      name: z.string().describe("Name or partial name of the enhancement to look up"),
      faction: z
        .string()
        .optional()
        .describe("Optional faction filter (e.g. 'Space Marines', 'Aeldari')"),
      detachment: z
        .string()
        .optional()
        .describe("Optional detachment filter (e.g. 'Gladius Task Force')"),
      game_mode: z
        .enum(["40k", "40k_10e", "40k_11e"])
        .optional()
        .describe(
          "Edition: defaults to '40k_11e'. Pass '40k_10e' for 10th Edition enhancements, " +
            "'40k'/'40k_11e' for 11th Edition (current default).",
        ),
    },
    async ({ name, faction, detachment, game_mode }) => {
      const gameSystem: GameSystem = game_mode === "40k_10e" ? "wh40k-10e" : "wh40k-11e";
      const pool = gameSystem === "wh40k-10e" ? ENHANCEMENTS : ENHANCEMENTS_11E;
      let candidates: Enhancement[] = [...pool];

      if (faction) {
        candidates = fuzzySearch(candidates, faction, ["faction"]);
      }
      if (detachment) {
        candidates = fuzzySearch(candidates, detachment, ["detachment"]);
      }

      const matches = fuzzySearch(candidates, name, ["name"]);

      if (matches.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No enhancement found matching "${name}".${faction ? ` (faction: "${faction}")` : ""}${detachment ? ` (detachment: "${detachment}")` : ""}\n\nTry a partial name or check the faction/detachment spelling.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: formatEnhancement(matches[0], gameSystem),
          },
        ],
      };
    },
  );
}
