import { Link } from "react-router";

import type { NavItem } from "~/lib/navigation";
import type { StorefrontShop } from "~/lib/storefront-shop";

import { PaymentMethodIcon } from "./PaymentMethodIcon";

const linkClass =
  "min-h-touch-target text-on-surface-secondary hover:text-on-surface focus-visible:outline-accent inline-flex items-center font-normal no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-colors";

const headingClass = "type-overline text-on-surface-secondary mb-3";

export function Footer({ shopInfo, navItems }: { shopInfo: StorefrontShop; navItems: NavItem[] }) {
  const year = new Date().getFullYear();
  const hasPaymentMethods = shopInfo.paymentMethods.length > 0;

  return (
    <footer className="border-border bg-surface-secondary/40 border-t">
      <div className="max-w-page px-margin mx-auto w-full pt-12 pb-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link
              to="/"
              aria-label={shopInfo.name}
              className="focus-visible:outline-accent inline-flex items-center rounded-sm text-lg font-medium text-on-surface no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
          </div>

          {navItems.length > 0 ? (
            <nav aria-labelledby="footer-shop-heading" className="md:col-span-2">
              <h2 id="footer-shop-heading" className={headingClass}>
                Shop
              </h2>
              <ul role="list" className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <li key={item.id}>
                    {item.external ? (
                      <a href={item.to} className={linkClass}>
                        {item.title}
                      </a>
                    ) : (
                      <Link to={item.to} className={linkClass}>
                        {item.title}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <nav aria-labelledby="footer-customer-care-heading" className="md:col-span-2">
            <h2 id="footer-customer-care-heading" className={headingClass}>
              Customer care
            </h2>
            <ul role="list" className="flex flex-col gap-1">
              <li>
                <Link to="/search" className={linkClass}>
                  Search
                </Link>
              </li>
              <li>
                <Link to="/cart" className={linkClass}>
                  Cart
                </Link>
              </li>
              <li>
                <Link to="/account" className={linkClass}>
                  Account
                </Link>
              </li>
            </ul>
          </nav>

          {hasPaymentMethods ? (
            <div className="md:col-span-3">
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

        <div className="border-border text-on-surface-secondary mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {shopInfo.name}. All rights reserved.
          </p>
          <a href="#" className={`${linkClass} self-start sm:self-auto`}>
            Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}
