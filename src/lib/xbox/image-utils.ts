/**
 * Utility functions for optimizing Microsoft Store CDN images.
 * Microsoft Store CDN (store-images.s-microsoft.com) supports dynamic transformation
 * parameters such as ?w={width}&format=jpg&mode=scale&q={quality}.
 * 
 * Using edge optimization reduces image payloads from 500-600 KB down to 8-30 KB
 * without requiring VPS disk storage or proxy server CPU load.
 */

export type ImageVariant = "thumb" | "card" | "detail" | "backdrop" | "screenshot";

export interface ImageOptimizationOptions {
  width?: number;
  quality?: number;
  format?: "jpg" | "png";
  mode?: "scale" | "crop";
}

const VARIANT_PRESETS: Record<ImageVariant, ImageOptimizationOptions> = {
  // Mini thumbnails for search dropdown, DLC lists, and compact lists (12-48px rendered)
  thumb: { width: 140, quality: 75, format: "jpg", mode: "scale" },

  // Grid cards, slider posters, favorites & library (130-220px rendered, crisp 2x retina)
  card: { width: 360, quality: 80, format: "jpg", mode: "scale" },

  // Main hero game cover on detail page (280-320px rendered, 2x retina)
  detail: { width: 640, quality: 85, format: "jpg", mode: "scale" },

  // Detail page screenshot gallery (16:9 300-450px rendered)
  screenshot: { width: 720, quality: 80, format: "jpg", mode: "scale" },

  // Full-width background hero backdrops / blurred ambient layers
  backdrop: { width: 1280, quality: 75, format: "jpg", mode: "scale" },
};

/**
 * Returns an edge-optimized image URL with appropriate width, format, and compression.
 * Non-Microsoft URLs or invalid URLs are returned safely without alteration.
 */
export function getOptimizedImageUrl(
  rawUrl?: string | null,
  variantOrOptions: ImageVariant | ImageOptimizationOptions = "card"
): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  let url = rawUrl.trim();
  if (!url) return "";

  // Protocol normalization (//store-images... -> https://store-images...)
  if (url.startsWith("//")) {
    url = `https:${url}`;
  }

  // Only apply dynamic transformation params to Microsoft CDNs
  const isMicrosoftCdn =
    url.includes("store-images.s-microsoft.com") ||
    url.includes("xboxlive.com") ||
    url.includes("assets.xboxservices.com");

  if (!isMicrosoftCdn) {
    return url;
  }

  const options: ImageOptimizationOptions =
    typeof variantOrOptions === "string"
      ? VARIANT_PRESETS[variantOrOptions] || VARIANT_PRESETS.card
      : variantOrOptions;

  try {
    const parsed = new URL(url);

    // Apply or override query parameters
    if (options.width) parsed.searchParams.set("w", String(options.width));
    if (options.quality) parsed.searchParams.set("q", String(options.quality));
    if (options.format) parsed.searchParams.set("format", options.format);
    if (options.mode) parsed.searchParams.set("mode", options.mode);

    return parsed.toString();
  } catch {
    // If URL parsing fails, fallback safely
    return url;
  }
}
