import { describe, it, expect } from "vitest";
import { getOptimizedImageUrl } from "../../src/lib/xbox/image-utils";

describe("Image Optimization Utilities (Edge CDN Transformations)", () => {
  const sampleStoreUrl =
    "https://store-images.s-microsoft.com/image/apps.23248.13733243493197803.a3412f95-9af3-40d3-b286-9282abd1d7a8.c6ebb25e-9167-4ffc-a84a-b95bfc7b820c";
  const sampleProtocolRelativeUrl =
    "//store-images.s-microsoft.com/image/apps.23248.13733243493197803.poster.jpg";

  it("should return empty string for null, undefined, or empty string", () => {
    expect(getOptimizedImageUrl(null)).toBe("");
    expect(getOptimizedImageUrl(undefined)).toBe("");
    expect(getOptimizedImageUrl("")).toBe("");
    expect(getOptimizedImageUrl("   ")).toBe("");
  });

  it("should not alter non-Microsoft URLs", () => {
    const external = "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg";
    expect(getOptimizedImageUrl(external)).toBe(external);
  });

  it("should normalize protocol-relative URLs", () => {
    const result = getOptimizedImageUrl(sampleProtocolRelativeUrl, "thumb");
    expect(result.startsWith("https://store-images.s-microsoft.com/")).toBe(true);
  });

  it("should apply card variant transformation by default", () => {
    const result = getOptimizedImageUrl(sampleStoreUrl);
    const parsed = new URL(result);
    expect(parsed.searchParams.get("w")).toBe("360");
    expect(parsed.searchParams.get("q")).toBe("80");
    expect(parsed.searchParams.get("format")).toBe("jpg");
    expect(parsed.searchParams.get("mode")).toBe("scale");
  });

  it("should apply thumb variant parameters for mini thumbnails", () => {
    const result = getOptimizedImageUrl(sampleStoreUrl, "thumb");
    const parsed = new URL(result);
    expect(parsed.searchParams.get("w")).toBe("140");
    expect(parsed.searchParams.get("q")).toBe("75");
    expect(parsed.searchParams.get("format")).toBe("jpg");
  });

  it("should apply detail variant parameters for game cover page", () => {
    const result = getOptimizedImageUrl(sampleStoreUrl, "detail");
    const parsed = new URL(result);
    expect(parsed.searchParams.get("w")).toBe("640");
    expect(parsed.searchParams.get("q")).toBe("85");
  });

  it("should apply backdrop variant parameters for featured slider", () => {
    const result = getOptimizedImageUrl(sampleStoreUrl, "backdrop");
    const parsed = new URL(result);
    expect(parsed.searchParams.get("w")).toBe("1280");
    expect(parsed.searchParams.get("q")).toBe("75");
  });

  it("should apply screenshot variant parameters for gallery", () => {
    const result = getOptimizedImageUrl(sampleStoreUrl, "screenshot");
    const parsed = new URL(result);
    expect(parsed.searchParams.get("w")).toBe("720");
    expect(parsed.searchParams.get("q")).toBe("80");
  });

  it("should support custom optimization options", () => {
    const result = getOptimizedImageUrl(sampleStoreUrl, {
      width: 500,
      quality: 90,
      format: "png",
      mode: "crop",
    });
    const parsed = new URL(result);
    expect(parsed.searchParams.get("w")).toBe("500");
    expect(parsed.searchParams.get("q")).toBe("90");
    expect(parsed.searchParams.get("format")).toBe("png");
    expect(parsed.searchParams.get("mode")).toBe("crop");
  });

  it("should safely update existing query parameters without duplication", () => {
    const urlWithParams = `${sampleStoreUrl}?w=100&q=50&mode=scale`;
    const result = getOptimizedImageUrl(urlWithParams, "card");
    const parsed = new URL(result);
    expect(parsed.searchParams.get("w")).toBe("360");
    expect(parsed.searchParams.get("q")).toBe("80");
    expect(parsed.searchParams.getAll("w").length).toBe(1);
  });
});
