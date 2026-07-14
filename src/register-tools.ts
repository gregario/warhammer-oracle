import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLookupUnit } from "./tools/lookup-unit.js";
import { registerLookupKeyword } from "./tools/lookup-keyword.js";
import { registerLookupPhase } from "./tools/lookup-phase.js";
import { registerSearchUnits } from "./tools/search-units.js";
import { registerCompareUnits } from "./tools/compare-units.js";
import { registerGameFlow } from "./tools/game-flow.js";
import { registerWoundCalculator } from "./tools/wound-calculator.js";
import { registerLookupStratagem } from "./tools/lookup-stratagem.js";
import { registerSearchStratagems } from "./tools/search-stratagems.js";
import { registerLookupDetachment } from "./tools/lookup-detachment.js";
import { registerLookupEnhancement } from "./tools/lookup-enhancement.js";
import { registerLookupPloy } from "./tools/lookup-ploy.js";
import { registerDeterminePrimaryMission } from "./tools/determine-primary-mission.js";

export function registerTools(server: McpServer): void {
  registerLookupUnit(server);
  registerLookupKeyword(server);
  registerLookupPhase(server);
  registerSearchUnits(server);
  registerCompareUnits(server);
  registerGameFlow(server);
  registerWoundCalculator(server);
  registerLookupStratagem(server);
  registerSearchStratagems(server);
  registerLookupDetachment(server);
  registerLookupEnhancement(server);
  registerLookupPloy(server);
  registerDeterminePrimaryMission(server);
}
