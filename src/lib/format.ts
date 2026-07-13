import type { GameSystem } from "../types.js";

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
