import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UNITS } from "../data/units.js";
import { UNITS_11E } from "../data/units-11e.js";
import { KILL_TEAM_OPERATIVES } from "../data/kill-team-operatives.js";
import { fuzzySearch, normalizeName } from "../lib/search.js";
import { formatModeStamp } from "../lib/format.js";
import {
  splitWeaponName,
  matchWeaponName,
  groupWeaponVariants,
  describeVariantDifference,
  countCurrent,
} from "../lib/weapon-match.js";
import type { WeaponEntry, WeaponVariant } from "../lib/weapon-match.js";
import type { GameSystem, Unit, KillTeamOperative } from "../types.js";

const CELLS_40K = ["Range", "A", "S", "AP", "D"];
const CELLS_KT = ["Type", "ATK", "DMG"];
const MAX_VARIANTS = 6;
const MAX_EXAMPLES = 5;
const MAX_VARIANT_EXAMPLES = 3;

type TypedEntry = WeaponEntry & { skillLabel: string };

function entries40k(units: Unit[]): TypedEntry[] {
  return units.flatMap((u) => [
    ...u.rangedWeapons.map((w) => ({
      carrierId: u.id,
      carrier: u.name,
      name: w.name,
      cells: [w.range, w.attacks, w.strength, w.armourPenetration, w.damage],
      keywords: w.keywords,
      skill: w.ballisticSkill,
      skillLabel: "BS",
    })),
    ...u.meleeWeapons.map((w) => ({
      carrierId: u.id,
      carrier: u.name,
      name: w.name,
      cells: [w.range, w.attacks, w.strength, w.armourPenetration, w.damage],
      keywords: w.keywords,
      skill: w.weaponSkill,
      skillLabel: "WS",
    })),
  ]);
}

function entriesKT(operatives: KillTeamOperative[]): TypedEntry[] {
  return operatives.flatMap((op) =>
    op.weapons.map((w) => ({
      carrierId: op.id,
      carrier: op.name,
      name: w.name,
      cells: [w.type, w.attacks, w.damage],
      keywords: w.weaponRules && w.weaponRules !== "-" ? w.weaponRules.split(/,\s*/) : [],
      skill: w.hit,
      skillLabel: "Hit",
    })),
  );
}

// === Formatters ===

function formatProfileTable(variant: WeaponVariant, cellHeaders: string[]): string {
  const labelled = variant.rows.some((r) => r.label);
  const headers = [...(labelled ? ["Profile"] : []), ...cellHeaders, "Keywords"];
  const header = `| ${headers.join(" | ")} |`;
  const separator = `|${headers.map(() => "---").join("|")}|`;
  const rows = variant.rows.map(
    (r) => `| ${[...(labelled ? [r.label] : []), ...r.cells, r.keywords.join(", ") || "-"].join(" | ")} |`,
  );
  return [header, separator, ...rows].join("\n");
}

