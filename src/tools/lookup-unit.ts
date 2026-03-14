import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UNITS } from "../data/units.js";
import { fuzzySearch } from "../lib/search.js";
import type { Unit, UnitProfile, RangedWeapon, MeleeWeapon, Ability } from "../types.js";

function formatStatsTable(profiles: UnitProfile[]): string {
  const header = "| Name | M | T | SV | W | LD | OC |";
  const separator = "|---|---|---|---|---|---|---|";
  const rows = profiles.map(
    (p) =>
      `| ${p.name} | ${p.movement} | ${p.toughness} | ${p.save} | ${p.wounds} | ${p.leadership} | ${p.objectiveControl} |`,
  );
  return [header, separator, ...rows].join("\n");
}

function formatRangedWeapons(weapons: RangedWeapon[]): string {
  if (weapons.length === 0) return "";
  const header = "| Weapon | Range | A | BS | S | AP | D | Keywords |";
  const separator = "|---|---|---|---|---|---|---|---|";
  const rows = weapons.map(
    (w) =>
      `| ${w.name} | ${w.range} | ${w.attacks} | ${w.ballisticSkill} | ${w.strength} | ${w.armourPenetration} | ${w.damage} | ${w.keywords.join(", ") || "-"} |`,
  );
  return `### Ranged Weapons\n\n${[header, separator, ...rows].join("\n")}`;
}

function formatMeleeWeapons(weapons: MeleeWeapon[]): string {
  if (weapons.length === 0) return "";
  const header = "| Weapon | Range | A | WS | S | AP | D | Keywords |";
  const separator = "|---|---|---|---|---|---|---|---|";
  const rows = weapons.map(
    (w) =>
      `| ${w.name} | ${w.range} | ${w.attacks} | ${w.weaponSkill} | ${w.strength} | ${w.armourPenetration} | ${w.damage} | ${w.keywords.join(", ") || "-"} |`,
  );
  return `### Melee Weapons\n\n${[header, separator, ...rows].join("\n")}`;
}

function formatAbilities(abilities: Ability[]): string {
  if (abilities.length === 0) return "";
  const lines = abilities.map((a) => `- **${a.name}**: ${a.description}`);
  return `### Abilities\n\n${lines.join("\n")}`;
}

function formatUnit(unit: Unit): string {
  const sections: string[] = [];

  // Header
  const pointsStr = unit.points !== null ? ` — ${unit.points} pts` : "";
  sections.push(`# ${unit.name}\n\n**Faction:** ${unit.faction}${pointsStr}`);

  // Stats
  sections.push(`### Unit Profiles\n\n${formatStatsTable(unit.profiles)}`);

  // Weapons
  const ranged = formatRangedWeapons(unit.rangedWeapons);
  if (ranged) sections.push(ranged);

  const melee = formatMeleeWeapons(unit.meleeWeapons);
  if (melee) sections.push(melee);

  // Abilities
  const abilities = formatAbilities(unit.abilities);
  if (abilities) sections.push(abilities);

  // Keywords
  if (unit.keywords.length > 0) {
    sections.push(`### Keywords\n\n${unit.keywords.join(", ")}`);
  }

  return sections.join("\n\n");
}

export function registerLookupUnit(server: McpServer): void {
  server.tool(
    "lookup_unit",
    "Look up a Warhammer 40K unit datasheet by name. Returns stats, weapons, abilities, and keywords.",
    {
      unit_name: z.string().describe("Name or partial name of the unit to search for"),
      faction: z
        .string()
        .optional()
        .describe("Optional faction name to narrow results (e.g. 'Chaos Space Marines', 'Astartes')"),
      game_mode: z
        .enum(["40k", "combat_patrol", "kill_team"])
        .optional()
        .describe("Optional game mode filter (default: all)"),
    },
    async ({ unit_name, faction }) => {
      let candidates = UNITS;

      // Filter by faction first if provided
      if (faction) {
        candidates = fuzzySearch(candidates, faction, ["faction"]);
      }

      // Search by unit name
      const matches = fuzzySearch(candidates, unit_name, ["name"]);

      if (matches.length === 0) {
        const suggestion = faction
          ? `Try a different faction or check the spelling.`
          : `Try a partial name or check the spelling.`;
        return {
          content: [
            {
              type: "text" as const,
              text: `No unit found matching "${unit_name}".${faction ? ` (faction filter: "${faction}")` : ""}\n\n${suggestion}`,
            },
          ],
        };
      }

      // Return the top match
      const unit = matches[0];
      return {
        content: [
          {
            type: "text" as const,
            text: formatUnit(unit),
          },
        ],
      };
    },
  );
}
