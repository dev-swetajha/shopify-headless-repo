type HeroImage = { url: string; altText: string | null };

type HeroCollection = {
  title: string;
  handle: string;
  description: string;
  image: HeroImage | null;
  products: { nodes: readonly { featuredImage: HeroImage | null }[] };
};

export type HomeHeroData = {
  heading: string;
  description: string | null;
  image: HeroImage | null;
  to: string;
};

export type ShowcaseCollection = {
  handle: string;
  title: string;
  description: string;
  image: HeroImage;
};

export const SHOWCASE_COLLECTION_LIMIT = 4;

/**
 * Maps store collections to the homepage showcase cards. A collection with no
 * image of its own falls back to its first product image; one with neither is
 * left out so no card renders without a picture. The result is capped at
 * SHOWCASE_COLLECTION_LIMIT after that filtering, so the query should fetch
 * more collections than the limit.
 */
export function selectShowcaseCollections(
  collections: readonly HeroCollection[],
): ShowcaseCollection[] {
  return collections
    .flatMap((collection) => {
      const image = collection.image ?? collection.products.nodes[0]?.featuredImage ?? null;
      if (!image) return [];

      return [
        {
          handle: collection.handle,
          title: collection.title,
          description: collection.description.trim(),
          image,
        },
      ];
    })
    .slice(0, SHOWCASE_COLLECTION_LIMIT);
}

/**
 * Builds the homepage hero from the first collection passed in (the home query
 * requests the most recently updated one). Its title, description, and image
 * stay together, with its first product image as the image fallback. Without a
 * collection, the hero shows the shop name and links to the collections index.
 */
export function selectHomeHero(
  collections: readonly HeroCollection[],
  shopName: string,
): HomeHeroData {
  const collection = collections[0];
  if (!collection) {
    return { heading: shopName, description: null, image: null, to: "/collections" };
  }

  return {
    heading: collection.title,
    description: collection.description.trim() || null,
    image: collection.image ?? collection.products.nodes[0]?.featuredImage ?? null,
    to: `/collections/${collection.handle}`,
  };
}