/** A few example datasheets, real current datasheets ahead of [Legends]/[Crucible] entries. */
function formatExamples(carriers: string[], max = MAX_EXAMPLES): string {
  const ordered = [...carriers].sort((a, b) => Number(a.includes("[")) - Number(b.includes("[")));
  const shown = ordered.slice(0, max).join(", ");
  const more = carriers.length - max;
  return more > 0 ? `${shown} (+${more} more)` : shown;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatWeapon(
  name: string,
  variants: WeaponVariant[],
  cellHeaders: string[],
  skillLabel: string,
): string {
  const [standard, ...others] = variants;
  const total = variants.reduce((n, v) => n + v.carriers.length, 0);
  const sections: string[] = [`# ${name}`];

  // Judge "standard" on current datasheets; [Legends]/[Crucible] entries still
  // appear as variants but don't get a vote (unless they're all there is).
  const currentTotal = variants.reduce((n, v) => n + countCurrent(v.carriers), 0);
  const [mine, of, kind] =
    currentTotal > 0
      ? [countCurrent(standard.carriers), currentTotal, "current datasheet"]
      : [standard.carriers.length, total, "datasheet"];

  let heading: string;
  if (others.length === 0)
    heading = `**Profile** (${total === 1 ? "1 datasheet" : `all ${total} datasheets`}):`;
  else if (mine * 2 > of)
    heading = `**Standard profile** (${mine} of ${plural(of, kind)}):`;
  else
    heading =
      `**Most common profile** (${mine} of ${plural(of, kind)}; ` +
      `no single standard — stats vary by datasheet):`;
  sections.push(`${heading}\n\n${formatProfileTable(standard, cellHeaders)}`);

  const skills = [...new Set(variants.flatMap((v) => v.skills))].sort();
  const skillNote =
    skills.length > 0
      ? `${skillLabel} is not part of the weapon: it comes from the bearer's datasheet (${skills.join(", ")} here).`
      : "";
  sections.push([skillNote, `Carried by e.g. ${formatExamples(standard.carriers)}.`].filter(Boolean).join("\n"));

  if (others.length > 0) {
    const lines = others.slice(0, MAX_VARIANTS).map((v) => {
      const diff = describeVariantDifference(standard, v, cellHeaders);
      const examples = formatExamples(v.carriers, MAX_VARIANT_EXAMPLES);
      const head = `- **${examples}** (${plural(v.carriers.length, "datasheet")})`;
      return diff ? `${head}: ${diff}` : `${head}:\n\n${formatProfileTable(v, cellHeaders)}\n`;
    });
    const hidden = others.slice(MAX_VARIANTS);
    if (hidden.length > 0) {
      const hiddenSheets = hidden.reduce((n, v) => n + v.carriers.length, 0);
      lines.push(
        `- …and ${plural(hidden.length, "more variant")} on ${plural(hiddenSheets, "datasheet")}. ` +
          `Pass \`faction\` to narrow.`,
      );
    }
    sections.push(`### Variants (differ from the profile above)\n\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

// === Tool Registration ===

export function registerLookupWeapon(server: McpServer): void {
  server.tool(
    "lookup_weapon",
    "Look up a weapon's stats by weapon name — use this, not lookup_unit, for questions like " +
      "\"what's the strength of a lascannon?\", \"plasma gun profile\" or \"how much damage does a power fist do?\". " +
      "Returns the standard profile (range, attacks, strength, AP, damage, keywords) across every datasheet that " +
      "carries the weapon, then any datasheet-specific variants. Covers ranged and melee weapons.",
    {
      weapon_name: z.string().describe("Name of the weapon (e.g. 'Plasma gun', 'Lascannon', 'Power fist')"),
      faction: z
        .string()
        .optional()
        .describe("Optional faction name to only consider that faction's datasheets (e.g. 'Astra Militarum')"),
      game_mode: z
        .enum(["40k", "40k_10e", "40k_11e", "combat_patrol", "kill_team"])
        .optional()
        .describe(
          "Game mode/edition: defaults to '40k_11e'. Pass '40k_10e' for 10th Edition weapons, " +
            "'40k'/'40k_11e' for 11th Edition (current default), or 'kill_team' for Kill Team weapons.",
        ),
    },
    async ({ weapon_name, faction, game_mode }) => {
      let gameSystem: GameSystem;
      let entries: TypedEntry[];
      let cellHeaders: string[];
      const parenProfiles = game_mode === "kill_team";

      if (game_mode === "kill_team") {
        gameSystem = "wh40k-killteam";
        let candidates: KillTeamOperative[] = [...KILL_TEAM_OPERATIVES];
        if (faction) candidates = fuzzySearch(candidates, faction, ["faction"]);
        entries = entriesKT(candidates);
        cellHeaders = CELLS_KT;
      } else {
        // Default: 40K units (11th Edition unless 10th Edition is explicitly requested)
        gameSystem = game_mode === "40k_10e" ? "wh40k-10e" : "wh40k-11e";
        let candidates: Unit[] = [...(gameSystem === "wh40k-10e" ? UNITS : UNITS_11E)];
        if (faction) candidates = fuzzySearch(candidates, faction, ["faction"]);
        entries = entries40k(candidates);
        cellHeaders = CELLS_40K;
      }

      const baseOf = (e: WeaponEntry) => splitWeaponName(e.name, parenProfiles).base;
      const match = matchWeaponName(entries.map(baseOf), weapon_name);
      const factionNote = faction ? ` (faction filter: "${faction}")` : "";

      if (match.names.size === 0) {
        const suggestion =
          match.suggestions.length > 0
            ? `Did you mean one of these weapons?\n\n${match.suggestions.map((s) => `- ${s}`).join("\n")}`
            : faction
              ? `Try a different faction or check the spelling.`
              : `Try a different name or check the spelling.`;
        return {
          content: [
            {
              type: "text" as const,
              text: `No weapon found named "${weapon_name}".${factionNote}\n\n${suggestion}`,
            },
          ],
        };
      }

      const matched = entries.filter((e) => match.names.has(normalizeName(baseOf(e))));
      const spellings = new Map<string, number>();
      for (const e of matched) spellings.set(baseOf(e), (spellings.get(baseOf(e)) ?? 0) + 1);
      const name = [...spellings].sort((a, b) => b[1] - a[1])[0][0];
      const skillLabel = [...new Set(matched.map((e) => e.skillLabel))].join("/");

      const variants = groupWeaponVariants(matched, parenProfiles);
      const closestNote = match.closest ? `No weapon named "${weapon_name}"; showing the closest match.\n\n` : "";
      const factionLine = faction ? `\n\nOnly datasheets matching faction "${faction}" were considered.` : "";

      return {
        content: [
          {
            type: "text" as const,
            text:
              `${formatModeStamp(gameSystem)}\n\n${closestNote}` +
              `${formatWeapon(name, variants, cellHeaders, skillLabel)}${factionLine}`,
          },
        ],
      };
    },
  );
}
