export interface SyncLogEntry {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

export interface SyncProgressState {
  isRunning: boolean;
  action: "CATALOG_DISCOVERY" | "PRICE_SYNC" | "FULL_CATALOG_CRAWL" | null;
  isFullCrawl?: boolean;
  isCancelRequested?: boolean;
  startedAt: string | null;
  progressPercent: number; // 0 to 100
  currentPhase: string;
  pagesScanned: number;
  maxPages: number;
  totalCatalogItems: number;
  rawDiscovered: number;
  productsAdded: number;
  productsUpdated: number;
  relationsCreated: number;
  logs: SyncLogEntry[];
  errorSummary: string | null;
  completedAt: string | null;
}

class SyncProgressTracker {
  private cancelRequested = false;
  private state: SyncProgressState = {
    isRunning: false,
    action: null,
    isFullCrawl: false,
    isCancelRequested: false,
    startedAt: null,
    progressPercent: 0,
    currentPhase: "Hazır",
    pagesScanned: 0,
    maxPages: 40,
    totalCatalogItems: 0,
    rawDiscovered: 0,
    productsAdded: 0,
    productsUpdated: 0,
    relationsCreated: 0,
    logs: [],
    errorSummary: null,
    completedAt: null,
  };

  private getTimestamp(): string {
    const d = new Date();
    return d.toTimeString().split(" ")[0]; // "11:28:45"
  }

  public requestCancel() {
    this.cancelRequested = true;
    this.state.isCancelRequested = true;
    this.addLog("Durdurma talebi iletildi. Mevcut sayfa işlendikten sonra tarama güvenle durdurulacak...", "warn");
  }

  public isCancelled(): boolean {
    return this.cancelRequested;
  }

  public startSync(
    action: "CATALOG_DISCOVERY" | "PRICE_SYNC" | "FULL_CATALOG_CRAWL",
    maxPages: number = 40,
    estimatedTotal: number = 1000,
    isFullCrawl: boolean = false
  ) {
    this.cancelRequested = false;
    this.state = {
      isRunning: true,
      action,
      isFullCrawl,
      isCancelRequested: false,
      startedAt: new Date().toISOString(),
      progressPercent: 2,
      currentPhase:
        isFullCrawl || action === "FULL_CATALOG_CRAWL"
          ? "Tüm Xbox Series X|S kataloğunu taramak için mağaza yayınına bağlanılıyor..."
          : action === "CATALOG_DISCOVERY"
          ? "Microsoft Store Series X|S kanalına bağlanılıyor..."
          : "Fiyat güncelleme kuyruğu hazırlanıyor...",
      pagesScanned: 0,
      maxPages,
      totalCatalogItems: estimatedTotal,
      rawDiscovered: 0,
      productsAdded: 0,
      productsUpdated: 0,
      relationsCreated: 0,
      logs: [
        {
          timestamp: this.getTimestamp(),
          message:
            isFullCrawl || action === "FULL_CATALOG_CRAWL"
              ? "🚀 Tam Mağaza Taraması başlatıldı. Tüm Series X|S kataloğu bitene kadar otomatik çekilecek."
              : action === "CATALOG_DISCOVERY"
              ? `Katalog taraması başlatıldı (Hedef: ${maxPages} sayfa, ~${maxPages * 25} ürün).`
              : "Fiyat güncellemesi başlatıldı.",
          type: "info",
        },
      ],
      errorSummary: null,
      completedAt: null,
    };
  }

  public updatePageProgress(params: {
    page: number;
    maxPages: number;
    rawCount: number;
    totalCatalogItems?: number;
    addedCount: number;
    updatedCount: number;
    relationsCount?: number;
  }) {
    if (!this.state.isRunning) return;

    this.state.pagesScanned = params.page;
    this.state.maxPages = params.maxPages;
    if (params.totalCatalogItems) {
      this.state.totalCatalogItems = params.totalCatalogItems;
    }
    this.state.rawDiscovered += params.rawCount;
    this.state.productsAdded = params.addedCount;
    this.state.productsUpdated = params.updatedCount;
    if (typeof params.relationsCount === "number") {
      this.state.relationsCreated = params.relationsCount;
    }

    // Calculate realistic progress percentage (up to 95% during scan, 100% on finish)
    const ratio = Math.min(params.page / Math.max(1, params.maxPages), 0.95);
    this.state.progressPercent = Math.max(
      this.state.progressPercent,
      Math.round(ratio * 90) + 5
    );

    this.state.currentPhase = `Sayfa ${params.page}/${params.maxPages} işleniyor (${this.state.productsAdded} yeni oyun eklendi, ${this.state.productsUpdated} güncellendi)`;

    this.addLog(
      `Sayfa ${params.page}/${params.maxPages}: ${params.rawCount} ürün incelendi (Toplam yeni: ${this.state.productsAdded}, güncellenen: ${this.state.productsUpdated})`,
      "info"
    );
  }

  public addLog(message: string, type: "info" | "success" | "warn" | "error" = "info") {
    this.state.logs.push({
      timestamp: this.getTimestamp(),
      message,
      type,
    });
    // Keep last 100 logs to prevent memory bloat
    if (this.state.logs.length > 100) {
      this.state.logs = this.state.logs.slice(-100);
    }
  }

  public finishSync(summaryMessage: string, stats?: any) {
    this.state.isRunning = false;
    this.state.progressPercent = 100;
    this.state.currentPhase = "Tamamlandı";
    this.state.completedAt = new Date().toISOString();
    if (stats) {
      this.state.productsAdded = stats.productsAdded ?? this.state.productsAdded;
      this.state.productsUpdated = stats.productsUpdated ?? this.state.productsUpdated;
      this.state.relationsCreated = stats.relationsCreated ?? this.state.relationsCreated;
    }
    this.addLog(summaryMessage, "success");
  }

  public failSync(errorMessage: string) {
    this.state.isRunning = false;
    this.state.errorSummary = errorMessage;
    this.state.currentPhase = `Hata: ${errorMessage}`;
    this.addLog(`İşlem durduruldu: ${errorMessage}`, "error");
  }

  public getProgress(): SyncProgressState {
    return { ...this.state, logs: [...this.state.logs] };
  }

  public reset() {
    this.cancelRequested = false;
    this.state = {
      isRunning: false,
      action: null,
      isFullCrawl: false,
      isCancelRequested: false,
      startedAt: null,
      progressPercent: 0,
      currentPhase: "Hazır",
      pagesScanned: 0,
      maxPages: 40,
      totalCatalogItems: 0,
      rawDiscovered: 0,
      productsAdded: 0,
      productsUpdated: 0,
      relationsCreated: 0,
      logs: [],
      errorSummary: null,
      completedAt: null,
    };
  }
}

// Global singleton to survive HMR and concurrent API requests
const globalWithTracker = globalThis as unknown as {
  __syncProgressTracker?: SyncProgressTracker;
};

export const syncProgressTracker =
  globalWithTracker.__syncProgressTracker || new SyncProgressTracker();

if (process.env.NODE_ENV !== "production") {
  globalWithTracker.__syncProgressTracker = syncProgressTracker;
} else {
  globalWithTracker.__syncProgressTracker = syncProgressTracker;
}
