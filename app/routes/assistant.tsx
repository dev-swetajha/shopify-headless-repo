import { AssistantChat } from "~/components/AssistantChat";
import { formatPageTitle, getShopNameFromRootMatch } from "~/lib/storefront-shop";

import type { Route } from "./+types/assistant";

export function meta({ matches }: Route.MetaArgs) {
  return [{ title: formatPageTitle("Shopping assistant", getShopNameFromRootMatch(matches[0])) }];
}

export default function AssistantRoute() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="max-w-page px-margin mx-auto flex w-full flex-1 flex-col gap-8 py-12"
    >
      <header className="flex flex-col gap-2">
        <h1 className="type-display text-on-surface">Shopping assistant</h1>
        <p className="text-on-surface-secondary text-sm">
          Ask for products, compare options, or check details before you buy.
        </p>
      </header>
      <AssistantChat />
    </main>
  );
}
