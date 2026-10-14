# XBOX / MICROSOFT STORE SOURCE RESEARCH & PROOF OF CONCEPT (FAZ 0)

**Tarih:** 2026-10-14  
**Durum:** VERIFIED (Faz 0 Araştırma Kapısı Geçildi)  
**Hedef Pazar:** Türkiye (`market=TR`, `languages=tr-TR`, Para Birimi: `TRY`)  

---

## 1. Test Edilen Kaynaklar (Tested Endpoints)

### A. Birincil Yetkili Fiyat Kaynağı: Microsoft Display Catalog API
- **Endpoint:** `https://displaycatalog.mp.microsoft.com/v7.0/products`
- **Sorgu Parametreleri:**
  - `bigIds`: Virgülle ayrılmış Microsoft/Xbox 12 karakterli alfa-nümerik Product ID listesi (Örn: `9NXFX68ZNKK0,BX3M8L83BBRW,BT5P2X999VH2`)
  - `market=TR`: Türkiye mağazası fiyat ve kullanılabilirlik kuralları
  - `languages=tr-TR`: Türkçe başlık ve yayıncı metinleri
- **Yetkilendirme:** Anonim (No auth / public API). Herhangi bir Bearer token veya API anahtarı gerektirmez.

### B. İkincil Kaynak: Microsoft Mağaza Arama ve Keşif (Discovery)
- **Endpoint:** `https://www.microsoft.com/tr-tr/store/search/games?q={franchise}`
- **Kullanım:** CORE franchise'lara ve popüler oyunlara ait Product ID'lerinin tespiti. Undocumented sözleşme yerine, tespit edilen ID'lerin Display Catalog üzerinden kesin doğrulanması kuralı uygulanır.

---

## 2. Kanıtlanan Doğrulanmış Veri Yolları (Verified JSON Paths)

