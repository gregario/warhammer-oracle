import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UNITS } from "../data/units.js";
import { UNITS_11E } from "../data/units-11e.js";
import { KILL_TEAM_OPERATIVES } from "../data/kill-team-operatives.js";
import { fuzzySearch } from "../lib/search.js";
import {
  rankUnitMatches,
  matchUnitsWithFactionHint,
  ambiguousFactionMatches,
  datasheetContentKey,
  resolveHomeDatasheet,
} from "../lib/unit-match.js";
import type { HomeDatasheetResolution } from "../lib/unit-match.js";
import { formatModeStamp, formatUnitSize } from "../lib/format.js";
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

  // Header
  const pointsStr = unit.points !== null ? ` — ${unit.points} pts` : "";
  sections.push(
    `# ${unit.name}\n\n**Faction:** ${unit.faction}${pointsStr} | **Unit Size:** ${formatUnitSize(unit.unitSize)}`,
  );

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

  sections.push(`# ${op.name}\n\n**Faction:** ${op.faction} | **Game:** Kill Team`);

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

function formatFactionDisambiguation(
  name: string,
  options: { name: string; faction: string; id: string }[],
): string {
  const counts = new Map<string, number>();
  for (const option of options) counts.set(option.faction, (counts.get(option.faction) ?? 0) + 1);
  const needsId = [...counts.values()].some((count) => count > 1);
  const list = options
    .map((o) => `- **${o.name}** (${o.faction})${(counts.get(o.faction) ?? 0) > 1 ? ` — datasheet_id: \`${o.id}\`` : ""}`)
    .join("\n");
  return (
    `"${name}" is more than one datasheet with different stats, weapons, abilities, points, or other details. ` +
    `Re-run \`lookup_unit\` with the \`faction\` argument${needsId ? " and \`datasheet_id\` when shown" : ""} set to one of:\n\n${list}`
  );
}

/** "Adeptus Astartes - Ultramarines" → "Ultramarines"; short enough to read aloud. */
function shortFaction(faction: string): string {
  return faction.replace(/^Adeptus Astartes - /, "");
}

function listFactions(factions: string[]): string {
  const names = factions.map(shortFaction);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;
}

const STAT_FIELDS: [keyof UnitProfile, string][] = [
  ["movement", "M"],
  ["toughness", "T"],
  ["save", "Sv"],
  ["wounds", "W"],
  ["leadership", "Ld"],
  ["objectiveControl", "OC"],
];

/** Weapon names whose profile differs, or that only one copy has (case-insensitive name match). */
function differingWeapons<W extends { name: string }>(a: W[], b: W[]): string[] {
  const key = (w: W) => JSON.stringify({ ...w, name: w.name.toLowerCase() });
  const aKeys = new Set(a.map(key));
  const bKeys = new Set(b.map(key));
  const names = new Map<string, string>();
  for (const w of [...a.filter((x) => !bKeys.has(key(x))), ...b.filter((x) => !aKeys.has(key(x)))]) {
    names.set(w.name.toLowerCase(), names.get(w.name.toLowerCase()) ?? w.name);
  }
  return [...names.values()];
}

/** Material differences of `other` from the shown datasheet: points, size, stats, then weapons. Terse, for reading aloud. */
function materialDifferences(shown: Unit, other: Unit): string[] {
  const parts: string[] = [];
  if (other.points !== shown.points) parts.push(other.points === null ? "no points listed" : `${other.points} pts`);
  if (JSON.stringify(other.unitSize) !== JSON.stringify(shown.unitSize)) parts.push(formatUnitSize(other.unitSize));
  if (other.profiles.length === shown.profiles.length) {
    const stats = new Set<string>();
    other.profiles.forEach((p, i) => {
      for (const [field, label] of STAT_FIELDS) {
        if (p[field] !== shown.profiles[i][field]) stats.add(`${label} ${p[field]}`);
      }
    });
    parts.push(...stats);
  } else {
    parts.push("different stat lines");
  }
  if (parts.length > 0) return parts;
  const weapons = differingWeapons(
    [...shown.rangedWeapons, ...shown.meleeWeapons],
    [...other.rangedWeapons, ...other.meleeWeapons],
  );
  return weapons.length > 0 ? ["different weapons"] : [];
}

function abilityChanges(shown: Unit, other: Unit): { lost: string[]; gained: string[] } {
  const shownNames = new Set(shown.abilities.map((a) => a.name));
  const otherNames = new Set(other.abilities.map((a) => a.name));
  return {
    lost: [...shownNames].filter((n) => !otherNames.has(n)),
    gained: [...otherNames].filter((n) => !shownNames.has(n)),
  };
}

/** A short summary of what `other` changes relative to the shown datasheet. */
function describeDifferences(shown: Unit, other: Unit): string {
  const material = materialDifferences(shown, other);
  if (material.length > 0) return material.join(", ");
  const { lost, gained } = abilityChanges(shown, other);
  if (lost.length + gained.length === 0) return "different keywords";
  if (lost.length + gained.length > 2) return "different abilities";
  return [...(gained.length ? [`with ${gained.join(", ")}`] : []), ...(lost.length ? [`without ${lost.join(", ")}`] : [])].join(", ");
}

/**
 * e.g. "Home: Chaos Daemons. Also fielded by 7 other armies. Variant: World Eaters (90 pts, OC 1)."
 * Copies that only lack the home army's own rules count as fielding the same datasheet.
 */
