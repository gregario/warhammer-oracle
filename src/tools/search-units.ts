import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UNITS } from "../data/units.js";
import { KILL_TEAM_OPERATIVES } from "../data/kill-team-operatives.js";
import { fuzzySearch } from "../lib/search.js";
import type { Unit, KillTeamOperative } from "../types.js";

const MAX_RESULTS = 10;

function formatCompactUnit(unit: Unit): string {
  const pointsStr = unit.points !== null ? `${unit.points}pts` : "pts N/A";
  const keywords = unit.keywords.length > 0 ? unit.keywords.join(", ") : "None";
  return `**${unit.name}** (${unit.faction}) — ${pointsStr} — Keywords: ${keywords}`;
}

function formatCompactOperative(op: KillTeamOperative): string {
  const stats = `APL:${op.profile.apl} Move:${op.profile.movement} Save:${op.profile.save} W:${op.profile.wounds}`;
  const keywords = op.keywords.length > 0 ? op.keywords.join(", ") : "None";
  return `**${op.name}** (${op.faction}) — ${stats} — Keywords: ${keywords}`;
}

export function registerSearchUnits(server: McpServer): void {
  server.tool(
    "search_units",
    "Search Warhammer 40K units or Kill Team operatives by name, faction, or keywords. Returns a compact list of matching results (max 10).",
    {
      query: z.string().describe("Search query — matches against name, faction, and keywords"),
      faction: z
        .string()
        .optional()
        .describe("Optional faction filter to narrow results (e.g. 'Necrons', 'Aeldari')"),
      max_points: z
        .number()
        .optional()
        .describe("Optional max points filter — only return units costing this many points or fewer (40K only)"),
      game_mode: z
        .enum(["40k", "combat_patrol", "kill_team"])
        .optional()
        .describe("Game mode: '40k' (default) searches 40K units, 'kill_team' searches Kill Team operatives"),
    },
    async ({ query, faction, max_points, game_mode }) => {
      if (game_mode === "kill_team") {
        let candidates: KillTeamOperative[] = [...KILL_TEAM_OPERATIVES];

        if (faction) {
          candidates = fuzzySearch(candidates, faction, ["faction"]);
        }

        let matches = fuzzySearch(candidates, query, ["name", "faction", "keywords"]);

        if (matches.length === 0) {
          const filters: string[] = [];
          if (faction) filters.push(`faction: "${faction}"`);
          const filterStr = filters.length > 0 ? ` (filters: ${filters.join(", ")})` : "";
          return {
            content: [
              {
                type: "text" as const,
                text: `No Kill Team operatives found matching "${query}"${filterStr}. Try a broader search term or different filters.`,
              },
            ],
          };
        }

        const total = matches.length;
        const displayed = matches.slice(0, MAX_RESULTS);
        const lines = displayed.map(formatCompactOperative);

        if (total > MAX_RESULTS) {
          lines.push(`\n_Showing ${MAX_RESULTS} of ${total} results. Narrow your search for more specific results._`);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: lines.join("\n"),
            },
          ],
        };
      }

      // Default: 40K units
      let candidates: Unit[] = [...UNITS];

      if (faction) {
        candidates = fuzzySearch(candidates, faction, ["faction"]);
      }

      let matches = fuzzySearch(candidates, query, ["name", "faction", "keywords"]);

      if (max_points !== undefined) {
        matches = matches.filter(
          (u) => u.points !== null && u.points <= max_points,
        );
      }

      if (matches.length === 0) {
        const filters: string[] = [];
        if (faction) filters.push(`faction: "${faction}"`);
        if (max_points !== undefined) filters.push(`max points: ${max_points}`);
        const filterStr = filters.length > 0 ? ` (filters: ${filters.join(", ")})` : "";
        return {
          content: [
            {
              type: "text" as const,
              text: `No units found matching "${query}"${filterStr}. Try a broader search term or different filters.`,
            },
          ],
        };
      }

      const total = matches.length;
      const displayed = matches.slice(0, MAX_RESULTS);
      const lines = displayed.map(formatCompactUnit);

      if (total > MAX_RESULTS) {
        lines.push(`\n_Showing ${MAX_RESULTS} of ${total} results. Narrow your search for more specific results._`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: lines.join("\n"),
          },
        ],
      };
    },
  );
}
