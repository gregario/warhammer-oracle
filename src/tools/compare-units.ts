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

  const pointsStr = unit.points !== null ? ` — ${unit.points} pts` : "";
  sections.push(`## ${unit.name}\n\n**Faction:** ${unit.faction}${pointsStr}`);

  sections.push(`### Unit Profiles\n\n${formatStatsTable(unit.profiles)}`);

  const ranged = formatRangedWeapons(unit.rangedWeapons);
  if (ranged) sections.push(ranged);

  const melee = formatMeleeWeapons(unit.meleeWeapons);
  if (melee) sections.push(melee);

  const abilities = formatAbilities(unit.abilities);
  if (abilities) sections.push(abilities);

  if (unit.keywords.length > 0) {
    sections.push(`### Keywords\n\n${unit.keywords.join(", ")}`);
  }

  return sections.join("\n\n");
}

export function registerCompareUnits(server: McpServer): void {
  server.tool(
    "compare_units",
    "Compare 2-4 Warhammer 40K units side by side. Shows stats, weapons, abilities, and keywords for each unit.",
    {
      units: z
        .array(z.string())
        .min(2)
        .max(4)
        .describe("Unit names to compare (2-4 names)"),
    },
    async ({ units }) => {
      const found: Unit[] = [];
      const notFound: string[] = [];

      for (const name of units) {
        const matches = fuzzySearch(UNITS, name, ["name"]);
        if (matches.length > 0) {
          found.push(matches[0]);
        } else {
          notFound.push(name);
        }
      }

      if (found.length === 0) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `No units found for any of the provided names: ${units.map((n) => `"${n}"`).join(", ")}.\n\nTry partial names or check the spelling.`,
            },
          ],
        };
      }

      const sections: string[] = [];

      sections.push(`# Unit Comparison (${found.length} units)`);

      if (notFound.length > 0) {
        sections.push(
          `> **Units not found:** ${notFound.map((n) => `"${n}"`).join(", ")}. These could not be matched to any known unit.`,
        );
      }

      const unitSections = found.map((unit) => formatUnit(unit));
      sections.push(unitSections.join("\n\n---\n\n"));

      return {
        content: [
          {
            type: "text" as const,
            text: sections.join("\n\n"),
          },
        ],
      };
    },
  );
}
