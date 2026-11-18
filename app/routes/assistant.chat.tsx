import { jsonResponse } from "~/lib/assistant/http";
import {
  AssistantConfigError,
  AssistantUpstreamError,
  readAssistantConfig,
  runAssistant,
  type ChatMessage,
  type ShownProduct,
} from "~/lib/assistant/agent";
import { envContext } from "~/lib/env";
import { storefrontClientContext } from "~/lib/storefront";

import type { Route } from "./+types/assistant.chat";

const MAX_HISTORY = 20;
const MAX_MESSAGE_LENGTH = 1000;

export function loader() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export async function action({ context, request }: Route.ActionArgs) {
  const env = context.get(envContext);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be JSON." }, 400);
  }

  const messages = parseMessages(body);
  if (!messages) {
    return jsonResponse(
      { error: "Send { messages: [{ role: 'user' | 'assistant', content: string }] } ending with a user message." },
      400,
    );
  }

  try {
    const { setCookies, ...reply } = await runAssistant({
      messages,
      shownProducts: parseShownProducts((body as { shownProducts?: unknown }).shownProducts),
      config: readAssistantConfig(env),
      storefrontClient: context.get(storefrontClientContext),
      request,
    });
    return jsonResponse(reply, 200, setCookies);
  } catch (caught) {
    if (caught instanceof AssistantConfigError) {
      return jsonResponse({ error: caught.message }, 503);
    }
    if (caught instanceof AssistantUpstreamError) {
      // Upstream messages describe the failure without keys or secrets, so they are safe to show.
      return jsonResponse({ error: caught.message }, 502);
    }
    console.error("Chat request failed", caught);
    return jsonResponse({ error: "Something went wrong. Try again." }, 500);
  }
}

const VARIANT_ID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;

// Products the browser has shown so far. Only the fields the model needs are kept,
// with length limits, so this list cannot carry arbitrary content into the prompt.
function parseShownProducts(raw: unknown): ShownProduct[] {
  if (!Array.isArray(raw)) return [];
  const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.slice(0, max) : null;

  const products: ShownProduct[] = [];
  for (const item of raw.slice(0, 12)) {
    if (typeof item !== "object" || item === null) continue;
    const { handle, title, price, variants } = item as Record<string, unknown>;
    const safeHandle = text(handle, 255);
    const safeTitle = text(title, 200);
    const safePrice = text(price, 60);
    if (!safeHandle || !safeTitle || !safePrice || !Array.isArray(variants)) continue;

    const safeVariants = variants.slice(0, 25).flatMap((variant) => {
      if (typeof variant !== "object" || variant === null) return [];
      const { id, title: variantTitle, availableForSale } = variant as Record<string, unknown>;
      if (typeof id !== "string" || !VARIANT_ID.test(id)) return [];
      return [
        {
          id,
          title: text(variantTitle, 200) ?? "",
          availableForSale: availableForSale === true,
        },
      ];
    });

    products.push({ handle: safeHandle, title: safeTitle, price: safePrice, variants: safeVariants });
  }
  return products;
}

// Only user and assistant text is accepted from the client. Tool calls and results
// are created on the server, so a client cannot inject fake product data.
function parseMessages(body: unknown): ChatMessage[] | null {
  if (typeof body !== "object" || body === null || !("messages" in body)) return null;
  const raw = (body as { messages: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const messages: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (typeof item !== "object" || item === null) return null;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.trim() === "") return null;
    if (content.length > MAX_MESSAGE_LENGTH) return null;
    messages.push({ role, content: content.trim() });
  }

  // The API expects the conversation to start with the user.
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return null;
  return messages;
}
