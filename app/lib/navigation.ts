// Header and footer navigation from the store's menus, read once per request by the
// root loader. The header falls back to the collections index when the store has no
// main menu, so it always has a way into the catalog.

import { isMockShopDomain } from "~/lib/shop";

export type NavItem = {
  id: string;
  title: string;
  /** App path (with search and hash) for store pages, or the full URL for external links. */
  to: string;
  external: boolean;
};

/** A footer column: a top-level footer menu item with its child links. */
export type FooterColumn = {
  id: string;
  title: string;
  links: NavItem[];
};

export type FooterMenu = {
  columns: FooterColumn[];
  /** Top-level footer items without children, shown as a row of legal-style links. */
  legalLinks: NavItem[];
};

type MenuItem = {
  id: string;
  title: string;
  url: string | null;
  items?: readonly MenuItem[] | null;
};

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

/** Maps one menu item to a link; returns `null` when it has no title or an unparseable URL. */
function toNavItem(item: MenuItem, storeDomain: string): NavItem | null {
  const title = item.title.trim();
  if (!title || !item.url) return null;

  let url: URL;
  try {
    url = new URL(item.url, `https://${storeDomain}`);
  } catch {
    return null;
  }

  if (isStoreHost(url.hostname, storeDomain)) {
    return { id: item.id, title, to: `${url.pathname}${url.search}${url.hash}`, external: false };
  }
  return { id: item.id, title, to: url.href, external: true };
}

function toNavItems(items: readonly MenuItem[] | null | undefined, storeDomain: string) {
  return (items ?? []).flatMap((item) => {
    const navItem = toNavItem(item, storeDomain);
    return navItem ? [navItem] : [];
  });
}

/** Maps main-menu items to header links; falls back to the collections index when empty. */
export function normalizeMenuItems(
  items: readonly MenuItem[] | null | undefined,
  storeDomain: string,
): NavItem[] {
  const navItems = toNavItems(items, storeDomain);
  return navItems.length > 0 ? navItems : [...FALLBACK_NAV_ITEMS];
}

/**
 * Maps footer-menu items to footer columns and legal links. A top-level item with
 * valid children becomes a column titled by the item; a top-level item without any
 * is a single link and goes to the legal row. Invalid entries are dropped, and the
 * result is empty (no fallback) when the store has no footer menu.
 */
export function normalizeFooterMenu(
  items: readonly MenuItem[] | null | undefined,
  storeDomain: string,
): FooterMenu {
  const columns: FooterColumn[] = [];
  const legalLinks: NavItem[] = [];

  for (const item of items ?? []) {
    const links = toNavItems(item.items, storeDomain);
    if (links.length > 0) {
      const title = item.title.trim();
      if (title) columns.push({ id: item.id, title, links });
      continue;
    }

    const navItem = toNavItem(item, storeDomain);
    if (navItem) legalLinks.push(navItem);
  }

  return { columns, legalLinks };
}
