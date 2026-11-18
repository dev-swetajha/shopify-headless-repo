import type { StorefrontClient } from "@shopify/hydrogen";

import type { CartData } from "~/lib/cart";
import { cartHandlers } from "~/lib/cart-handlers";
import { formatPrice } from "~/lib/money";

// Cart reads and writes for the assistant. These go through Hydrogen's cart
// handlers, the same ones the site's cart uses, so the `cart` cookie, the header
// count, and checkout URLs stay consistent with the rest of the storefront.

export type CartLineSummary = {
  id: string;
  title: string;
  variantTitle: string;
  quantity: number;
  total: string;
};

export type CartSummary = {
  id: string;
  totalQuantity: number;
  subtotal: string;
  total: string;
  lines: CartLineSummary[];
  checkoutUrl: string | null;
};

export type CartOutcome =
  | { ok: true; cart: CartSummary | null; setCookies: string[] }
  | { ok: false; message: string; setCookies: string[] };

export function summarizeCart(cart: CartData): CartSummary {
  return {
    id: cart.id,
    totalQuantity: cart.totalQuantity,
    subtotal: formatPrice(cart.cost.subtotalAmount),
    total: formatPrice(cart.cost.totalAmount),
    lines: cart.lines.nodes.map((line) => {
      const merchandise = line.merchandise as {
        title?: string;
        product?: { title?: string };
      };
      return {
        id: line.id,
        title: merchandise.product?.title ?? "Item",
        variantTitle: merchandise.title ?? "",
        quantity: line.quantity,
        total: formatPrice(line.cost.totalAmount),
      };
    }),
    checkoutUrl: cart.checkoutUrl ?? null,
  };
}

function cookieOnlyHeaders(request: Request, extra: Record<string, string> = {}): Headers {
  const headers = new Headers(extra);
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  return headers;
}

/** Reads a cart by ID, or the cart named by the request's `cart` cookie when no ID is given. */
export async function readCart(
  {
    storefrontClient,
    request,
  }: { storefrontClient: StorefrontClient; request: Request },
  cartId?: string,
): Promise<CartSummary | null> {
  const url = new URL(request.url);
  if (cartId) url.searchParams.set("cartId", cartId);
  const result = await cartHandlers.get({
    storefrontClient,
    request: new Request(url, { headers: cookieOnlyHeaders(request) }),
  });
  const cart = (result.data as { cart?: CartData | null }).cart;
  return cart ? summarizeCart(cart) : null;
}

/**
 * Adds one variant to the cart. Without a cart ID the handler uses the request's
 * cart cookie, or creates a cart and returns a Set-Cookie to store it.
 */
export async function addVariantToCart(
  {
    storefrontClient,
    request,
  }: { storefrontClient: StorefrontClient; request: Request },
  line: { merchandiseId: string; quantity: number },
  cartId?: string,
): Promise<CartOutcome> {
  const body = { lines: [line], ...(cartId ? { cartId } : {}) };
  const postRequest = new Request(new URL("/api/cart", request.url), {
    method: "POST",
    headers: cookieOnlyHeaders(request, { "content-type": "application/json" }),
    body: JSON.stringify(body),
  });

  const result = await cartHandlers.post({ storefrontClient, request: postRequest });

  if (result.type !== "json") {
    const message = result.type === "error" ? result.error.message : "The cart could not be updated.";
    return { ok: false, message, setCookies: [] };
  }

  const setCookies = new Headers(result.headers).getSetCookie();
  const data = result.data as {
    cart?: CartData | null;
    userErrors?: Array<{ message: string }>;
  };
  if (data.userErrors?.length) {
    return {
      ok: false,
      message: data.userErrors.map((error) => error.message).join("; "),
      setCookies,
    };
  }
  return {
    ok: true,
    cart: data.cart ? summarizeCart(data.cart) : null,
    setCookies,
  };
}
