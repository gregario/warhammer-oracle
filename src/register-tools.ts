import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLookupUnit } from "./tools/lookup-unit.js";
import { registerLookupKeyword } from "./tools/lookup-keyword.js";
import { registerLookupPhase } from "./tools/lookup-phase.js";
import { registerSearchUnits } from "./tools/search-units.js";
import { registerCompareUnits } from "./tools/compare-units.js";
import { registerGameFlow } from "./tools/game-flow.js";

export function registerTools(server: McpServer): void {
  registerLookupUnit(server);
  registerLookupKeyword(server);
  registerLookupPhase(server);
  registerSearchUnits(server);
  registerCompareUnits(server);
  registerGameFlow(server);
}
