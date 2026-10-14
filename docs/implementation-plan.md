# FAZ 1 UYGULAMA PLANI (IMPLEMENTATION PLAN)

**Proje:** Xbox Gerçek Fırsat Takip Sistemi (`game.alperates.com.tr`)  
**Durum:** READY FOR EXECUTION  

---

## 1. Uygulama Aşamaları

### Aşama 1: Proje İskeleti ve Bağımlılıklar (Scaffolding)
- Next.js 15+ App Router, React 19, TypeScript strict mode yapılandırması
- Tailwind CSS ve modern font/tema yapılandırması
- Prisma ORM ve PostgreSQL şema dosyası (`prisma/schema.prisma`)
- Vitest veya Node test runner birim test kurulumu
- ESLint & Prettier & TypeScript strict derleme ayarları

### Aşama 2: Çekirdek Alan Modelleri ve Xbox Adaptörü
- `src/lib/xbox/schemas.ts`: Zod ile Display Catalog DTO doğrulaması
- `src/lib/xbox/types.ts`: Domain ve adapter veri modelleri
- `src/lib/xbox/rate-limiter.ts`: Concurrency 2, batch 25, delay 750-1500ms, retry/backoff
- `src/lib/xbox/catalog-client.ts`: Display Catalog batch HTTP istemcisi
- `src/lib/xbox/discovery-client.ts`: Mağaza arama ve franchise keşif istemcisi
- `src/lib/xbox/mapper.ts`: Ham JSON -> NormalizedXboxProduct dönüştürücüsü

### Aşama 3: Fiyatlandırma, Geçmiş ve Fırsat Analiz Motoru
- `src/lib/pricing/deal-score.ts`: %55 dip fiyat, %20 indirim, %15 nadirlik, %10 momentum formülü
- `src/lib/pricing/confidence.ts`: 0-14 gün (LOW), 15-59 (MEDIUM), 60-179 (HIGH), 180+ (VERY_HIGH)
- `src/lib/pricing/observed-low.ts`: Takip süresince gözlemlenen dip fiyat hesaplama
- `src/lib/pricing/price-sync.ts`: Fiyat değişim tespiti, idempotent PriceHistory kaydı
- `src/lib/db/advisory-lock.ts`: PostgreSQL `pg_try_advisory_lock` entegrasyonu

### Aşama 4: CORE Franchise Tohumlama ve Senkronizasyon Komutları
- `src/data/core-franchises.ts`: 32 CORE franchise ve popüler oyun BigID listesi
- `src/scripts/sync-core.ts`: CORE oyunları DB'ye tohumlama ve Display Catalog ile doldurma
- `src/scripts/sync-prices.ts`: Periyodik fiyat senkronizasyon CLI işi
- `src/scripts/discover.ts`: Yeni oyun keşif CLI işi

### Aşama 5: Kullanıcı Arayüzü (Web UI - Truthful & Accessible)
- `src/components/layout/header.tsx` & `footer.tsx`
- `src/components/game/game-card.tsx`: Fiyat hiyerarşisi, indirim rozeti, fırsat kararı
- `src/components/game/price-history-chart.tsx`: Recharts ile fiyat geçmişi zaman serisi grafiği
- `src/components/game/deal-badge.tsx`: Karar (`🔥 Kaçırma`, `🟢 Çok İyi` vb.) ve Güven rozetleri
- `src/app/page.tsx`: Ana sayfa (Özet sayaçlar, Öne çıkan fırsatlar, Tarihi diptekiler, Popüler seriler)
- `src/app/firsatlar/page.tsx`: Tüm fırsatlar, filtreleme ve sıralama
- `src/app/tarihi-dip/page.tsx`: Tarihi dip seviyesindeki fırsatlar
- `src/app/oyun/[slug]/page.tsx`: Oyun detay sayfası, geçmiş tablosu ve grafiği
- `src/app/api/health/route.ts`: Sistem sağlık kontrolü

### Aşama 6: Docker ve Ortam Yapılandırması
- `Dockerfile`: Multi-stage non-root container üretimi
- `docker-compose.yml`: Web + PostgreSQL ortamı
- `.env.example` ve çevre değişkenleri doğrulayıcısı

### Aşama 7: Otomatik Testler, Doğrulama ve Kabul Raporu
- Tüm birim testlerinin çalıştırılması (`npm run test`)
- Kod stili ve tip doğrulaması (`npm run lint`, `npm run typecheck`)
- Production build doğrulaması (`npm run build`)
- Faz 0 + Faz 1 Kabul Raporunun eksiksiz üretilmesi