function formatHomeDatasheetNote(resolution: HomeDatasheetResolution<Unit>): string {
  const pick = resolution.pick;
  const sameSheet = (v: { entry: Unit }) => {
    if (materialDifferences(pick, v.entry).length > 0) return false;
    const { gained } = abilityChanges(pick, v.entry);
    return gained.length === 0 && JSON.stringify(v.entry.keywords) === JSON.stringify(pick.keywords);
  };
  const also = [...resolution.alsoFieldedBy, ...resolution.variants.filter(sameSheet).flatMap((v) => v.factions)];
  const variants = resolution.variants.filter((v) => !sameSheet(v));
  const lines = [`Home: ${shortFaction(pick.faction)}.`];
  if (also.length > 0) lines.push(`Also fielded by ${also.length} other ${also.length === 1 ? "army" : "armies"}.`);
  if (variants.length > 0) {
    const others = variants.map((v) => `${listFactions(v.factions)} (${describeDifferences(pick, v.entry)})`);
    lines.push(`${variants.length === 1 ? "Variant" : "Variants"}: ${others.join("; ")}.`);
  }
  return `**Note:** ${lines.join(" ")}`;
}

// === Tool Registration ===

export function registerLookupUnit(server: McpServer): void {
  server.tool(
    "lookup_unit",
    "Look up a Warhammer 40K unit or Kill Team operative datasheet by name. Returns stats, weapons, abilities, and keywords.",
    {
      unit_name: z.string().describe("Name or partial name of the unit to search for"),
      faction: z
        .string()
        .optional()
        .describe("Optional faction name to narrow results (e.g. 'Chaos Space Marines', 'Astartes')"),
      datasheet_id: z
        .string()
        .optional()
        .describe("Optional exact datasheet ID shown for variants that share a name and faction; pass with faction"),
      game_mode: z
        .enum(["40k", "40k_10e", "40k_11e", "combat_patrol", "kill_team"])
        .optional()
        .describe(
          "Game mode/edition: defaults to '40k_11e'. Pass '40k_10e' for 10th Edition units, " +
            "'40k'/'40k_11e' for 11th Edition (current default), or 'kill_team' for Kill Team operatives.",
        ),
    },
    async ({ unit_name, faction, datasheet_id, game_mode }) => {
      if (game_mode === "kill_team") {
        let candidates: KillTeamOperative[] = [...KILL_TEAM_OPERATIVES];

        if (faction) {
          candidates = fuzzySearch(candidates, faction, ["faction"]);
        }
        if (datasheet_id) candidates = candidates.filter((op) => op.id === datasheet_id);

        const matches = rankUnitMatches(candidates, unit_name, datasheetContentKey);

        if (matches.length === 0) {
          const suggestion = faction
            ? `Try a different faction or check the spelling.`
            : `Try a partial name or check the spelling.`;
          return {
            content: [
              {
                type: "text" as const,
                text: `No Kill Team operative found matching "${unit_name}".${faction ? ` (faction filter: "${faction}")` : ""}${datasheet_id ? ` (datasheet_id: "${datasheet_id}")` : ""}\n\n${suggestion}`,
              },
            ],
          };
        }

        const ktAmbiguous = ambiguousFactionMatches(matches, unit_name, datasheetContentKey);
        if (ktAmbiguous) {
          return {
            content: [
              { type: "text" as const, text: formatFactionDisambiguation(matches[0].name, ktAmbiguous) },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `${formatModeStamp("wh40k-killteam")}\n\n${formatKTOperative(matches[0])}`,
            },
          ],
        };
      }

      // Default: 40K units (11th Edition unless 10th Edition is explicitly requested)
      const gameSystem = game_mode === "40k_10e" ? "wh40k-10e" : "wh40k-11e";
      let candidates: Unit[] = [...(gameSystem === "wh40k-10e" ? UNITS : UNITS_11E)];

      if (faction) {
        candidates = fuzzySearch(candidates, faction, ["faction"]);
      }
      if (datasheet_id) candidates = candidates.filter((unit) => unit.id === datasheet_id);

      // "Grey Knight Paladins" → Paladin Squad: a leading army name narrows the search.
      const { matches, query } = matchUnitsWithFactionHint(candidates, unit_name, datasheetContentKey);

      if (matches.length === 0) {
        const suggestion = faction
          ? `Try a different faction or check the spelling.`
          : `Try a partial name or check the spelling.`;
        return {
          content: [
            {
              type: "text" as const,
              text: `No unit found matching "${unit_name}".${faction ? ` (faction filter: "${faction}")` : ""}${datasheet_id ? ` (datasheet_id: "${datasheet_id}")` : ""}\n\n${suggestion}`,
            },
          ],
        };
      }

      const ambiguous = ambiguousFactionMatches(matches, query, datasheetContentKey);
      // With no faction given, a datasheet shared by most armies answers directly
      // from its home army; a faction filter means same-faction variants are a real choice.
      const home = ambiguous && !faction && !datasheet_id ? resolveHomeDatasheet(ambiguous, datasheetContentKey) : null;
      if (home) {
        return {
          content: [
            {
              type: "text" as const,
              text: `${formatModeStamp(gameSystem)}\n\n${formatUnit(home.pick)}\n\n${formatHomeDatasheetNote(home)}`,
            },
          ],
        };
      }
      if (ambiguous) {
        return {
          content: [
            { type: "text" as const, text: formatFactionDisambiguation(matches[0].name, ambiguous) },
          ],
        };
      }

      const unit = matches[0];
      return {
        content: [
          {
            type: "text" as const,
            text: `${formatModeStamp(gameSystem)}\n\n${formatUnit(unit)}`,
          },
        ],
      };
    },
  );
}
