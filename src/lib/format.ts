import type { CompositionEntry, GameSystem, ModelWargear, UnitSize } from "../types.js";

const MODE_STAMPS: Record<GameSystem, string> = {
  "wh40k-10e": "[Mode: 40k 10e]",
  "wh40k-11e": "[Mode: 40k 11e]",
  "wh40k-killteam": "[Mode: Kill Team]",
};

/**
 * A short, always-visible header stamped onto tool output so a wrong or
 * defaulted edition/mode is caught by reading the response, not just by
 * knowing the query's game_mode param.
 */
export function formatModeStamp(gameSystem: GameSystem): string {
  return MODE_STAMPS[gameSystem];
}

/** "5-10 models" for a variable-size unit, or "1 model"/"2 models" for a fixed-size one. */
export function formatUnitSize(size: UnitSize): string {
  return size.min === size.max
    ? `${size.min} model${size.min === 1 ? "" : "s"}`
    : `${size.min}-${size.max} models`;
}

function formatCount(min: number, max: number): string {
  return min === max ? `${min}` : `${min}-${max}`;
}

/** "1 Intercessor Sergeant, 4-9 Intercessor" */
export function formatCompositionInline(composition: CompositionEntry[]): string {
  return composition.map((c) => `${formatCount(c.min, c.max)} ${c.model}`).join(", ");
}

/**
 * The unit's model breakdown, for answering "how many X in a unit?". Omitted
 * (empty string) for a plain single-model datasheet, where the header's unit
 * size already says it all.
 */
export function formatCompositionSection(composition: CompositionEntry[], size: UnitSize): string {
  if (composition.length === 0) return "";
  if (composition.length === 1 && composition[0].max === 1) return "";
  const lines = composition.map((c) => `- ${formatCount(c.min, c.max)} ${c.model}`);
  return `### Unit Composition\n\n${lines.join("\n")}\n\nTotal: ${formatUnitSize(size)}`;
}

/**
 * Default loadout and options per model, for answering "what can X take?".
 * One block per model type: its default equipment, then one bullet per option.
 */
export function formatWargearSection(wargear: ModelWargear[]): string {
  if (wargear.length === 0) return "";
  const blocks = wargear.map((w) => {
    const header = `**${w.model}** — default: ${w.default.join(", ") || "none listed"}`;
    if (w.options.length === 0) return `${header} (no options)`;
    return [header, ...w.options.map((o) => `- ${o}`)].join("\n");
  });
  return `### Wargear Options\n\n${blocks.join("\n\n")}`;
}
