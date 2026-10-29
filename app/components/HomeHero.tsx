
import { useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { Link } from "react-router";

import type { HomeHeroData } from "~/lib/home-hero";
import "./home-hero.css";

const collections = [
  {
    title: "Fragrances",
    description: "Scents that tell your story",
    image:
      "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=85",
    to: "/collections/fragrances",
  },
  {
    title: "Skincare",
    description: "Pure care for natural glow",
    image:
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=85",
    to: "/collections/skincare",
  },
  {
    title: "Home",
    description: "Elevate your living space",
    image:
      "https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=800&q=85",
    to: "/collections/home",
  },
  {
    title: "Lifestyle",
    description: "For a mindful tomorrow",
    image:
      "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=800&q=85",
    to: "/collections/lifestyle",
  },
];

export function HomeHero({ hero }: { hero: HomeHeroData }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [menuOpen, setMenuOpen] = useState(false);

  const image =
    hero.image && hero.image.url !== failedImageUrl
      ? hero.image
      : null;

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;

    const bounds = event.currentTarget.getBoundingClientRect();

    setPointer({
      x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
      y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
    });
  }

  const sceneStyle = {
    "--pointer-x": pointer.x,
    "--pointer-y": pointer.y,
  } as CSSProperties;

  return (
    <main className="aurora-page">
      {/* HERO */}
      <section
        className="luxury-hero"
        aria-labelledby="hero-heading"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setPointer({ x: 0, y: 0 })}
        style={sceneStyle}
      >
        {image && (
          <img
            className="luxury-hero__background"
            src={image.url}
            alt={image.altText ?? ""}
            loading="eager"
            fetchPriority="high"
            onError={() => setFailedImageUrl(image.url)}
          />
        )}

        <div className="luxury-hero__gradient" aria-hidden="true" />
        <div className="luxury-hero__grain" aria-hidden="true" />

        <header className="aurora-header">
          <Link to="/" className="aurora-logo">
            A U R O R A
          </Link>

          <button
            type="button"
            className="aurora-menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? "✕" : "☰"}
          </button>

          <nav
            className={`aurora-nav ${menuOpen ? "is-open" : ""}`}
            aria-label="Main navigation"
          >
            <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/collections/all" onClick={() => setMenuOpen(false)}>Shop</Link>
            <a href="#featured-collections" onClick={() => setMenuOpen(false)}>
              Collections
            </a>
            <a href="#our-story" onClick={() => setMenuOpen(false)}>
              About
            </a>
          </nav>

          <div className="aurora-header__actions">
            <Link to="/search" aria-label="Search">⌕</Link>
            <Link to="/account" aria-label="Account">♙</Link>
            <Link to="/cart" aria-label="Cart">♧</Link>
          </div>
        </header>

        <div className="luxury-hero__scene" aria-hidden="true">
          <div className="luxury-hero__halo" />

          <div className="luxury-hero__orbit luxury-hero__orbit--one">
            <span />
          </div>

          <div className="luxury-hero__orbit luxury-hero__orbit--two">
            <span />
          </div>

          <div className="luxury-hero__object">
            <div className="luxury-hero__object-glow" />
            <div className="luxury-hero__object-body">
              <span className="luxury-hero__object-cap" />
              <span className="luxury-hero__object-label">
                A U R O R A
                <small>EAU DE PARFUM</small>
              </span>
            </div>
          </div>

          <span className="luxury-hero__particle luxury-hero__particle--one" />
          <span className="luxury-hero__particle luxury-hero__particle--two" />
          <span className="luxury-hero__particle luxury-hero__particle--three" />
          <span className="luxury-hero__particle luxury-hero__particle--four" />
        </div>

        <div className="luxury-hero__content">
          <span className="luxury-hero__eyebrow">NEW COLLECTION</span>

          <h1 id="hero-heading" className="luxury-hero__title">
            {hero.heading || "Timeless Elegance"}
          </h1>

          <p className="luxury-hero__description">
            {hero.description ||
              "Discover a world of refined beauty, where nature meets modern luxury."}
          </p>

          <div className="luxury-hero__actions">
            <Link to={hero.to || "/collections/all"} className="luxury-hero__button">
              Explore Collection <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <a href="#featured-collections" className="luxury-hero__scroll">
          <span className="luxury-hero__scroll-mouse" />
          Scroll
        </a>

        <div className="luxury-hero__bottom">
          <span>CRAFTED TO INSPIRE</span>
          <a href="#featured-collections">
            <span className="luxury-hero__scroll-line" />
            SCROLL TO EXPLORE
          </a>
          <span>01 — 03</span>
        </div>
      </section>

      {/* FEATURED COLLECTIONS */}
      <section
        id="featured-collections"
        className="aurora-collections"
        aria-labelledby="collections-heading"
      >
        <div className="aurora-section-heading">
          <div>
            <span className="aurora-eyebrow aurora-eyebrow--dark">
              FEATURED COLLECTIONS
            </span>
            <h2 id="collections-heading">Explore Our World</h2>
          </div>

          <Link to="/collections/all" className="aurora-view-all">
            View All <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="aurora-collection-grid">
          {collections.map((collection, index) => (
            <Link
              key={collection.title}
              to={collection.to}
              className="aurora-collection-card"
              style={{ "--card-index": index } as CSSProperties}
            >
              <img src={collection.image} alt="" loading="lazy" />
              <div className="aurora-collection-card__shade" />

              <div className="aurora-collection-card__content">
                <h3>{collection.title}</h3>
                <div>
                  <span>{collection.description}</span>
                  <span className="aurora-card-arrow" aria-hidden="true">
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* OUR STORY */}
      <section id="our-story" className="aurora-story">
        <div className="aurora-story__content">
          <span className="aurora-eyebrow">OUR STORY</span>
          <h2>More Than<br />Just a Product</h2>
          <p>
            We believe in creating experiences that inspire,
            uplift, and make life more beautiful.
          </p>

          <Link to="/pages/our-story" className="luxury-hero__button">
            Our Story <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="aurora-story__visual" aria-hidden="true">
          <div className="aurora-story__sun" />
          <div className="aurora-story__stone" />
          <div className="aurora-story__plant">✳</div>
        </div>
      </section>
    </main>
  );
}
