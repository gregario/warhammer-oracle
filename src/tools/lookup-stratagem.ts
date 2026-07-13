import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { STRATAGEMS } from "../data/stratagems.js";
import { fuzzySearch } from "../lib/search.js";
import type { Stratagem } from "../types.js";

function formatStratagem(strat: Stratagem): string {
  const sections: string[] = [];

  sections.push(
    `# ${strat.name}\n\n**Game:** Warhammer 40,000 | **Type:** ${strat.type.replace("_", " ")} | **CP:** ${strat.cpCost}`,
  );

  if (strat.faction !== "Core") {
    sections.push(`**Faction:** ${strat.faction} | **Detachment:** ${strat.detachment ?? "—"}`);
  }

  sections.push(`**Phase:** ${strat.phase}`);
  sections.push(`**When:** ${strat.when}`);
  sections.push(`**Target:** ${strat.target}`);
  sections.push(`**Effect:** ${strat.effect}`);

  if (strat.restrictions) {
    sections.push(`**Restrictions:** ${strat.restrictions}`);
  }

  sections.push(
    strat.faction === "Core"
      ? "> Reflects the Warhammer 40,000 11th Edition Core Rules."
      : "> Reflects the Warhammer 40,000 11th Edition faction pack for this detachment. Only a few factions/detachments are covered so far — others may still reflect 10th Edition Codexes or be missing entirely.",
  );

  return sections.join("\n\n");
}

export function registerLookupStratagem(server: McpServer): void {
  server.tool(
    "lookup_stratagem",
    "Look up a Warhammer 40,000 stratagem by name. Returns CP cost, phase, timing, target, and effect. For Kill Team ploys, use lookup_ploy instead.",
    {
      name: z.string().describe("Name or partial name of the stratagem to look up"),
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
    async ({ name, faction, phase, detachment }) => {
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

      const matches = fuzzySearch(candidates, name, ["name"]);

      if (matches.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No Warhammer 40,000 stratagem found matching "${name}".${faction ? ` (faction: "${faction}")` : ""}${phase ? ` (phase: "${phase}")` : ""}\n\nNote: For Kill Team ploys, use the lookup_ploy tool instead.`,
            },
          ],
        };
      }

      // Some stratagem names recur across unrelated factions/detachments (e.g. "Spiteful
      // Demise" exists for both Chaos Daemons and Chaos Knights). When the query is an
      // exact name match against more than one such stratagem, don't silently guess —
      // ask the caller to narrow it down with faction/detachment instead.
      const lowerName = name.trim().toLowerCase();
      const exactMatches = matches.filter((s) => s.name.toLowerCase() === lowerName);
      const pool = exactMatches.length > 0 ? exactMatches : matches;
      const distinctStratagems = new Set(pool.map((s) => `${s.faction}::${s.detachment}`));

      if (exactMatches.length > 1 && distinctStratagems.size > 1) {
        const options = pool
          .map((s) => `- **${s.name}** (${s.faction}${s.detachment ? ` / ${s.detachment}` : ""})`)
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text: `Multiple stratagems named "${pool[0].name}" exist across different factions/detachments. Please narrow the search with \`faction\` or \`detachment\`:\n\n${options}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: formatStratagem(pool[0]),
          },
        ],
      };
    },
  );
}
