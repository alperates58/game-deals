import { SafeRateLimiter } from "./rate-limiter";

export interface DiscoveredProductSummary {
  productId: string;
  title: string;
  productFamily?: string;
  productKind?: string;
  availableOn: string[];
  isFree: boolean;
  currentPrice: number;
  listPrice: number;
  currency: string;
  discountPercentage: number;
  releaseDate?: string;
  developerName?: string;
  publisherName?: string;
  categories: string[];
  hasAddOns?: boolean;
}

export interface DiscoveryPageResult {
  products: DiscoveredProductSummary[];
  rawCount: number;
  totalCatalogItems: number;
  nextContinuationToken: string | null;
  hasMore: boolean;
  channelKey: string;
}

export interface DiscoveryProviderTelemetry {
  pagesFetched: number;
  totalRawProducts: number;
  requestsCount: number;
  http429Count: number;
  http5xxCount: number;
}

export class SeriesDiscoveryProvider {
  private rateLimiter: SafeRateLimiter;
  private telemetry: DiscoveryProviderTelemetry;

  constructor() {
    this.rateLimiter = new SafeRateLimiter({
      minDelayMs: 600,
      maxDelayMs: 1200,
      maxConcurrency: 2,
      maxRetries: 4,
    });
    this.telemetry = {
      pagesFetched: 0,
      totalRawProducts: 0,
      requestsCount: 0,
      http429Count: 0,
      http5xxCount: 0,
    };
  }

  public getTelemetry(): DiscoveryProviderTelemetry {
    return { ...this.telemetry };
  }

  /**
   * Fetches the initial page HTML from xbox.com/tr-TR/games/browse?PlayWith=XboxSeriesX|S
   * to extract the authoritative channelKey, initial products, and continuationToken.
   */
  public async fetchInitialPage(): Promise<DiscoveryPageResult> {
    const url = "https://www.xbox.com/tr-TR/games/browse?PlayWith=XboxSeriesX%7CS";
    this.telemetry.requestsCount++;

    const response = await this.rateLimiter.executeWithRetry(
      async () => {
        return await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
      },
      async (res) => {
        if (res.status === 429) {
          this.telemetry.http429Count++;
          throw new Error("HTTP_429");
        }
        if (res.status >= 500) {
          this.telemetry.http5xxCount++;
          throw new Error(`HTTP_${res.status}`);
        }
        return await res.text();
      }
    );

    const matchIdx = response.indexOf("window.__PRELOADED_STATE__ = {");
    if (matchIdx === -1) {
      throw new Error("Could not find window.__PRELOADED_STATE__ in Xbox Store HTML.");
    }

    const start = response.indexOf("{", matchIdx);
    const end = response.indexOf(";\n            window.env", start);
    if (end === -1) {
      throw new Error("Could not extract clean JSON from preloaded state script.");
    }

    const stateJson = JSON.parse(response.substring(start, end));
    const channelData = stateJson.core2?.channels?.channelData || {};
    const channelKey = Object.keys(channelData)[0] || "BROWSE_CHANNELID=_FILTERS=PLAYWITH=XBOXSERIESX|S";
    const channelItem = channelData[channelKey]?.data;

    const rawProducts = channelItem?.products || [];
    const totalItems = channelItem?.totalItems || 16063;
    const continuationToken = channelItem?.encodedCT || null;

    this.telemetry.pagesFetched++;
    this.telemetry.totalRawProducts += rawProducts.length;

    // Convert raw products to summaries (preloaded state might not have full summaries, so map basic info)
    const summaries: DiscoveredProductSummary[] = rawProducts.map((p: any) => ({
      productId: p.productId,
      title: p.title || p.productId,
      availableOn: ["XboxSeriesX"], // Pre-qualified by Series X|S filter channel
      isFree: false,
      currentPrice: 0,
      listPrice: 0,
      currency: "TRY",
      discountPercentage: 0,
      categories: [],
    }));

    return {
      products: summaries,
      rawCount: rawProducts.length,
      totalCatalogItems: totalItems,
      nextContinuationToken: continuationToken,
      hasMore: Boolean(continuationToken),
      channelKey,
    };
  }

