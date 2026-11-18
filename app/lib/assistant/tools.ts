import type { StorefrontClient } from "@shopify/hydrogen";

import {
  addVariantToCart,
  readCart,
  type CartSummary,
} from "./cart";
import { getProductDetails, searchProducts, type AssistantProduct } from "./catalog";

// One registry drives both the MCP endpoint (`/assistant/mcp`) and the chat agent,
// so a tool behaves the same whichever client calls it.

export type ToolContext = {
  storefrontClient: StorefrontClient;
  /** The incoming request. Its `cart` cookie identifies the shopper's cart. */
  request: Request;
  /** Set-Cookie values from cart writes. The caller must send them to the browser. */
  cookies: string[];
  /** Cart ID from earlier calls in this turn, so later calls see a newly created cart. */
  cartId?: string;
};

export type ToolOutput = {
  /** JSON sent back to the caller (the model, or an MCP client). */
  result: unknown;
  /** Products the chat UI should render as cards. */
  products?: AssistantProduct[];
  /** The cart after this call, for the chat's cart bar. */
  cart?: CartSummary;
  /** Checkout link, set only when the shopper is ready to pay. */
  checkoutUrl?: string;
  /** True when this call changed the cart, so the storefront header should refresh. */
  cartChanged?: boolean;
  /** True when the call failed; the model can read the message and recover. */
  isError?: boolean;
};

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string; minimum?: number; maximum?: number }>;
  required: string[];
  additionalProperties: false;
};

export type AssistantTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  run: (input: Record<string, unknown>, context: ToolContext) => Promise<ToolOutput>;
};

export class ToolInputError extends Error {
  name = "ToolInputError";
}

function requireString(input: Record<string, unknown>, key: string, max = 200): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ToolInputError(`"${key}" must be a non-empty string.`);
  }
  if (value.length > max) throw new ToolInputError(`"${key}" must be at most ${max} characters.`);
  return value.trim();
}

function optionalString(input: Record<string, unknown>, key: string, max = 200): string | undefined {
  if (input[key] === undefined || input[key] === null || input[key] === "") return undefined;
  return requireString(input, key, max);
}

function optionalInt(
  input: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = input[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ToolInputError(`"${key}" must be an integer from ${min} to ${max}.`);
  }
  return value;
}

// Accepts a numeric variant ID or the full GID the search results return.
function toVariantGid(raw: string): string {
  if (/^\d+$/.test(raw)) return `gid://shopify/ProductVariant/${raw}`;
  if (/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(raw)) return raw;
  throw new ToolInputError(
    '"variantId" must be a variant ID from search_products or get_product (for example gid://shopify/ProductVariant/123).',
  );
}

const MAX_SEARCH_RESULTS = 12;

const CART_ID_PROPERTY = {
  type: "string",
  description:
    "Optional cart ID. Leave empty to use the shopper's current cart. Only needed when the shopper's cart is not in this browser session.",
};

// The cart the call should use: an explicit ID, else the one created earlier this turn.
function cartIdFor(input: Record<string, unknown>, context: ToolContext): string | undefined {
  return optionalString(input, "cartId", 300) ?? context.cartId;
}

