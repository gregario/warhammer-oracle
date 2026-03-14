import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLookupUnit } from "./tools/lookup-unit.js";

export function registerTools(server: McpServer): void {
  registerLookupUnit(server);
}
