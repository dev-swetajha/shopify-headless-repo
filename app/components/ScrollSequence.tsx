// Scroll-bound image sequence: a tall section whose sticky canvas shows one frame per
// scroll position. Scroll progress picks the frame index; time plays no part.
//
// Pass `frameUrls` to play real images in order. Without them, the component draws
// generated demo frames, so it works with no assets.

import { useEffect, useRef, useState } from "react";

/** Height of the scroll track in viewport heights. More height means slower playback. */
const TRACK_VH = 300;
const DEMO_FRAME_COUNT = 120;

export type ScrollSequenceProps = {
  heading: string;
  description: string;
  /** Frame image URLs in playback order. Omit to play the generated demo frames. */
  frameUrls?: readonly string[];
};

/** Clamps a number into [0, 1]. */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Scroll progress through the track: 0 when the section's top reaches the viewport
 * top, 1 when its bottom reaches the viewport bottom (the sticky frame stops there).
 */
export function getScrollProgress(
  sectionTop: number,
  sectionHeight: number,
  viewportHeight: number,
) {
  const scrollable = sectionHeight - viewportHeight;
  if (scrollable <= 0) return 0;
  return clamp01(-sectionTop / scrollable);
}

/** Maps progress in [0, 1] to a frame index in [0, frameCount - 1]. */
export function getFrameIndex(progress: number, frameCount: number): number {
  return Math.round(clamp01(progress) * (frameCount - 1));
}

/** Draws one generated frame: flowing bands, with `t` in [0, 1] covering one loop. */
function drawDemoFrame(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  ctx.fillStyle = "#f5f1ee";
  ctx.fillRect(0, 0, width, height);

  const bandCount = 14;
  const phase = t * Math.PI * 2;
  for (let band = 0; band < bandCount; band++) {
    const k = band / bandCount;
    const baseY = height * (0.2 + 0.6 * k);
    const amplitude = height * 0.06 * (1 - k * 0.5);

    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const y = baseY + Math.sin((x / width) * Math.PI * 3 + phase + k * 2.2) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Hue and lightness move from the brand's deep red toward a lighter rose.
    ctx.strokeStyle = `hsla(${350 - k * 20}, ${45 + k * 20}%, ${18 + k * 45}%, 0.9)`;
    ctx.lineWidth = 2 + k * 3;
    ctx.stroke();
  }
}

/** Draws an image into the canvas, cropped to cover it, as CSS `object-fit: cover` does. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export function ScrollSequence({ heading, description, frameUrls }: ScrollSequenceProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  const frameCount = frameUrls?.length ?? DEMO_FRAME_COUNT;
  const hasImages = frameUrls !== undefined && frameUrls.length > 0;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    const progressBar = progressBarRef.current;
    if (!canvas || !section || !progressBar) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let currentIndex = -1;
    let frameRequest = 0;

    // Draws the frame for an index, using the canvas's current pixel size.
    const drawFrame = (index: number) => {
      context.clearRect(0, 0, width, height);
      if (hasImages) {
        const image = imagesRef.current[index];
        if (image?.complete && image.naturalWidth > 0)
          drawImageCover(context, image, width, height);
      } else {
        drawDemoFrame(context, width, height, index / (DEMO_FRAME_COUNT - 1));
      }
    };

    // Sizes the canvas to its CSS box at device pixel ratio, then redraws the current frame.
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      currentIndex = -1;
      update();
    };

    // Reads scroll position, then draws the matching frame only when the index changes.
    const update = () => {
      frameRequest = 0;
      const rect = section.getBoundingClientRect();
      const progress = getScrollProgress(rect.top, section.offsetHeight, window.innerHeight);
      progressBar.style.transform = `scaleX(${progress})`;

      const index = getFrameIndex(progress, frameCount);
      if (index === currentIndex) return;
      currentIndex = index;
      drawFrame(index);
    };

    // Coalesces scroll events into one update per animation frame.
    const requestUpdate = () => {
      if (!frameRequest) frameRequest = requestAnimationFrame(update);
    };

    if (frameUrls && frameUrls.length > 0) {
      // Load every frame up front; a frame that finishes loading redraws if it is current.
      imagesRef.current = frameUrls.map((url) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          if (currentIndex >= 0) drawFrame(currentIndex);
        };
        image.src = url;
        return image;
      });
    }

    resize();
    window.addEventListener("resize", resize);

    // Reduced motion keeps the first frame and skips the scroll binding.
    if (!reducedMotion) window.addEventListener("scroll", requestUpdate, { passive: true });

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", resize);
      if (frameRequest) cancelAnimationFrame(frameRequest);
    };
  }, [frameCount, frameUrls, hasImages, reducedMotion]);

  return (
    <section
      ref={sectionRef}
      className="bg-surface relative w-full"
      style={reducedMotion ? undefined : { height: `${TRACK_VH}vh` }}
      aria-labelledby="scroll-sequence-heading"
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={description}
        />
        {hasImages ? (
          <div className="overlay-dark pointer-events-none absolute inset-0" aria-hidden="true" />
        ) : null}
        <div
          className={`max-w-page px-margin relative z-10 mx-auto flex h-full flex-col justify-end pb-12 ${hasImages ? "text-interactive-text" : "text-on-surface"}`}
        >
          <h2 id="scroll-sequence-heading" className="type-heading-xl max-w-2xl wrap-anywhere">
            {heading}
          </h2>
          <p className="type-body-lg mt-3 max-w-prose opacity-90">{description}</p>
          <div className="bg-border mt-8 h-px w-full overflow-hidden" aria-hidden="true">
            <div
              ref={progressBarRef}
              className="bg-interactive h-px w-full origin-left"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
