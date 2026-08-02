import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CRUSADE_HONOURS_11E } from "../data/crusade-11e.js";
import { fuzzySearch } from "../lib/search.js";
import { formatModeStamp } from "../lib/format.js";
import type { CrusadeHonour } from "../types.js";

const MAX_RESULTS = 40;

const CATEGORY_LABELS: Record<CrusadeHonour["category"], string> = {
  battleTrait: "Battle Trait",
  relic: "Crusade Relic",
  battleScar: "Battle Scar",
  boon: "Boon",
};

function scopeLabel(h: CrusadeHonour): string {
  if (h.scope === "generic") return "Generic";
  if (h.scope === "faction") return `Faction: ${h.faction}`;
  return `Campaign: ${h.campaign}`;
}

function formatEntry(h: CrusadeHonour): string {
  const tier = h.relicTier ? ` (${h.relicTier})` : "";
  return `**${h.name}**${tier} — _${CATEGORY_LABELS[h.category]}, ${scopeLabel(h)}_\n${h.description}`;
}

export function registerLookupCrusade(server: McpServer): void {
  server.tool(
    "lookup_crusade",
    "Look up Warhammer 40,000 Crusade content: Battle Traits, Crusade Relics, Battle Scars, and Boon tables. " +
      "Covers all three tiers BSData tracks — generic/universal (e.g. Battle Scars), faction-specific " +
      "(e.g. Chaos Space Marines' Codex Battle Traits), and campaign-specific (Tyrannic War, Pariah Nexus, " +
      "Nachmund Gauntlet, Armageddon). 11th Edition only — this content isn't tracked in BSData for 10th " +
      "Edition. Not merged into unit datasheets: pass `faction` to see everything a Crusade army of that " +
      "faction can pick from (generic + that faction's own), and/or `campaign` to add a campaign's pool. " +
      "At least one of faction, campaign, category, or name is required.",
    {
      faction: z
        .string()
        .optional()
        .describe("Faction filter (e.g. 'Chaos Space Marines') — returns generic honours plus this faction's own"),
      campaign: z
        .string()
        .optional()
        .describe("Campaign filter (e.g. 'Tyrannic War', 'Armageddon', 'Pariah Nexus', 'Nachmund Gauntlet')"),
      category: z
        .enum(["battleTrait", "relic", "battleScar", "boon"])
        .optional()
        .describe("Narrow to one content type: battleTrait, relic (Crusade Relic), battleScar, or boon"),
      name: z.string().optional().describe("Search by name or description text"),
    },
    async ({ faction, campaign, category, name }) => {
      if (!faction && !campaign && !category && !name) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `${formatModeStamp("wh40k-11e")}\n\n` +
                "Provide at least one of `faction`, `campaign`, `category`, or `name` to narrow the search " +
                `(${CRUSADE_HONOURS_11E.length} Crusade Honours total — too many to list unfiltered).\n\n` +
                "Examples: faction=\"Chaos Space Marines\", campaign=\"Tyrannic War\", category=\"battleScar\".",
            },
          ],
        };
      }

      let candidates: CrusadeHonour[] = [...CRUSADE_HONOURS_11E];

      if (faction) {
        candidates = candidates.filter(
          (h) => h.scope === "generic" || (h.scope === "faction" && h.faction?.toLowerCase().includes(faction.toLowerCase())),
        );
      }
      if (campaign) {
        candidates = candidates.filter(
          (h) => h.scope !== "campaign" || h.campaign?.toLowerCase().includes(campaign.toLowerCase()),
        );
        // If campaign was the only scoping filter, drop the (otherwise-unfiltered) faction/generic noise.
        if (!faction) {
          candidates = candidates.filter((h) => h.scope === "campaign");
        }
      }
      if (category) {
        candidates = candidates.filter((h) => h.category === category);
      }
      if (name) {
        candidates = fuzzySearch(candidates, name, ["name", "description"]);
      }

      if (candidates.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No Crusade content found.${faction ? ` (faction: "${faction}")` : ""}${campaign ? ` (campaign: "${campaign}")` : ""}${category ? ` (category: "${category}")` : ""}${name ? ` (name: "${name}")` : ""}`,
            },
          ],
        };
      }

      const limited = candidates.slice(0, MAX_RESULTS);
      const grouped = new Map<string, CrusadeHonour[]>();
      for (const h of limited) {
        const key = scopeLabel(h);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(h);
      }

      const sections = [...grouped.entries()].map(
        ([group, items]) => `### ${group}\n\n${items.map(formatEntry).join("\n\n")}`,
      );

      const footer =
        candidates.length > MAX_RESULTS
          ? `\n\n_Showing ${MAX_RESULTS} of ${candidates.length} results. Narrow your search for more specific results._`
          : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `${formatModeStamp("wh40k-11e")}\n\n` + sections.join("\n\n") + footer,
          },
        ],
      };
    },
  );
}
