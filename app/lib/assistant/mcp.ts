import type { StorefrontClient } from "@shopify/hydrogen";

import { jsonResponse as json } from "./http";
import { assistantTools, findTool, ToolInputError, type ToolContext } from "./tools";

// Minimal stateless MCP server over Streamable HTTP (JSON responses only). Each
// POST carries one JSON-RPC message or a batch; no session is kept between calls.

const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = [PROTOCOL_VERSION, "2025-03-26"];
const SERVER_INFO = { name: "storefront-shopping-assistant", version: "1.0.0" };
const INSTRUCTIONS =
  "Search the store catalog with search_products, read product details with get_product, " +
  "and use the cart tools to add items and produce a checkout link.";

const ERROR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
};

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } };

export async function handleMcpRequest(
  request: Request,
  storefrontClient: StorefrontClient,
): Promise<Response> {
  if (request.method === "GET") {
    // No server-initiated stream in this stateless server.
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(error(null, ERROR.parse, "Parse error: body is not valid JSON."), 400);
  }

  const isBatch = Array.isArray(body);
  const messages: unknown[] = isBatch ? (body as unknown[]) : [body];
  if (messages.length === 0) {
    return json(error(null, ERROR.invalidRequest, "Empty batch."), 400);
  }

  const context: ToolContext = { storefrontClient, request, cookies: [] };
  const responses: JsonRpcResponse[] = [];
  for (const message of messages) {
    const response = await handleMessage(message, context);
    if (response) responses.push(response);
  }

  // Cart writes can create a cart; send its cookie back so browser clients keep it.
  // Only notifications (no id) produce no response: acknowledge with 202.
  if (responses.length === 0) return new Response(null, { status: 202 });
  return json(isBatch ? responses : responses[0], 200, context.cookies);
}

async function handleMessage(
  message: unknown,
  context: ToolContext,
): Promise<JsonRpcResponse | null> {
  if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return error(null, ERROR.invalidRequest, "Invalid JSON-RPC request.");
  }

  const rpc = message as JsonRpcRequest;
  const isNotification = !("id" in rpc);
  const id = (rpc.id ?? null) as JsonRpcId;
  const params = isObject(rpc.params) ? rpc.params : {};

  try {
    const result = await dispatch(rpc.method as string, params, context);
    if (isNotification) return null;
    return { jsonrpc: "2.0", id, result };
  } catch (caught) {
    if (isNotification) return null;
    if (caught instanceof MethodNotFound) return error(id, ERROR.methodNotFound, caught.message);
    if (caught instanceof ToolInputError) return error(id, ERROR.invalidParams, caught.message);
    console.error("MCP request failed", caught);
    return error(id, ERROR.internal, "Internal error.");
  }
}

class MethodNotFound extends Error {}

async function dispatch(
  method: string,
  params: Record<string, unknown>,
  context: ToolContext,
): Promise<unknown> {
  switch (method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      };
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return {};
    case "ping":
      return {};
    case "tools/list":
      return {
        tools: assistantTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    case "tools/call":
      return callTool(params, context);
    default:
      throw new MethodNotFound(`Method not found: ${method}`);
  }
}

async function callTool(params: Record<string, unknown>, context: ToolContext) {
  const name = params.name;
  if (typeof name !== "string") throw new ToolInputError('"name" must be a tool name.');
  const tool = findTool(name);
  if (!tool) throw new ToolInputError(`Unknown tool: ${name}`);

  const args = isObject(params.arguments) ? params.arguments : {};
  try {
    const output = await tool.run(args, context);
    return {
      content: [{ type: "text", text: JSON.stringify(output.result) }],
      structuredContent: isObject(output.result) ? output.result : { value: output.result },
      isError: output.isError === true,
    };
  } catch (caught) {
    // Input problems are protocol errors; storefront failures are tool errors the
    // model can see and retry around.
    if (caught instanceof ToolInputError) throw caught;
    console.error(`Tool ${name} failed`, caught);
    return {
      content: [{ type: "text", text: "The storefront request failed. Try again." }],
      isError: true,
    };
  }
}

function error(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
