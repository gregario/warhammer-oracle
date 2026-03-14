import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLookupUnit } from "./tools/lookup-unit.js";
import { registerLookupKeyword } from "./tools/lookup-keyword.js";

export function registerTools(server: McpServer): void {
  registerLookupUnit(server);
  registerLookupKeyword(server);
}