export const assistantTools: AssistantTool[] = [
  {
    name: "search_products",
    description:
      "Search the store's product catalog by keyword, product type, or a shopper's description. Returns matching products with prices, availability, and variant IDs. Results are shown to the shopper as product cards.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search terms, e.g. 'black hoodie' or 'snowboard for beginners'.",
        },
        limit: {
          type: "integer",
          description: `Maximum number of products to return (1-${MAX_SEARCH_RESULTS}, default 6).`,
          minimum: 1,
          maximum: MAX_SEARCH_RESULTS,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    async run(input, { storefrontClient }) {
      const query = requireString(input, "query");
      const limit = optionalInt(input, "limit", 6, 1, MAX_SEARCH_RESULTS);
      const products = await searchProducts(storefrontClient, query, limit);
      return {
        result: {
          query,
          count: products.length,
          products: products.map(summarizeForModel),
        },
        products,
      };
    },
  },
  {
    name: "get_product",
    description:
      "Get full details for one product by its handle (from search_products): description, tags, options, every variant with price and availability. Use this to answer questions about a specific product. Do not guess details that are not returned here.",
    inputSchema: {
      type: "object",
      properties: {
        handle: {
          type: "string",
          description: "The product handle, e.g. 'the-hydrogen-snowboard'.",
        },
      },
      required: ["handle"],
      additionalProperties: false,
    },
    async run(input, { storefrontClient }) {
      const handle = requireString(input, "handle", 255);
      const product = await getProductDetails(storefrontClient, handle);
      if (!product) {
        return { result: { error: `No product with handle "${handle}".` }, isError: true };
      }
      return { result: product, products: [product] };
    },
  },
  {
    name: "add_to_cart",
    description:
      "Add one specific product variant to the shopper's cart. Use the variant ID from search_products or get_product, and only after the shopper has chosen the option they want (for example size and color). Only add when the shopper asks. Returns the updated cart.",
    inputSchema: {
      type: "object",
      properties: {
        variantId: {
          type: "string",
          description: "Variant ID, e.g. gid://shopify/ProductVariant/123.",
        },
        quantity: {
          type: "integer",
          description: "How many to add (1-10, default 1).",
          minimum: 1,
          maximum: 10,
        },
        cartId: CART_ID_PROPERTY,
      },
      required: ["variantId"],
      additionalProperties: false,
    },
    async run(input, context) {
      const merchandiseId = toVariantGid(requireString(input, "variantId", 100));
      const quantity = optionalInt(input, "quantity", 1, 1, 10);
      const outcome = await addVariantToCart(
        { storefrontClient: context.storefrontClient, request: context.request },
        { merchandiseId, quantity },
        cartIdFor(input, context),
      );
      context.cookies.push(...outcome.setCookies);

      if (!outcome.ok) {
        return { result: { added: false, error: outcome.message }, isError: true };
      }
      if (outcome.cart) context.cartId = outcome.cart.id;
      return {
        result: { added: true, quantity, cart: outcome.cart },
        cart: outcome.cart ?? undefined,
        cartChanged: true,
      };
    },
  },
  {
    name: "get_cart",
    description:
      "Get the shopper's current cart: line items, quantities, subtotal, and total. Use it when the shopper asks what is in their cart.",
    inputSchema: {
      type: "object",
      properties: { cartId: CART_ID_PROPERTY },
      required: [],
      additionalProperties: false,
    },
    async run(input, context) {
      const cart = await readCart(
        { storefrontClient: context.storefrontClient, request: context.request },
        cartIdFor(input, context),
      );
      if (cart) context.cartId = cart.id;
      if (!cart || cart.lines.length === 0) {
        return { result: { cart: null, message: "The cart is empty." } };
      }
      return { result: { cart }, cart };
    },
  },
  {
    name: "get_checkout_link",
    description:
      "Get the checkout link for the shopper's cart. Only call this when the shopper says they want to check out or buy now. The link opens the store's checkout; the assistant does not take payment.",
    inputSchema: {
      type: "object",
      properties: { cartId: CART_ID_PROPERTY },
      required: [],
      additionalProperties: false,
    },
    async run(input, context) {
      const cart = await readCart(
        { storefrontClient: context.storefrontClient, request: context.request },
        cartIdFor(input, context),
      );
      if (!cart || cart.lines.length === 0) {
        return {
          result: { error: "The cart is empty. Add items before checking out." },
          isError: true,
        };
      }
      if (!cart.checkoutUrl) {
        return { result: { error: "Checkout is not available for this cart." }, isError: true };
      }
      context.cartId = cart.id;
      return {
        result: { checkoutUrl: cart.checkoutUrl, cart },
        cart,
        checkoutUrl: cart.checkoutUrl,
      };
    },
  },
];

export function findTool(name: string): AssistantTool | undefined {
  return assistantTools.find((tool) => tool.name === name);
}

// The model gets the facts it needs to answer questions; the full objects go to
// the UI as cards, so the reply does not have to repeat every product.
function summarizeForModel(product: AssistantProduct) {
  return {
    handle: product.handle,
    title: product.title,
    vendor: product.vendor,
    productType: product.productType,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    availableForSale: product.availableForSale,
    variants: product.variants,
  };
}
