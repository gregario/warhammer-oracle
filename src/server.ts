import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./register-tools.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "warhammer-oracle",
    version: "0.1.0",
  });
  registerTools(server);
  return server;
}
