import { gql, type StorefrontClient } from "@shopify/hydrogen";

import { formatPrice } from "~/lib/money";

// Storefront reads for the shopping assistant. Both the MCP endpoint and the chat
// agent call these through the tool registry, so they share one catalog view.

export const ASSISTANT_PRODUCT_FRAGMENT = gql(`
  fragment AssistantProduct on Product {
    id
    handle
    title
    vendor
    productType
    availableForSale
    featuredImage {
      url
      altText
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    variants(first: 10) {
      nodes {
        id
        title
        availableForSale
        price {
          amount
          currencyCode
        }
        selectedOptions {
          name
          value
        }
      }
    }
  }
`);

const SEARCH_PRODUCTS_QUERY = gql(
  `
    query AssistantSearchProducts($term: String!, $first: Int!) {
      search(query: $term, types: [PRODUCT], first: $first, unavailableProducts: HIDE) {
        nodes {
          ... on Product {
            ...AssistantProduct
          }
        }
      }
    }
  `,
  [ASSISTANT_PRODUCT_FRAGMENT],
);

const PRODUCT_DETAILS_QUERY = gql(
  `
    query AssistantProductDetails($handle: String!) {
      product(handle: $handle) {
        ...AssistantProduct
        description(truncateAt: 1500)
        tags
        options {
          name
          optionValues {
            name
          }
        }
      }
    }
  `,
  [ASSISTANT_PRODUCT_FRAGMENT],
);

// Shape of a product as the model and the chat UI see it. Prices are formatted
// on the server so the model quotes exactly what the storefront shows.
type RawProduct = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  availableForSale: boolean;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  compareAtPriceRange: { minVariantPrice: { amount: string; currencyCode: string } } | null;
  variants: {
    nodes: Array<{
      id: string;
      title: string;
      availableForSale: boolean;
      price: { amount: string; currencyCode: string };
      selectedOptions: Array<{ name: string; value: string }>;
    }>;
  };
};

export type AssistantVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: string;
  options: Record<string, string>;
};

export type AssistantProduct = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  url: string;
  availableForSale: boolean;
  price: string;
  priceIsRange: boolean;
  compareAtPrice: string | null;
  imageUrl: string | null;
  imageAlt: string;
  variants: AssistantVariant[];
};

function toAssistantProduct(raw: RawProduct): AssistantProduct {
  const min = raw.priceRange.minVariantPrice;
  const max = raw.priceRange.maxVariantPrice;
  const compare = raw.compareAtPriceRange?.minVariantPrice;
  const priceIsRange = min.amount !== max.amount;
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    vendor: raw.vendor,
    productType: raw.productType,
    url: `/products/${raw.handle}`,
    availableForSale: raw.availableForSale,
    price: priceIsRange ? `from ${formatPrice(min)}` : formatPrice(min),
    priceIsRange,
    compareAtPrice: compare && Number.parseFloat(compare.amount) > Number.parseFloat(min.amount)
      ? formatPrice(compare)
      : null,
    imageUrl: raw.featuredImage?.url ?? null,
    imageAlt: raw.featuredImage?.altText ?? raw.title,
    variants: raw.variants.nodes.map((variant) => ({
      id: variant.id,
      title: variant.title,
      availableForSale: variant.availableForSale,
      price: formatPrice(variant.price),
      options: Object.fromEntries(variant.selectedOptions.map((o) => [o.name, o.value])),
    })),
  };
}

export async function searchProducts(
  storefrontClient: StorefrontClient,
  term: string,
  first: number,
): Promise<AssistantProduct[]> {
  const { data, errors } = await storefrontClient.graphql(SEARCH_PRODUCTS_QUERY, {
    variables: { term, first },
  });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join("; "));
  const nodes = (data?.search.nodes ?? []) as unknown as RawProduct[];
  return nodes.filter((node) => node?.handle).map(toAssistantProduct);
}

export type AssistantProductDetails = AssistantProduct & {
  description: string;
  tags: string[];
  options: Array<{ name: string; values: string[] }>;
};

export async function getProductDetails(
  storefrontClient: StorefrontClient,
  handle: string,
): Promise<AssistantProductDetails | null> {
  const { data, errors } = await storefrontClient.graphql(PRODUCT_DETAILS_QUERY, {
    variables: { handle },
  });
  if (errors?.length) throw new Error(errors.map((e) => e.message).join("; "));
  const raw = data?.product as (RawProduct & {
    description: string;
    tags: string[];
    options: Array<{ name: string; optionValues: Array<{ name: string }> }>;
  }) | null;
  if (!raw) return null;
  return {
    ...toAssistantProduct(raw),
    description: raw.description,
    tags: raw.tags,
    options: raw.options.map((o) => ({ name: o.name, values: o.optionValues.map((v) => v.name) })),
  };
}
