# GAME.ALPERATES.COM.TR — XBOX GERÇEK FIRSAT TAKİP SİSTEMİ
**ALPER DESIGN OS GREENFIELD PRODUCTION PLATFORM**

Xbox ve Microsoft Store Türkiye pazarındaki popüler ücretli oyunların gerçek indirim geçmişini periyodik olarak kaydeden, mağazanın indirim yüzdesi yerine kendi gözlemlediği dip fiyatlara göre rasyonel satın alma kararı üreten fiyat analiz platformu.

---

## 🎯 Ürün Hedefi ve Dürüst UI İlkeleri
- **Ana Soru:** *"Bu oyun şu an gerçekten ucuz mu, yoksa daha önce çok daha ucuza satıldı mı? Şimdi almalı mıyım?"*
- **Sıfır Sahte Veri:** Sistemde asla sentetik veya mock fiyat verisi yer almaz; her veri doğrudan Microsoft Display Catalog Türkiye mağazasından toplanır.
- **Dürüst Dip Fiyat:** *"Tüm zamanların dibi"* iddiası yerine *"Takip başladığından beri görülen en düşük fiyat"* ifadesi kullanılır.
- **Filtreleme:** Ücretsiz oyunlar, DLC'ler, eklentiler, sanal para paketleri ve tüketilebilir içerikler elenir; yalnızca ana ücretli oyunlar izlenir.

---

## 🏗️ Teknoloji Yığını
- **Frontend & Backend:** Next.js (App Router, Server Components) + React 19 + TypeScript (Strict)
- **Veritabanı:** PostgreSQL + Prisma ORM
- **Stil & Tasarım:** Tailwind CSS + ALPER DESIGN OS Dark-First Gaming Tokens
- **Grafik Motoru:** Recharts (Zaman serisi fiyat geçmişi)
- **Doğrulama & Şema:** Zod
- **Test:** Vitest + Playwright
- **Konteynerleştirme:** Docker (Multi-stage non-root) + Docker Compose

---

## 🚀 Hızlı Başlangıç

### 1. Gereksinimler
- Node.js >= 20
- Docker & Docker Compose

### 2. Kurulum
```bash
# Bağımlılıkları yükleyin
npm install

# Ortam değişkenlerini kopyalayın
cp .env.example .env

# PostgreSQL veritabanını Docker ile başlatın
docker compose up -d postgres

# Veritabanı şemasını senkronize edin
npx prisma db push
```

### 3. Çekirdek Oyunları Senkronize Edin
```bash
# 32 CORE franchise ve popüler oyunları veritabanına tohumlayın
npm run xbox:sync-core

# Yeni oyunları keşfedip kataloğa ekleyin (1000+ oyun)
npm run xbox:discover
```

### 4. Geliştirme veya Production Sunucusunu Başlatın
```bash
# Geliştirme modu
npm run dev

# veya Production derlemesi ve çalıştırma
npm run build
npm start
```
Tarayıcınızda `http://localhost:3000` adresine gidin.

---

## 🛠️ Arka Plan Senkronizasyon Komutları

| Komut | Açıklama |
|---|---|
| `npm run xbox:sync-core` | 32 CORE franchise listesindeki oyunları Display Catalog üzerinden veritabanına tohumlar. |
| `npm run xbox:sync-prices` | Aktif tüm oyunların güncel fiyatlarını çeker. Yalnızca fiyatı değişenler için `PriceHistory` açar (idempotent). |
| `npm run xbox:discover` | Mağaza arama ve katalog kaynaklarından yeni ücretli oyunları tarar ve kataloğa kazandırır. |

*Tüm senkronizasyon komutları PostgreSQL `pg_try_advisory_lock` ile eşzamanlı çift çalışmaya karşı korunmaktadır.*

---

## 🧪 Test ve Kalite Güvencesi

```bash
# Birim testleri çalıştırın (Vitest)
npm run test

# TypeScript katı tip denetimi
npm run typecheck

# Kod kalitesi ve lint kontrolü
npm run lint

# Production build denetimi
npm run build
```

---

## 📊 Fırsat Analiz Formülü (Deal Score V1)

- **Dip Fiyat Yakınlığı (%55):** Mevcut fiyatın gözlemlenen dip fiyata olan mesafesi.
- **Mağaza İndirimi (%20):** Aktif indirim yüzdesinin ağırlıklı puanı.
- **İndirim Nadirliği (%15):** Oyunun indirimde kalma sıklığının tersi.
- **Fiyat Momentumu (%10):** Son fiyat hareketinin yönü ve trendi.

### Karar Dereceleri (Verdicts)
- `90 – 100`: 🔥 Kaçırma (EXCELLENT)
- `80 – 89`: 🟢 Çok İyi (VERY_GOOD)
- `65 – 79`: 🟡 İyi Fırsat (GOOD)
- `45 – 64`: 🟠 Bekle (WAIT)
- `0 – 44`: 🔴 Zayıf Fırsat (POOR)
