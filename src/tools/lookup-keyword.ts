import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KEYWORDS } from "../data/keywords.js";
import { SHARED_RULES } from "../data/rules.js";
import { fuzzySearch } from "../lib/search.js";
import type { KeywordDefinition, GameMode } from "../types.js";

function formatCuratedKeyword(kw: KeywordDefinition): string {
  const sections: string[] = [];

  sections.push(`# ${kw.name}`);
  sections.push(`**Game Modes:** ${kw.gameModes.join(", ")}`);
  sections.push(`## Official Definition\n\n${kw.description}`);
  sections.push(`## Plain English\n\n${kw.plainEnglish}`);

  if (kw.examples && kw.examples.length > 0) {
    const exampleLines = kw.examples.map((e) => `- ${e}`);
    sections.push(`## Examples\n\n${exampleLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

function formatSharedRule(rule: { name: string; description: string }): string {
  const sections: string[] = [];

  sections.push(`# ${rule.name}`);
  sections.push(
    `*Source: rules data (BSData). A curated plain-English explanation is not yet available for this keyword.*`,
  );
  sections.push(`## Definition\n\n${rule.description}`);

  return sections.join("\n\n");
}

export function registerLookupKeyword(server: McpServer): void {
  server.tool(
    "lookup_keyword",
    "Look up a Warhammer 40K keyword or rule. Returns the official definition, a plain English explanation, examples, and applicable game modes.",
    {
      keyword: z
        .string()
        .describe("Name or partial name of the keyword to look up (e.g. 'Devastating Wounds', 'Feel No Pain')"),
      game_mode: z
        .enum(["40k", "combat_patrol", "kill_team"])
        .optional()
        .describe("Optional game mode filter — only show keywords applicable to this mode"),
    },
    async ({ keyword, game_mode }) => {
      // 1. Search curated KEYWORDS first (fuzzy match on name)
      const allCuratedMatches = fuzzySearch(KEYWORDS, keyword, ["name"]);

      if (allCuratedMatches.length > 0) {
        // Apply game_mode filter if provided
        const filtered = game_mode
          ? allCuratedMatches.filter((kw) =>
              kw.gameModes.includes(game_mode as GameMode),
            )
          : allCuratedMatches;

        if (filtered.length > 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: formatCuratedKeyword(filtered[0]),
              },
            ],
          };
        }

        // Keyword exists in curated list but not for this game mode
        return {
          content: [
            {
              type: "text" as const,
              text: `Keyword "${keyword}" was found but is not applicable to ${game_mode}.\n\nIt applies to: ${allCuratedMatches[0].gameModes.join(", ")}.`,
            },
          ],
        };
      }

      // 2. Fall back to SHARED_RULES (no game_mode filter — rules data doesn't have mode info)
      const ruleMatches = fuzzySearch(SHARED_RULES, keyword, ["name"]);

      if (ruleMatches.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatSharedRule(ruleMatches[0]),
            },
          ],
        };
      }

      // 3. Not found anywhere
      return {
        content: [
          {
            type: "text" as const,
            text: `Keyword "${keyword}" not found in the curated keywords or rules data.\n\nTry a different spelling or a partial name. Some keywords include: Devastating Wounds, Lethal Hits, Feel No Pain, Deep Strike, Invulnerable Save.`,
          },
        ],
      };
    },
  );
}