| Alan | Kaynak JSON Yolu | Açıklama | Doğrulama Durumu |
|---|---|---|---|
| **Product ID** | `product.ProductId` | 12 karakterli benzersiz mağaza kimliği (büyük harf normalize) | **VERIFIED** |
| **Oyun Başlığı (Title)** | `product.LocalizedProperties[0].ProductTitle` | TR yerelleştirilmiş ürün başlığı | **VERIFIED** |
| **Yayıncı (Publisher)** | `product.LocalizedProperties[0].PublisherName` | Oyun dağıtımcısı / yayıncısı | **VERIFIED** |
| **Ürün Tipi (ProductType)** | `product.ProductType` | `Game`, `Durable`, vb. | **VERIFIED** |
| **Görsel (Poster)** | `product.LocalizedProperties[0].Images[Purpose='Poster'].Uri` | Dikey afiş görseli (3:4 kapak resmi) | **VERIFIED** |
| **Görsel (BoxArt)** | `product.LocalizedProperties[0].Images[Purpose='BoxArt'].Uri` | Alternatif kutu resmi | **VERIFIED** |
| **Mevcut Satış Fiyatı** | `Availability.OrderManagementData.Price.ListPrice` | Tüketicinin ödeyeceği güncel satış fiyatı | **VERIFIED** |
| **İndirimsiz Liste Fiyatı** | `Availability.OrderManagementData.Price.MSRP` | Tavsiye edilen normal liste fiyatı (İndirim yoksa `ListPrice`'a eşit) | **VERIFIED** |
| **Para Birimi (Currency)** | `Availability.OrderManagementData.Price.CurrencyCode` | Pazar para birimi (`TRY`) | **VERIFIED** |
| **İndirim Durumu (Sale State)** | `ListPrice < MSRP` | `MSRP` `ListPrice`'dan büyükse aktif indirim var | **VERIFIED** |
| **İndirim Bitiş Zamanı** | `Availability.Conditions.EndDate` | Kampanya bitiş tarihi (ISO-8601 UTC) | **VERIFIED** |
| **İndirim Başlangıç Zamanı** | `Availability.Conditions.StartDate` | Kampanya başlangıç tarihi (ISO-8601 UTC) | **VERIFIED** |
| **Platformlar** | `Availability.Conditions.ClientConditions.AllowedPlatforms` | `Windows.Xbox`, `Windows.Desktop` vb. | **VERIFIED** |

---

## 3. SKU ve Availability Seçim Kuralları (SKU Selection Rules)

Display Catalog tek bir ürün için birden fazla SKU (`0001`, `0010`, `0017`, `trial` vb.) ve her SKU için birden fazla Availability (`Actions: ['Purchase']`, `Actions: ['Gift']`, `Actions: ['License']`, `Actions: ['Redeem']`) dönebilmektedir.

Doğru tüketici satın alma fiyatını elde etmek için **kesin seçim kuralı**:
1. `DisplaySkuAvailabilities` dizisi taranır.
2. `Availabilities` içinde:
   - `Actions` dizisi `"Purchase"` eylemini İÇERMELİDİR (`Actions.includes("Purchase")`).
   - `OrderManagementData.Price.CurrencyCode` değeri `"TRY"` OLMALIDIR.
   - Para birimi `USD` olan lisans/redeem kopyaları elenir.
   - Hediye (`Gift`) veya deneme (`trial`) availability'leri elenir.
3. Bulunan ilk geçerli `Purchase` availability'sinin `OrderManagementData.Price` nesnesi yetkili fiyat olarak kabul edilir.

---

## 4. Toplu İstek (Batching) Davranışı

- `bigIds` parametresi virgülle ayrılmış çoklu Product ID'leri desteklemektedir.
- 5 ürünlü test tek HTTP isteğinde **162ms** sürede eksiksiz yanıt vermiştir.
- Brief doğrultusunda güvenli batch boyutu: `BATCH_SIZE = 25` olarak belirlenmiştir.
- Bu sayede 500 oyunluk bir katalog yalnızca `20 HTTP isteği` ile senkronize edilebilir.

---

## 5. Ücretsiz Ürün Davranışı (Free Game Behavior)

- Örnek: `BT5P2X999VH2` (Fortnite)
- `ListPrice`: `0`
- `MSRP`: `0`
- `isFree` bayrağı: `ListPrice === 0 && MSRP === 0` olarak doğrulanmıştır.
- Brief gereği bu ürünler katalog dışı bırakılır veya `isFree: true` olarak filtrelenir.

---

## 6. Hız Sınırı (Rate Limiting) Gözlemleri

- **Mevcut Durum:** `NO_DOCUMENTED_FIXED_LIMIT_FOUND`.
- Microsoft HTTP başlıklarında `X-RateLimit-*` veya `Retry-After` döndürmemiştir.
- **Uygulanacak Koruma Politikası:**
  - `BATCH_SIZE`: 25
  - `MAX_CONCURRENCY`: 2
  - `REQUEST_DELAY_MIN_MS`: 750
  - `REQUEST_DELAY_MAX_MS`: 1500
  - `REQUEST_TIMEOUT_MS`: 15000
  - `MAX_RETRIES`: 4
  - HTTP 429 alınırsa `Retry-After` süresi kadar beklenir.
  - HTTP 5xx veya ağ hatalarında jitter ile exponential backoff uygulanır.
  - Agresif scraping veya anti-bot bypass yapılmaz.

---

## 7. Çözülemeyen Riskler ve Sınırlamalar

1. **Game Pass Ayrımı:** Display Catalog API'sinde Game Pass aboneliğine dahil olma durumu doğrudan açık bir bayrak olarak bulunmamaktadır; Game Pass katalogları ayrı bir servis üzerinden yönetilir. Faz 1'de Game Pass iddiaları yapılmayacak veya `NOT_VERIFIED` bırakılacaktır.
2. **Katalog Değişiklikleri:** Microsoft Store nadiren SKU yapılarını güncelleyebilir. Zod şemaları ile gelen veri her sync işleminde doğrulanmalı ve geçersiz yapılar veritabanını bozmadan loglanmalıdır.