  /**
   * Fetches consecutive pages of products via emerald.xboxservices.com using continuation token.
   */
  public async fetchNextPage(
    continuationToken: string,
    channelKey: string = "BROWSE_CHANNELID=_FILTERS=PLAYWITH=XBOXSERIESX|S"
  ): Promise<DiscoveryPageResult> {
    const url = "https://emerald.xboxservices.com/xboxcomfd/browse?locale=tr-TR";
    const cvIndex = this.telemetry.pagesFetched + 1;
    this.telemetry.requestsCount++;

    const payload = {
      Filters: "",
      ReturnFilters: false,
      ChannelKeyToBeUsedInResponse: channelKey,
      EncodedCT: continuationToken,
      ChannelId: "",
    };

    const data = await this.rateLimiter.executeWithRetry(
      async () => {
        return await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ms-api-version": "1.1",
            "ms-cv": `a1b2c3d4e5f6g7h8.${cvIndex}`,
            referer: "https://www.xbox.com/",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
          },
          body: JSON.stringify(payload),
        });
      },
      async (res) => {
        if (res.status === 429) {
          this.telemetry.http429Count++;
          throw new Error("HTTP_429");
        }
        if (res.status >= 500) {
          this.telemetry.http5xxCount++;
          throw new Error(`HTTP_${res.status}`);
        }
        return await res.json();
      }
    );

    const channel = data.channels ? data.channels[channelKey] : null;
    const rawProducts = channel?.products || [];
    const nextToken = channel?.encodedCT || null;
    const totalItems = channel?.totalItems || 0;

    const summaryMap = new Map<string, any>();
    for (const s of data.productSummaries || []) {
      summaryMap.set(s.productId, s);
    }

    const summaries: DiscoveredProductSummary[] = rawProducts.map((p: any) => {
      const s = summaryMap.get(p.productId);
      const purchaseable = s?.specificPrices?.purchaseable?.[0];
      const listPrice = purchaseable?.listPrice ?? 0;
      const msrp = purchaseable?.msrp ?? listPrice;
      const discountPercentage = purchaseable?.discountPercentage ?? 0;
      const isFree = listPrice === 0 && msrp === 0;

      return {
        productId: p.productId,
        title: s?.title || p.productId,
        productFamily: s?.productFamily,
        productKind: s?.productKind,
        availableOn: s?.availableOn || ["XboxSeriesX"],
        isFree,
        currentPrice: listPrice,
        listPrice: msrp || listPrice,
        currency: purchaseable?.currency || "TRY",
        discountPercentage: Math.round(discountPercentage),
        releaseDate: s?.releaseDate,
        developerName: s?.developerName,
        publisherName: s?.publisherName,
        categories: s?.categories || [],
        hasAddOns: s?.hasAddOns,
      };
    });

    this.telemetry.pagesFetched++;
    this.telemetry.totalRawProducts += rawProducts.length;

    return {
      products: summaries,
      rawCount: rawProducts.length,
      totalCatalogItems: totalItems,
      nextContinuationToken: nextToken,
      hasMore: Boolean(nextToken),
      channelKey,
    };
  }

  /**
   * Async generator that streams all pages until catalog exhaustion or limit.
   */
  public async *enumerateAll(options: { maxPages?: number; onProgress?: (pages: number, total: number) => void } = {}) {
    let currentPage = await this.fetchInitialPage();
    let pageNum = 1;

    yield currentPage;
    if (options.onProgress) {
      options.onProgress(pageNum, currentPage.totalCatalogItems);
    }

    while (currentPage.hasMore && currentPage.nextContinuationToken) {
      if (options.maxPages && pageNum >= options.maxPages) {
        break;
      }

      currentPage = await this.fetchNextPage(currentPage.nextContinuationToken, currentPage.channelKey);
      pageNum++;
      yield currentPage;

      if (options.onProgress) {
        options.onProgress(pageNum, currentPage.totalCatalogItems);
      }
    }
  }
}
