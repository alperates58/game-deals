import { SafeRateLimiter } from "./rate-limiter";

export class XboxDiscoveryClient {
  private rateLimiter: SafeRateLimiter;

  constructor() {
    this.rateLimiter = new SafeRateLimiter({
      minDelayMs: 500,
      maxDelayMs: 1200,
      maxConcurrency: 2,
    });
  }

  public async searchStoreForProductIds(query: string): Promise<string[]> {
    const url = `https://www.microsoft.com/tr-tr/store/search/games?q=${encodeURIComponent(query)}`;

    return this.rateLimiter.executeWithRetry(
      async () => {
        return await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "text/html",
          },
        });
      },
      async (res) => {
        const text = await res.text();
        const matches = [...text.matchAll(/\/p\/[^\/]+\/([a-zA-Z0-9]{12})/g)];
        const ids = [...new Set(matches.map((m) => m[1].toUpperCase()))];
        // Ensure strictly 12 alphanumeric characters
        return ids.filter((id) => /^[A-Z0-9]{12}$/.test(id));
      }
    );
  }
}
