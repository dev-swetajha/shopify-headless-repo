import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import type { CartSummary } from "~/lib/assistant/cart";
import type { AssistantProduct } from "~/lib/assistant/catalog";
import { useCartActions } from "~/lib/cart";

type ChatEntry = {
  role: "user" | "assistant";
  content: string;
  products?: AssistantProduct[];
  checkoutUrl?: string | null;
};

type ChatApiReply = {
  reply: string;
  products: AssistantProduct[];
  cart: CartSummary | null;
  checkoutUrl: string | null;
  cartChanged: boolean;
};

const SUGGESTIONS = [
  "What do you have in hoodies?",
  "Show me something for a gift",
  "Tell me about the first product you showed me",
];

export function AssistantChat() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartSummary | null>(null);
  const { refresh: refreshCart } = useCartActions();

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;

    const history = [...entries, { role: "user" as const, content }];
    setEntries(history);
    setDraft("");
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content: text }) => ({ role, content: text })),
          shownProducts: shownProductsOf(history),
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | ChatApiReply
        | { error?: string }
        | null;

      if (!response.ok || !body || !("reply" in body)) {
        setError(
          (body && "error" in body && body.error) || "The assistant couldn't respond. Try again.",
        );
        setEntries(entries);
        setDraft(content);
        return;
      }

      setEntries([
        ...history,
        {
          role: "assistant",
          content: body.reply,
          products: body.products,
          checkoutUrl: body.checkoutUrl,
        },
      ]);
      if (body.cart !== undefined) setCart(body.cart);
      // The chat wrote to the cart without the storefront's cart forms, so re-read it
      // to keep the header count in step.
      if (body.cartChanged) void refreshCart();
    } catch {
      setError("Network error. Check your connection and try again.");
      setEntries(entries);
      setDraft(content);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <div className="flex flex-col gap-6">
      {cart && cart.lines.length > 0 ? (
        <section
          aria-label="Your cart"
          className="border-border flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm"
        >
          <p className="text-on-surface">
            Cart: {cart.totalQuantity} {cart.totalQuantity === 1 ? "item" : "items"} · {cart.total}
          </p>
          {cart.checkoutUrl ? <CheckoutLink href={cart.checkoutUrl} /> : null}
        </section>
      ) : null}

      {entries.length === 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              disabled={pending}
              className="border-border text-on-surface hover:bg-surface-secondary rounded-full border px-4 py-2 text-sm disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <ol role="log" aria-live="polite" aria-label="Conversation" className="flex flex-col gap-6">
        {entries.map((entry, index) => (
          <li
            key={index}
            className={entry.role === "user" ? "flex justify-end" : "flex flex-col gap-4"}
          >
            <p
              className={
                entry.role === "user"
                  ? "bg-surface-secondary text-on-surface wrap-anywhere max-w-[80%] rounded-2xl px-4 py-2 text-sm"
                  : "text-on-surface wrap-anywhere max-w-[80ch] text-sm leading-relaxed whitespace-pre-line"
              }
            >
              <span className="sr-only">{entry.role === "user" ? "You: " : "Assistant: "}</span>
              {entry.content}
            </p>
            {entry.checkoutUrl ? <CheckoutLink href={entry.checkoutUrl} /> : null}
            {entry.products && entry.products.length > 0 ? (
              <ul
                role="list"
                aria-label="Products"
                className="grid grid-cols-2 gap-4 md:grid-cols-3"
              >
                {entry.products.map((product) => (
                  <li key={product.handle}>
                    <AssistantProductCard product={product} />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      {pending ? (
        <p role="status" className="text-on-surface-secondary text-sm">
          Thinking…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <label htmlFor="assistant-input" className="sr-only">
          Message the shopping assistant
        </label>
        <input
          id="assistant-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          placeholder="Ask about products, sizes, or prices"
          autoComplete="off"
          className="border-border text-on-surface bg-surface h-11 min-w-0 flex-1 rounded-md border px-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending || draft.trim() === ""}
          className="rounded-button button-primary inline-flex h-11 items-center px-5 text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Every product card shown so far, de-duplicated, in the order the shopper saw them.
function shownProductsOf(entries: ChatEntry[]) {
  const seen = new Map<string, AssistantProduct>();
  for (const entry of entries) {
    for (const product of entry.products ?? []) {
      if (!seen.has(product.handle)) seen.set(product.handle, product);
    }
  }
  return [...seen.values()].map((product) => ({
    handle: product.handle,
    title: product.title,
    price: product.price,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      availableForSale: variant.availableForSale,
    })),
  }));
}

// A plain link to the store's checkout. Checkout runs on the storefront, not in the chat.
function CheckoutLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="rounded-button button-primary inline-flex h-10 w-fit items-center px-4 text-sm font-medium no-underline"
    >
      Go to checkout
    </a>
  );
}

function AssistantProductCard({ product }: { product: AssistantProduct }) {
  const badge = !product.availableForSale ? "Sold out" : product.compareAtPrice ? "Sale" : null;

  return (
    <article className="flex h-full flex-col gap-2" data-testid="assistant-product-card">
      <Link
        to={product.url}
        className="rounded-card bg-surface-secondary relative block aspect-square overflow-hidden"
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.imageAlt}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
        {badge ? (
          <span className="bg-surface text-on-surface absolute start-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium">
            {badge}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-on-surface line-clamp-2 text-sm font-medium">
          <Link to={product.url} className="text-on-surface">
            {product.title}
          </Link>
        </h3>
        <p className="text-on-surface text-sm">
          {product.price}
          {product.compareAtPrice ? (
            <s className="text-on-surface-secondary ms-2">{product.compareAtPrice}</s>
          ) : null}
        </p>
      </div>
    </article>
  );
}
