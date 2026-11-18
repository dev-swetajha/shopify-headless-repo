import { Link } from "react-router";

import type { FooterMenu, NavItem } from "~/lib/navigation";
import type { StorefrontShop } from "~/lib/storefront-shop";

import { PaymentMethodIcon } from "./PaymentMethodIcon";

const linkClass =
  "min-h-touch-target text-on-surface-secondary hover:text-on-surface focus-visible:outline-accent inline-flex items-center font-normal no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-colors";

const headingClass = "type-overline text-on-surface-secondary mb-3";

function FooterLink({ item }: { item: NavItem }) {
  return item.external ? (
    <a href={item.to} className={linkClass}>
      {item.title}
    </a>
  ) : (
    <Link to={item.to} className={linkClass}>
      {item.title}
    </Link>
  );
}

function FooterLinkList({ items }: { items: NavItem[] }) {
  return (
    <ul role="list" className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id}>
          <FooterLink item={item} />
        </li>
      ))}
    </ul>
  );
}

export function Footer({
  shopInfo,
  footerMenu,
}: {
  shopInfo: StorefrontShop;
  footerMenu: FooterMenu;
}) {
  const year = new Date().getFullYear();
  const hasPaymentMethods = shopInfo.paymentMethods.length > 0;
  const hasLegalLinks = footerMenu.legalLinks.length > 0;

  return (
    <footer className="border-border bg-surface-secondary/40 border-t">
      <div className="max-w-page px-margin mx-auto w-full pt-12 pb-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-12">
          <div className="flex flex-col gap-6 md:col-span-4">
            <Link
              to="/"
              aria-label={shopInfo.name}
              className="focus-visible:outline-accent inline-flex w-fit items-center rounded-sm text-lg font-medium text-on-surface no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {shopInfo.logo ? (
                <img
                  src={shopInfo.logo.url}
                  alt={shopInfo.logo.altText ?? shopInfo.name}
                  width={shopInfo.logo.width ?? undefined}
                  height={shopInfo.logo.height ?? undefined}
                  loading="lazy"
                  className="h-auto max-h-10 w-auto max-w-48 object-contain"
                />
              ) : (
                <span className="wrap-anywhere">{shopInfo.name}</span>
              )}
            </Link>

            {hasPaymentMethods ? (
              <div>
                <h2 id="footer-payment-methods-heading" className={headingClass}>
                  Payment methods
                </h2>
                <ul
                  role="list"
                  aria-labelledby="footer-payment-methods-heading"
                  className="flex flex-wrap items-center gap-2"
                >
                  {shopInfo.paymentMethods.map((method) => (
                    <li key={method} className="max-w-full">
                      <PaymentMethodIcon method={method} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:col-span-8">
            {footerMenu.columns.map((column, index) => (
              <nav
                key={column.id}
                aria-labelledby={`footer-menu-heading-${index}`}
                className="min-w-0"
              >
                <h2 id={`footer-menu-heading-${index}`} className={headingClass}>
                  {column.title}
                </h2>
                <FooterLinkList items={column.links} />
              </nav>
            ))}
          </div>
        </div>

        <div className="border-border text-on-surface-secondary mt-10 flex flex-col gap-4 border-t pt-6 text-xs md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {shopInfo.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {hasLegalLinks ? (
              <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {footerMenu.legalLinks.map((item) => (
                  <FooterLink key={item.id} item={item} />
                ))}
              </nav>
            ) : null}
            <a href="#" className={`${linkClass} self-start md:self-auto`}>
              Back to top
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
