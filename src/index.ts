#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

console.error("Warhammer Oracle v0.1.0 — Warhammer rules & stats MCP server");

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
