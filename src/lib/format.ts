import type { GameSystem, UnitSize } from "../types.js";

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
