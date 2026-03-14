import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UNITS } from "../data/units.js";
import { KILL_TEAM_OPERATIVES } from "../data/kill-team-operatives.js";
import { fuzzySearch } from "../lib/search.js";
import type {
  Unit,
  UnitProfile,
  RangedWeapon,
  MeleeWeapon,
  Ability,
  KillTeamOperative,
  KillTeamOperativeProfile,
  KillTeamWeapon,
} from "../types.js";

// === 40K Formatters ===

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

// === Kill Team Formatters ===

function formatKTProfile(profile: KillTeamOperativeProfile): string {
  const header = "| Name | APL | Move | Save | Wounds |";
  const separator = "|---|---|---|---|---|";
  const row = `| ${profile.name} | ${profile.apl} | ${profile.movement} | ${profile.save} | ${profile.wounds} |`;
  return [header, separator, row].join("\n");
}

function formatKTWeapons(weapons: KillTeamWeapon[]): string {
  if (weapons.length === 0) return "";
  const ranged = weapons.filter((w) => w.type === "ranged");
  const melee = weapons.filter((w) => w.type === "melee");
  const sections: string[] = [];

  if (ranged.length > 0) {
    const header = "| Weapon | ATK | HIT | DMG | WR |";
    const separator = "|---|---|---|---|---|";
    const rows = ranged.map(
      (w) => `| ${w.name} | ${w.attacks} | ${w.hit} | ${w.damage} | ${w.weaponRules || "-"} |`,
    );
    sections.push(`### Ranged Weapons\n\n${[header, separator, ...rows].join("\n")}`);
  }

  if (melee.length > 0) {
    const header = "| Weapon | ATK | HIT | DMG | WR |";
    const separator = "|---|---|---|---|---|";
    const rows = melee.map(
      (w) => `| ${w.name} | ${w.attacks} | ${w.hit} | ${w.damage} | ${w.weaponRules || "-"} |`,
    );
    sections.push(`### Melee Weapons\n\n${[header, separator, ...rows].join("\n")}`);
  }

  return sections.join("\n\n");
}

function formatKTOperative(op: KillTeamOperative): string {
  const sections: string[] = [];

  sections.push(`## ${op.name}\n\n**Faction:** ${op.faction} | **Game:** Kill Team`);

  sections.push(`### Operative Profile\n\n${formatKTProfile(op.profile)}`);

  const weapons = formatKTWeapons(op.weapons);
  if (weapons) sections.push(weapons);

  const abilities = formatAbilities(op.abilities);
  if (abilities) sections.push(abilities);

  if (op.uniqueActions.length > 0) {
    const lines = op.uniqueActions.map((a) => `- **${a.name}**: ${a.description}`);
    sections.push(`### Unique Actions\n\n${lines.join("\n")}`);
  }

  if (op.keywords.length > 0) {
    sections.push(`### Keywords\n\n${op.keywords.join(", ")}`);
  }

  return sections.join("\n\n");
}

// === Tool Registration ===

export function registerCompareUnits(server: McpServer): void {
  server.tool(
    "compare_units",
    "Compare 2-4 Warhammer 40K units or Kill Team operatives side by side. Shows stats, weapons, abilities, and keywords for each.",
    {
      units: z
        .array(z.string())
        .min(2)
        .max(4)
        .describe("Unit/operative names to compare (2-4 names)"),
      game_mode: z
        .enum(["40k", "combat_patrol", "kill_team"])
        .optional()
        .describe("Game mode: '40k' (default) compares 40K units, 'kill_team' compares Kill Team operatives"),
    },
    async ({ units, game_mode }) => {
      if (game_mode === "kill_team") {
        const found: KillTeamOperative[] = [];
        const notFound: string[] = [];

        for (const name of units) {
          const matches = fuzzySearch(KILL_TEAM_OPERATIVES, name, ["name"]);
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
                text: `No Kill Team operatives found for any of the provided names: ${units.map((n) => `"${n}"`).join(", ")}.\n\nTry partial names or check the spelling.`,
              },
            ],
          };
        }

        const sections: string[] = [];
        sections.push(`# Kill Team Operative Comparison (${found.length} operatives)`);

        if (notFound.length > 0) {
          sections.push(
            `> **Operatives not found:** ${notFound.map((n) => `"${n}"`).join(", ")}. These could not be matched to any known operative.`,
          );
        }

        const opSections = found.map((op) => formatKTOperative(op));
        sections.push(opSections.join("\n\n---\n\n"));

        return {
          content: [
            {
              type: "text" as const,
              text: sections.join("\n\n"),
            },
          ],
        };
      }

      // Default: 40K units
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
