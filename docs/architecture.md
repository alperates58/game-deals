# SİSTEM MİMARİSİ (SYSTEM ARCHITECTURE SPECIFICATION)

**Proje:** Xbox Gerçek Fırsat Takip Sistemi (`game.alperates.com.tr`)  
**Mimari Model:** Modüler Monolit (Modular Monolith)  
**Teknoloji Yığını:** Next.js (App Router) + TypeScript Strict + PostgreSQL + Prisma ORM + Tailwind CSS + Recharts + Docker  

---

## 1. Yüksek Düzey Mimari Şema

```text
                       https://game.alperates.com.tr
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │        Next.js Web Application          │
                │        (App Router Server Comp)         │
                └────────────────────┬────────────────────┘
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │          PostgreSQL Database            │
                │     (Games, History, DealAnalysis)      │
                └────────────────────▲────────────────────┘
                                     │
                                     │ (Advisory Lock Protected)
                                     │
                ┌────────────────────┴────────────────────┐
                │     Background Price Sync Worker        │
                │   (CLI: xbox:sync-prices / discover)    │
                └────────────────────▲────────────────────┘
                                     │
                         Adapter Boundary (Zod)
                                     │
                                     ▼
                ┌─────────────────────────────────────────┐
                │     Microsoft Display Catalog API       │
                │        (Public Anonymous TR)            │
                └─────────────────────────────────────────┘
```

---

## 2. Modüler Monolit ve Mantıksal Sınırlar

Uygulama, kod tabanında açıkça izole edilmiş 9 mantıksal modülden oluşur:

1. **`xbox-source` (Dış Kaynak Uyarlayıcısı):**
   - Microsoft Display Catalog ve Store Search HTTP çağrılarını yönetir.
   - Hız sınırlayıcı (`rate-limiter`), yeniden deneme (`retry/backoff`), ve Zod ile DTO doğrulama işlemlerini kapsar.
   - Dış API'nin karmaşık ve kirli JSON modellerini domain modeline sızdırmaz.
2. **`catalog` (Oyun Kataloğu Yönetimi):**
   - CORE franchise tohumlama listesi, oyun kimliği (`xboxProductId`), slug üretimi ve oyun metaverilerini barındırır.
3. **`game-discovery` (Oyun Keşif Modülü):**
   - Mağaza arama ve popülerlik kaynaklarından yeni ücretli oyunları tarar ve kataloğa önerir.
4. **`pricing` (Fiyatlandırma & Normalizasyon):**
   - Display Catalog'dan gelen SKU ve Availability fiyatlarını normalize eder. Para birimi dönüşümü ve hassas ondalık matematik kurallarını işletir.
5. **`price-history` (Zaman Serisi Fiyat Geçmişi):**
   - Yalnızca fiyat değişikliklerini tespit eder.
   - Değişim yoksa idempotent kalarak gereksiz kayıt açmaz.
6. **`deal-analysis` (Fırsat Analiz Motoru):**
   - Deal Score V1 (0-100), Verdict (🔥 Kaçırma, 🟢 Çok İyi vb.), Confidence Score ve Gerekçe metinlerini deterministik olarak üretir.
7. **`sync` (Senkronizasyon Koordinatörü):**
   - PostgreSQL advisory lock korumasıyla toplu senkronizasyon döngüsünü yürütür, `SyncRun` tablosuna loglar.
8. **`web` (Kullanıcı Arayüzü):**
   - Next.js Server Components, erişilebilir UI bileşenleri, duyarlı kartlar ve Recharts fiyat grafiği.
9. **`observability` (Gözlemlenebilirlik):**
   - `/api/health` uç noktası ve yapılandırılmış JSON log mekanizması.

---

## 3. Dış Kaynak Uyarlayıcı Sınırı (Adapter Boundary)

```text
┌─────────────────────────────────┐
│   Microsoft Raw Response JSON   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  Zod Validation & Rate Limiter  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│      XboxSourceAdapter          │
│   (SKU Filter: Purchase & TRY)  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    NormalizedXboxProduct DTO    │
│  - productId: string            │
│  - title: string                │
│  - currentPrice: Decimal        │
│  - listPrice: Decimal           │
│  - currency: "TRY"              │
│  - isOnSale: boolean            │
│  - saleEndAt: Date | null       │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│   PostgreSQL / Domain Layer     │
└─────────────────────────────────┘
```

---

## 4. Karar Gerekçeleri (Architectural Rationale)

1. **Neden Modüler Monolit?**
   - 300-600 oyunluk bir veri seti ve günde 1-3 kez çalışan sync job için mikroservis, Redis veya mesaj kuyruğu mimari aşırı-mühendislik (over-engineering) yaratır.
   - Tek bir repo, paylaşılan Prisma tipleri ve tek bir PostgreSQL veritabanı operasyonel sadelik ve yüksek güvenilirlik sunar.
2. **Neden PostgreSQL Advisory Lock?**
   - Redis gerekmeksizin doğrudan veritabanı motoru üzerinden eşzamanlı çift senkronizasyon çalışması %100 güvenle engellenir.
3. **Neden Server Components?**
   - SEO uyumluluğu, hızlı ilk yükleme (LCP), sıfır client bundle şişkinliği ve doğrudan veritabanı sorgu avantajı sağlar.
