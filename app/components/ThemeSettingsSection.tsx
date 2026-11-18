import { Link } from "react-router";

import type { ThemeSettingsResult } from "~/lib/theme-settings";

// Shape of a Shopify theme template file (templates/index.json): sections keyed
// by ID, plus the order they render in. Fields are optional because merchants
// and themes author the JSON.
type ThemeSection = {
  type?: string;
  disabled?: boolean;
  settings?: Record<string, unknown>;
};

export type ThemeTemplate = {
  sections?: Record<string, ThemeSection>;
  order?: string[];
};

type Settings = Record<string, unknown> | undefined;

function text(settings: Settings, key: string): string | undefined {
  const value = settings?.[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

// Full-bleed banner: image as the background, heading, copy and button on top.
function BannerSection({ settings }: { settings: Settings }) {
  const image = text(settings, "image");
  const heading = text(settings, "heading");
  const body = text(settings, "text");
  const buttonLabel = text(settings, "button_label");
  const buttonLink = text(settings, "button_link");

  return (
    <section className="relative isolate flex min-h-[70vh] items-center overflow-hidden bg-neutral-900 text-white">
      {image ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/40 to-black/10"
      />
      <div className="max-w-page px-margin mx-auto w-full py-24">
        {heading ? (
          <h2 className="type-heading-xl max-w-2xl text-white">{heading}</h2>
        ) : null}
        {body ? (
          <p className="mt-4 max-w-xl text-lg text-white/90">{body}</p>
        ) : null}
        {buttonLabel && buttonLink ? (
          <Link
            to={buttonLink}
            className="min-h-touch-target focus-visible:outline-accent mt-8 inline-flex items-center bg-white px-6 py-3 text-sm font-medium text-neutral-900 no-underline hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-opacity"
          >
            {buttonLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

// Plain text section: heading and copy on the page background.
function BasicSection({ settings }: { settings: Settings }) {
  const heading = text(settings, "heading");
  const body = text(settings, "text");
  if (!heading && !body) return null;

  return (
    <section className="max-w-page px-margin mx-auto w-full py-16">
      {heading ? <h2 className="type-heading-xl">{heading}</h2> : null}
      {body ? (
        <p className="mt-4 max-w-2xl text-lg text-neutral-700">{body}</p>
      ) : null}
    </section>
  );
}

// Section types without a design fall back to their heading and text, if any.
function SectionView({ section }: { section: ThemeSection }) {
  switch (section.type) {
    case "banner":
      return <BannerSection settings={section.settings} />;
    case "basic-section":
      return <BasicSection settings={section.settings} />;
    default:
      return <BasicSection settings={section.settings} />;
  }
}

export function ThemeTemplateView({ template }: { template: ThemeTemplate }) {
  const sections = template.sections ?? {};
  const order = template.order ?? Object.keys(sections);
  const rendered = order.filter((id) => sections[id] && !sections[id].disabled);

  return (
    <>
      {rendered.map((id) => (
        <SectionView key={id} section={sections[id]} />
      ))}
    </>
  );
}

export function ThemeSettingsSection({
  result,
}: {
  result: ThemeSettingsResult;
}) {
  if (result.status === "ok") {
    return result.settings && typeof result.settings === "object" ? (
      <ThemeTemplateView template={result.settings as ThemeTemplate} />
    ) : null;
  }

  return (
    <section className="max-w-page px-margin mx-auto w-full py-12">
      {result.status === "error" ? (
        <p className="text-sm text-red-700">
          Could not load theme template: {result.message}
        </p>
      ) : (
        <p className="text-sm">
          Set PUBLIC_STORE_DOMAIN, PRIVATE_ADMIN_ACCESS_TOKEN, and SHOP_THEME_ID
          in .env to show the theme template.
        </p>
      )}
    </section>
  );
}
