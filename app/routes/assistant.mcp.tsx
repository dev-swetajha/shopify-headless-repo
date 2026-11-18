import { handleMcpRequest } from "~/lib/assistant/mcp";
import { storefrontClientContext } from "~/lib/storefront";

import type { Route } from "./+types/assistant.mcp";

// MCP endpoint (Streamable HTTP, JSON responses). Point any MCP client at
// https://<your-store>/assistant/mcp. The same tools power the /assistant chat.
// (Hydrogen reserves /api/mcp for Shopify's own storefront MCP proxy.)

export async function loader({ context, request }: Route.LoaderArgs) {
  return handleMcpRequest(request, context.get(storefrontClientContext));
}

export async function action({ context, request }: Route.ActionArgs) {
  return handleMcpRequest(request, context.get(storefrontClientContext));
}
