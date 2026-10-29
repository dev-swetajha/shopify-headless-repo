// Header navigation from the store's menu, read once per request by the root loader.
// Falls back to the collections index when the store has no menu, so the header
// always has a way into the catalog.

import { isMockShopDomain } from "~/lib/shop";

export type NavItem = {
  id: string;
  title: string;
  /** App path (with search and hash) for store pages, or the full URL for external links. */
  to: string;
  external: boolean;
};

type MenuItem = { id: string; title: string; url: string | null };

const FALLBACK_NAV_ITEMS: readonly NavItem[] = [
  { id: "collections", title: "Collections", to: "/collections", external: false },
];

// Menu URLs are usually absolute on the store's own domain, so they resolve in-app.
// Hosts on mock.shop or myshopify.com are also store hosts, even when they are not
// the configured domain.
function isStoreHost(hostname: string, storeDomain: string): boolean {
  return (
    hostname === storeDomain || hostname.endsWith(".myshopify.com") || isMockShopDomain(hostname)
  );
}

/** Maps menu items to header links; items with no title or an unparseable URL are dropped. */
export function normalizeMenuItems(
  items: readonly MenuItem[] | null | undefined,
  storeDomain: string,
): NavItem[] {
  const navItems = (items ?? []).flatMap((item): NavItem[] => {
    const title = item.title.trim();
    if (!title || !item.url) return [];

    let url: URL;
    try {
      url = new URL(item.url, `https://${storeDomain}`);
    } catch {
      return [];
    }

    if (isStoreHost(url.hostname, storeDomain)) {
      return [
        { id: item.id, title, to: `${url.pathname}${url.search}${url.hash}`, external: false },
      ];
    }
    return [{ id: item.id, title, to: url.href, external: true }];
  });

  return navItems.length > 0 ? navItems : [...FALLBACK_NAV_ITEMS];
}
