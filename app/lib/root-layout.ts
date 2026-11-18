import { gql, type StorefrontApi, type StorefrontClient } from "@shopify/hydrogen";

import {
  normalizeFooterMenu,
  normalizeMenuItems,
  type FooterMenu,
  type NavItem,
} from "~/lib/navigation";
import { normalizeStorefrontShop, type StorefrontShop } from "~/lib/storefront-shop";

export const ROOT_LAYOUT_QUERY = gql(`
  query RootLayout($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    shop {
      id
      name
      brand {
        logo {
          alt
          image {
            url
            altText
            width
            height
          }
        }
      }
      paymentSettings {
        acceptedCardBrands
        supportedDigitalWallets
      }
    }
    localization {
      country {
        currency {
          isoCode
        }
      }
    }
    menu(handle: "main-menu") {
      items {
        id
        title
        url
      }
    }
    footerMenu: menu(handle: "footer") {
      items {
        id
        title
        url
        items {
          id
          title
          url
        }
      }
    }
  }
`);

export type RootLayoutQueryResult = StorefrontApi.ResultOf<typeof ROOT_LAYOUT_QUERY>;

type RootLayoutLoaderData = {
  shopId: string;
  shopInfo: StorefrontShop;
  navItems: NavItem[];
  footerMenu: FooterMenu;
  // Browse events carry no price, so shopify.js reads their currency from
  // window.Shopify.currency.active. The cart tracker only sets that once a cart exists,
  // so the bootstrap needs it up front.
  currency: string;
};

export async function loadRootLayout(
  storefrontClient: Pick<StorefrontClient, "graphql">,
  storeDomain: string,
): Promise<RootLayoutLoaderData> {
  const layoutResult = await storefrontClient.graphql(ROOT_LAYOUT_QUERY);

  if (layoutResult.errors) {
    console.error(
      `Root layout query failed: ${layoutResult.errors.map(({ message }) => message).join("\n")}`,
    );
  }

  // Upstream error details are logged above, not exposed through the boundary.
  if (!layoutResult.data) throw new Error("Root layout data is unavailable.");

  const { shop, localization, menu, footerMenu } = layoutResult.data;
  return {
    shopId: shop.id,
    shopInfo: normalizeStorefrontShop(shop),
    navItems: normalizeMenuItems(menu?.items, storeDomain),
    footerMenu: normalizeFooterMenu(footerMenu?.items, storeDomain),
    currency: localization.country.currency.isoCode,
  };
}
