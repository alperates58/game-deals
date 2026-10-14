# GEREKSİNİM İZLENEBİLİRLİK MATRİSİ (REQUIREMENTS TRACEABILITY MATRIX - RTM)

**Proje:** Xbox Gerçek Fırsat Takip Sistemi (`game.alperates.com.tr`)  
**Kapsam:** Faz 0 & Faz 1  
**İzlenebilirlik Oranı:** %100  

---

| Req ID | Açıklama | Mimari Bileşen | Veri Modeli | API / Job | UI Yüzeyi | Test Kapsamı | Kanıt Dosyası | Durum |
|---|---|---|---|---|---|---|---|---|
| **FR-01** | ~300-600 Popüler Xbox & 32 CORE Franchise Takibi | `src/lib/xbox/catalog-client.ts`, `seed` | `Game` (`isCore`, `franchise`) | `npm run xbox:sync-core`, `npm run xbox:discover` | Ana Sayfa, Fırsatlar | Seed & Discovery test | `docs/evidence/faz0/batch-test-result.json` | PENDING_IMPL |
| **FR-02** | Ücretsiz Oyun ve Eklenti/DLC Filtreleme | `src/lib/xbox/mapper.ts` | `Game` (`isFree`, `productType`) | `xbox:sync-prices` | Filtreleme mantığı | Free-filter unit test | `tests/unit/mapper.test.ts` | PENDING_IMPL |
| **FR-03** | Microsoft Display Catalog TR Fiyat Çekme | `src/lib/xbox/catalog-client.ts` | `Game` (`currentPrice`, `listPrice`, `currency`) | `xbox:sync-prices` | Kart ve Detay Fiyatları | Display Catalog API test | `docs/evidence/faz0/price-field-verification.json` | VERIFIED_FAZ0 |
| **FR-04** | Yalnızca Değişen Fiyatlarda Geçmiş Kaydı (İdempotensi) | `src/lib/pricing/price-sync.ts` | `PriceHistory` | `xbox:sync-prices` | Fiyat Geçmiş Tablosu | Duplicate-history test | `tests/unit/price-sync.test.ts` | PENDING_IMPL |
| **FR-05** | Gözlemlenen Dip Fiyat Tespiti (`historicalLow`) | `src/lib/pricing/observed-low.ts` | `Game` (`historicalLow`, `historicalLowAt`) | `xbox:sync-prices` | Dip Fiyat Rozeti, `/tarihi-dip` | Observed-low unit test | `tests/unit/observed-low.test.ts` | PENDING_IMPL |
| **FR-06** | Fırsat Puanı Hesaplama (Deal Score V1) | `src/lib/pricing/deal-score.ts` | `DealAnalysis` (`dealScore`, `verdict`, `reason`) | `calculateDealScore()` | Fırsat Rozetleri, Skor Barı | Deal-score unit test | `tests/unit/deal-score.test.ts` | PENDING_IMPL |
| **FR-07** | Veri Güven Düzeyi (`confidenceScore`) | `src/lib/pricing/confidence.ts` | `DealAnalysis` (`confidenceScore`) | `calculateConfidence()` | Güven Rozeti (Düşük/Orta/Yüksek) | Confidence unit test | `tests/unit/confidence.test.ts` | PENDING_IMPL |
| **FR-08** | Ana Sayfa Fırsat Akışı | `src/app/page.tsx` | `Game`, `DealAnalysis` | Server Component `getHomePageData` | `/` | Responsive & Truthful UI Test | QA Evidence | PENDING_IMPL |
| **FR-09** | Fırsatlar Listesi Sayfası | `src/app/firsatlar/page.tsx` | `Game`, `DealAnalysis` | Server Component `getDealsData` | `/firsatlar` | Filter & Sort Test | QA Evidence | PENDING_IMPL |
| **FR-10** | Tarihi Dip Listesi Sayfası | `src/app/tarihi-dip/page.tsx` | `Game`, `DealAnalysis` | Server Component `getHistoricalLows` | `/tarihi-dip` | Lows Filter Test | QA Evidence | PENDING_IMPL |
| **FR-11** | Oyun Detay & Fiyat Grafiği Sayfası | `src/app/oyun/[slug]/page.tsx` | `Game`, `PriceHistory`, `DealAnalysis` | Server Component `getGameDetail` | `/oyun/[slug]` | Chart & History Test | QA Evidence | PENDING_IMPL |
| **FR-12** | Senkronizasyon CLI Komutları | `src/scripts/sync-prices.ts` | `SyncRun` | CLI scripts | Terminal / stdout | Advisory lock & run test | `tests/unit/sync-lock.test.ts` | PENDING_IMPL |
| **NFR-REL-01** | Hız Sınırı & Gecikme Politikası | `src/lib/xbox/rate-limiter.ts` | Yok | Tüm HTTP istekleri | Yok | Rate limiter delay test | `tests/unit/rate-limiter.test.ts` | PENDING_IMPL |
| **NFR-REL-02** | 429 Retry-After & 5xx Exponential Backoff | `src/lib/xbox/catalog-client.ts` | Yok | Catalog Client | Yok | Backoff & Retry test | `tests/unit/catalog-client.test.ts` | PENDING_IMPL |
| **NFR-REL-03** | Dış Kaynak Çökmesinde Veri Koruma | `src/lib/pricing/price-sync.ts` | `Game`, `SyncRun` | Worker exception handling | UI Stale Data Uyarısı | Fault tolerance test | `tests/unit/fault-tolerance.test.ts` | PENDING_IMPL |
| **NFR-REL-04** | PostgreSQL Advisory Lock | `src/lib/db/advisory-lock.ts` | PostgreSQL system function | Sync Runner | Log uyarısı | Concurrency unit test | `tests/unit/sync-lock.test.ts` | PENDING_IMPL |
| **NFR-SEC-01** | Zod Şema Doğrulaması | `src/lib/xbox/schemas.ts` | DTO tipleri | Ingestion katmanı | Yok | Schema validation test | `tests/unit/schemas.test.ts` | PENDING_IMPL |
| **NFR-SEC-02** | XSS Önleme & Sanitize Render | `src/components/ui/*` | Yok | React JSX | Tüm UI sayfaları | Static code scan | QA Evidence | PENDING_IMPL |
| **NFR-SEC-03** | Gizli Veri İzolasyonu | `src/lib/env.ts` | Yok | Server-only env | Yok | Env leak test | Security scan | PENDING_IMPL |
| **NFR-OPS-01** | `/api/health` Sağlık Kontrolü | `src/app/api/health/route.ts` | `prisma.$queryRaw` | GET `/api/health` | Status indicator | Route endpoint test | Health check response | PENDING_IMPL |
| **NFR-OPS-02** | Yapılandırılmış Senkronizasyon Günlüğü | `src/lib/observability/logger.ts` | `SyncRun` | CLI Worker | JSON log çıktısı | SyncRun DB inspection | DB evidence | PENDING_IMPL |
| **NFR-OPS-03** | Docker & Docker Compose | `Dockerfile`, `docker-compose.yml` | PostgreSQL container | Docker engine | Web container | Docker build test | Docker evidence | PENDING_IMPL |
| **NFR-UX-01** | Eksiksiz Türkçe & Dürüst UI | Metin kaynakları, UI bileşenleri | Yok | Sayfa renderları | Tüm sayfalar | i18n & Truthful UI audit | UX review | PENDING_IMPL |
| **NFR-UX-02** | Duyarlı Tasarım (Desktop & Mobile) | Tailwind Grid/Flex | Yok | Sayfa renderları | Desktop / Mobile | Viewport testleri | Screenshot evidence | PENDING_IMPL |
| **NFR-UX-03** | Erişilebilirlik (WCAG 2.2 AA Uyumlu) | Semantik HTML & ARIA | Yok | Sayfa renderları | Tüm sayfalar | Contrast & A11y audit | A11y evidence | PENDING_IMPL |
