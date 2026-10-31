#!/usr/bin/env node

import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createMcpServer } from "./server.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

const host = process.env.HOST ?? "0.0.0.0";
const port = parsePositiveInteger(process.env.PORT ?? "8080");
const maxBodyBytes = parsePositiveInteger(process.env.MAX_BODY_BYTES ?? "1048576");
const authToken = process.env.MCP_AUTH_TOKEN;

type McpServerInstance = ReturnType<typeof createMcpServer>;

type SseSession = {
  server: McpServerInstance;
  transport: SSEServerTransport;
};

const sseSessions = new Map<string, SseSession>();

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer: ${value}`);
  }
  return parsed;
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id",
  );
  response.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id");
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  setCorsHeaders(response);
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function getBearerToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ", 2);
  return scheme.toLowerCase() === "bearer" ? token : undefined;
}

function tokenMatches(candidate: string | null | undefined, expected: string): boolean {
  if (!candidate) {
    return false;
  }

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isAuthorized(request: IncomingMessage, url: URL): boolean {
  if (!authToken) {
    return true;
  }

  return tokenMatches(getBearerToken(request), authToken) || tokenMatches(url.searchParams.get("token"), authToken);
}

function sendUnauthorized(response: ServerResponse): void {
  setCorsHeaders(response);
  response.writeHead(401, {
    "Content-Type": "application/json",
    "WWW-Authenticate": "Bearer",
  });
  response.end(JSON.stringify({ error: "Unauthorized" }));
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytesRead = 0;

    request.on("data", (chunk: Buffer) => {
      bytesRead += chunk.length;
      if (bytesRead > maxBodyBytes) {
        reject(new Error(`Request body exceeds ${maxBodyBytes} bytes`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve(body.length === 0 ? undefined : JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

async function closeSseSession(sessionId: string): Promise<void> {
  const session = sseSessions.get(sessionId);
  if (!session) {
    return;
  }

  sseSessions.delete(sessionId);
  await session.transport.close();
  await session.server.close();
}

async function handleMcpRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  let mcpServer;
  let transport;

  try {
    const body = await readJsonBody(request);
    mcpServer = createMcpServer(pkg.version);
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(request, response, body);
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!response.headersSent) {
      sendJson(response, 400, {
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: error instanceof Error ? error.message : "Invalid request",
        },
        id: null,
      });
    } else if (!response.writableEnded) {
      response.end();
    }
  } finally {
    await transport?.close();
    await mcpServer?.close();
  }
}

async function handleSseRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<void> {
  const queryToken = url.searchParams.get("token");
  const messagesEndpoint = queryToken ? `/messages?token=${encodeURIComponent(queryToken)}` : "/messages";
  setCorsHeaders(response);
  const transport = new SSEServerTransport(messagesEndpoint, response);
  const mcpServer = createMcpServer(pkg.version);
  const sessionId = transport.sessionId;

  sseSessions.set(sessionId, { server: mcpServer, transport });
  transport.onclose = () => {
    void closeSseSession(sessionId);
  };

  try {
    await mcpServer.connect(transport);
  } catch (error) {
    console.error("SSE connection failed:", error);
    await closeSseSession(sessionId);
    if (!response.headersSent) {
      sendJson(response, 500, { error: "Error establishing SSE stream" });
    }
  }
}

async function handleSseMessageRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<void> {
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    sendJson(response, 400, { error: "Missing sessionId parameter" });
    return;
  }

  const session = sseSessions.get(sessionId);
  if (!session) {
    sendJson(response, 404, { error: "Session not found" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    await session.transport.handlePostMessage(request, response, body);
  } catch (error) {
    console.error("SSE message failed:", error);
    if (!response.headersSent) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Invalid request" });
    } else if (!response.writableEnded) {
      response.end();
    }
  }
}

const httpServer = createHttpServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "OPTIONS") {
    setCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/healthz")) {
    sendJson(response, 200, {
      status: "ok",
      name: pkg.name,
      version: pkg.version,
      transport: "streamable-http",
      endpoint: "/mcp",
      sseEndpoint: "/sse",
      auth: authToken ? "required" : "none",
    });
    return;
  }

  if ((url.pathname === "/mcp" || url.pathname === "/sse" || url.pathname === "/messages") && !isAuthorized(request, url)) {
    sendUnauthorized(response);
    return;
  }

  if (url.pathname === "/sse") {
    if (request.method !== "GET") {
      setCorsHeaders(response);
      response.writeHead(405, { Allow: "GET, OPTIONS" });
      response.end();
      return;
    }

    await handleSseRequest(request, response, url);
    return;
  }

  if (url.pathname === "/messages") {
    if (request.method !== "POST") {
      setCorsHeaders(response);
      response.writeHead(405, { Allow: "POST, OPTIONS" });
      response.end();
      return;
    }

    await handleSseMessageRequest(request, response, url);
    return;
  }

  if (url.pathname !== "/mcp") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (request.method !== "POST") {
    setCorsHeaders(response);
    response.writeHead(405, { Allow: "POST, OPTIONS" });
    response.end();
    return;
  }

  await handleMcpRequest(request, response);
});

httpServer.listen(port, host, () => {
  console.error(`Warhammer Oracle v${pkg.version} MCP HTTP server listening on ${host}:${port}`);
});

async function shutdown(): Promise<void> {
  await Promise.all([...sseSessions.keys()].map((sessionId) => closeSseSession(sessionId)));

  httpServer.close((error) => {
    if (error) {
      console.error("HTTP server shutdown failed:", error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
