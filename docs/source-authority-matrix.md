# KAYNAK YETKİ MATRİSİ (SOURCE AUTHORITY MATRIX)

Bu matris sistemdeki her bir veri alanının kaynağını (source-of-truth), yetki düzeyini, yedek (fallback) stratejisini ve doğrulama durumunu tanımlar.

| Veri Alanı | Birincil Kaynak (Source of Truth) | Yetki Düzeyi (Authority) | Fallback Stratejisi | Doğrulama Durumu (Verification Status) |
|---|---|---|---|---|
| **Product ID (`xboxProductId`)** | Microsoft Display Catalog | `AUTHORITATIVE` | None (Zorunlu alan) | **VERIFIED** |
| **Başlık (`title`)** | Microsoft Display Catalog (`LocalizedProperties.ProductTitle`) | `AUTHORITATIVE` | Slug derived title | **VERIFIED** |
| **Yayıncı (`publisher`)** | Microsoft Display Catalog (`LocalizedProperties.PublisherName`) | `AUTHORITATIVE` | "Bilinmiyor" | **VERIFIED** |
| **Ürün Tipi (`productType`)** | Microsoft Display Catalog (`ProductType`) | `AUTHORITATIVE` | "Game" | **VERIFIED** |
| **Kapak Görseli (`imageUrl`)** | Microsoft Display Catalog (`LocalizedProperties.Images[Poster/BoxArt]`) | `AUTHORITATIVE` | Placeholder svg | **VERIFIED** |
| **Mevcut Satış Fiyatı (`currentPrice`)** | Microsoft Display Catalog (`OrderManagementData.Price.ListPrice`) | `AUTHORITATIVE` | Son başarılı DB kaydı | **VERIFIED** |
| **Normal Liste Fiyatı (`listPrice`)** | Microsoft Display Catalog (`OrderManagementData.Price.MSRP`) | `AUTHORITATIVE` | `currentPrice` | **VERIFIED** |
| **İndirim Oranı (`discountPercent`)** | Hesaplanmış Veri (`(listPrice - currentPrice) / listPrice * 100`) | `DERIVED` | 0 | **VERIFIED** |
| **Para Birimi (`currency`)** | Microsoft Display Catalog (`OrderManagementData.Price.CurrencyCode`) | `AUTHORITATIVE` | "TRY" | **VERIFIED** |
| **İndirimde mi (`isOnSale`)** | Karşılaştırma (`currentPrice < listPrice`) | `DERIVED` | false | **VERIFIED** |
| **İndirim Bitiş Tarihi (`saleEndAt`)** | Microsoft Display Catalog (`Conditions.EndDate`) | `AUTHORITATIVE` | null | **VERIFIED** |
| **Desteklenen Platformlar (`platforms`)** | Microsoft Display Catalog (`Conditions.AllowedPlatforms`) | `AUTHORITATIVE` | ["Xbox"] | **VERIFIED** |
| **Popülerlik Havuzu (`franchise`, `isCore`)** | Authoritative Seed + Discovery Source | `AUTHORITATIVE` | CORE seed | **VERIFIED** |
| **Gözlemlenen Dip Fiyat (`historicalLow`)** | Bizim PostgreSQL Veritabanımız (`PriceHistory` MIN(`currentPrice`)) | `AUTHORITATIVE_INTERNAL` | İlk gözlemlenen fiyat | **VERIFIED** |
| **Gözlemlenen Dip Zamanı (`historicalLowAt`)** | Bizim PostgreSQL Veritabanımız (`PriceHistory.observedAt`) | `AUTHORITATIVE_INTERNAL` | `createdAt` | **VERIFIED** |
| **Fırsat Puanı (`dealScore`)** | Fırsat Analiz Motoru Algoritması (0–100) | `DERIVED` | Formül çıktısı | **VERIFIED** |
| **Veri Güven Düzeyi (`confidenceScore`)** | Gözlem Gün Sayısı ve Fiyat Değişim Sıklığı Algoritması | `DERIVED` | `LOW` (yeni oyun) | **VERIFIED** |
| **Fırsat Kararı (`verdict`)** | Fırsat Puanı Aralık Eşlemesi (`EXCELLENT`, `VERY_GOOD`, vb.) | `DERIVED` | Deterministik metin | **VERIFIED** |
| **Gerekçe (`reason`)** | Fırsat Puanı Faktör Ayrışımı (Türkçe açıklama) | `DERIVED` | Deterministik kural | **VERIFIED** |
| **Game Pass Durumu** | Microsoft Catalog harici servis | `EXTERNAL_UNVERIFIED` | Faz 1'de iddia yok | **NOT_VERIFIED** |

---

## Provenance İlkeleri
1. **AUTHORITATIVE:** Doğrudan Microsoft Display Catalog TR API yanıtından parse edilen doğrulanmış gerçek veriler.
2. **AUTHORITATIVE_INTERNAL:** Kendi PostgreSQL veritabanımızda gözlemlenmiş zaman serisi fiyat geçmişi.
3. **DERIVED:** Authoritative verilerden saf, deterministik matematiksel fonksiyonlarla üretilen türetilmiş veriler.
4. **MOCK_SYNTHETIC:** KESİNLİKLE YASAKLANMIŞTIR. Üretim ortamında ve son kullanıcı ekranlarında sentetik sahte fiyat veya indirim verisi yer alamaz.
