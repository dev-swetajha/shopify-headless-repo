import type { Env } from "~/lib/env";
import { getStoreDomain } from "~/lib/shop";

const ADMIN_API_VERSION = "2026-10";

const THEME_SETTINGS_QUERY = `
  query GetThemeSettings($themeId: ID!) {
    theme(id: $themeId) {
      id
      name
      role
      files(filenames: ["templates/index.json"], first: 1) {
        nodes {
          body {
            ... on OnlineStoreThemeFileBodyText {
              content
            }
          }
        }
      }
    }
  }
`;

// Shopify theme JSON files (e.g. config/settings_data.json) may start with
// /* ... */ or // comments, which JSON.parse rejects. Strip them, leaving
// string contents untouched.
export function parseThemeJson(raw: string): unknown {
  let out = "";
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && next === "*") {
      const end = raw.indexOf("*/", i + 2);
      i = end === -1 ? raw.length : end + 1;
      out += " ";
    } else if (ch === "/" && next === "/") {
      const end = raw.indexOf("\n", i + 2);
      i = end === -1 ? raw.length : end - 1;
      out += " ";
    } else {
      out += ch;
    }
  }
  return JSON.parse(out);
}

const SHOP_IMAGE_PREFIX = "shopify://shop_images/";

const FILES_QUERY = `
  query FindThemeImage($query: String!) {
    files(first: 10, query: $query) {
      nodes {
        ... on MediaImage {
          image {
            url
          }
        }
      }
    }
  }
`;

async function adminGraphql(
  env: Env,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(
    `https://${getStoreDomain(env)}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.PRIVATE_ADMIN_ACCESS_TOKEN ?? "",
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  return response.json();
}

// Theme settings reference images as shopify://shop_images/<filename>, which a
// browser cannot load. Look each one up in the store's Files and swap in its CDN
// URL. Unresolvable images are left as-is so the caller can skip them.
async function resolveShopImages(env: Env, node: unknown): Promise<void> {
  if (Array.isArray(node)) {
    await Promise.all(node.map((item) => resolveShopImages(env, item)));
    return;
  }
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && value.startsWith(SHOP_IMAGE_PREFIX)) {
      const filename = value.slice(SHOP_IMAGE_PREFIX.length);
      const stem = filename.replace(/\.[^.]+$/, "");
      try {
        const json = (await adminGraphql(env, FILES_QUERY, {
          query: stem,
        })) as {
          data?: { files?: { nodes: { image?: { url?: string } }[] } };
        };
        const match = json.data?.files?.nodes.find((file) =>
          file.image?.url
            ? new URL(file.image.url).pathname.endsWith(`/files/${filename}`)
            : false,
        );
        if (match?.image?.url) record[key] = match.image.url;
      } catch {
        // Leave the original value; the component renders without an image.
      }
    } else if (value && typeof value === "object") {
      await resolveShopImages(env, value);
    }
  }
}

export type ThemeSettingsResult =
  | { status: "not-configured" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      themeName: string;
      themeRole: string;
      settings: unknown;
    };

// The Admin API expects a global ID (gid://shopify/OnlineStoreTheme/<id>).
// Accept a bare numeric ID too, since that is what the Shopify admin URL shows.
export function toThemeGid(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return `gid://shopify/OnlineStoreTheme/${trimmed}`;
  }
  return trimmed;
}

// Runs on the server only (called from a route loader). The Admin API token
// never reaches the browser.
/** Turns an Admin API `errors` value of any shape (array, string, object) into one message. */
function adminErrorMessage(errors: unknown, status: number): string {
  if (typeof errors === "string" && errors.trim()) return errors.trim();
  if (Array.isArray(errors)) {
    const messages = errors
      .map((error) =>
        typeof error === "string"
          ? error
          : (error as { message?: unknown })?.message,
      )
      .filter(
        (message): message is string =>
          typeof message === "string" && message !== "",
      );
    if (messages.length > 0) return messages.join("; ");
  }
  if (
    errors &&
    typeof errors === "object" &&
    typeof (errors as { message?: unknown }).message === "string"
  ) {
    return (errors as { message: string }).message;
  }
  return `Admin API request failed with HTTP ${status}.`;
}

export async function getThemeSettings(env: Env): Promise<ThemeSettingsResult> {
  const rawThemeId = env.SHOP_THEME_ID;
  const adminToken = env.PRIVATE_ADMIN_ACCESS_TOKEN;
  if (!rawThemeId?.trim() || !adminToken) {
    return { status: "not-configured" };
  }
  const themeId = toThemeGid(rawThemeId);
  if (!themeId.startsWith("gid://shopify/OnlineStoreTheme/")) {
    return {
      status: "error",
      message:
        "SHOP_THEME_ID must be a theme GID (gid://shopify/OnlineStoreTheme/<id>) or its numeric ID.",
    };
  }

  try {
    const response = await fetch(
      `https://${getStoreDomain(env)}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
        },
        body: JSON.stringify({
          query: THEME_SETTINGS_QUERY,
          variables: { themeId },
        }),
      },
    );

    // Admin API errors are not always a GraphQL `errors` array: auth and routing failures
    // can come back as a string or an object, or as a non-JSON body.
    const json = (await response.json().catch(() => null)) as {
      data?: {
        theme?: {
          name: string;
          role: string;
          files: { nodes: { body?: { content?: string } }[] };
        } | null;
      };
      errors?: unknown;
    } | null;

    if (!response.ok || json?.errors) {
      return {
        status: "error",
        message: adminErrorMessage(json?.errors, response.status),
      };
    }

    const theme = json?.data?.theme;
    if (!theme) {
      return { status: "error", message: "Theme not found for SHOP_THEME_ID." };
    }

    const raw = theme.files.nodes[0]?.body?.content;
    const settings = raw ? parseThemeJson(raw) : null;
    if (settings) {
      await resolveShopImages(env, settings);
    }

    return {
      status: "ok",
      themeName: theme.name,
      themeRole: theme.role,
      settings,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
