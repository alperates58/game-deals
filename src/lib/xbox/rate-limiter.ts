export interface RateLimiterOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  maxConcurrency?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
}

export class SafeRateLimiter {
  private minDelayMs: number;
  private maxDelayMs: number;
  private maxConcurrency: number;
  private maxRetries: number;
  private baseBackoffMs: number;
  private activeCount = 0;
  private queue: Array<() => void> = [];
  private lastRequestTime = 0;

  constructor(options: RateLimiterOptions = {}) {
    this.minDelayMs = options.minDelayMs ?? 750;
    this.maxDelayMs = options.maxDelayMs ?? 1500;
    this.maxConcurrency = options.maxConcurrency ?? 2;
    this.maxRetries = options.maxRetries ?? 4;
    this.baseBackoffMs = options.baseBackoffMs ?? 1000;
  }

  private getRandomDelay(): number {
    return Math.floor(
      Math.random() * (this.maxDelayMs - this.minDelayMs + 1) + this.minDelayMs
    );
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.activeCount++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeCount--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  private async enforceInterRequestDelay(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const requiredDelay = this.getRandomDelay();

    if (elapsed < requiredDelay) {
      await new Promise((res) => setTimeout(res, requiredDelay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  public async executeWithRetry<T>(
    operation: () => Promise<Response>,
    transform: (res: Response) => Promise<T>
  ): Promise<T> {
    await this.acquireSlot();

    try {
      let attempt = 0;
      while (attempt <= this.maxRetries) {
        attempt++;
        await this.enforceInterRequestDelay();

        try {
          const response = await operation();

          // Handle 429 Too Many Requests
          if (response.status === 429) {
            const retryAfterHeader = response.headers.get("retry-after");
            const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5;
            const waitMs = isNaN(retryAfterSec) ? 5000 : retryAfterSec * 1000;
            console.warn(`[RateLimiter] HTTP 429 encountered. Waiting ${waitMs}ms before retry...`);
            await new Promise((res) => setTimeout(res, waitMs));
            continue;
          }

          // Handle 5xx Server Errors
          if (response.status >= 500 && response.status < 600) {
            if (attempt > this.maxRetries) {
              throw new Error(`Upstream server error HTTP ${response.status} after ${this.maxRetries} retries.`);
            }
            const jitter = Math.random() * 500;
            const backoffMs = this.baseBackoffMs * Math.pow(2, attempt) + jitter;
            console.warn(`[RateLimiter] HTTP ${response.status}. Retrying in ${Math.round(backoffMs)}ms (attempt ${attempt}/${this.maxRetries})...`);
            await new Promise((res) => setTimeout(res, backoffMs));
            continue;
          }

          if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
          }

          return await transform(response);
        } catch (error: any) {
          if (attempt > this.maxRetries) {
            throw error;
          }
          const jitter = Math.random() * 500;
          const backoffMs = this.baseBackoffMs * Math.pow(2, attempt) + jitter;
          console.warn(`[RateLimiter] Network error: ${error.message}. Retrying in ${Math.round(backoffMs)}ms...`);
          await new Promise((res) => setTimeout(res, backoffMs));
        }
      }

      throw new Error(`Max retries (${this.maxRetries}) exceeded.`);
    } finally {
      this.releaseSlot();
    }
  }
}
