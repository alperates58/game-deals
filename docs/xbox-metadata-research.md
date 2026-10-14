# MICROSOFT DISPLAY CATALOG METADATA ARAŞTIRMASI (FAZ 1.1)

**Tarih:** 2026-10-14  
**Kapsam:** Faz 1.1 Metadata Alanları Araştırma Kapısı  
**Durum:** VERIFIED  

---

## 1. Doğrulanan Metadata Alanları Matrisi

Display Catalog API yanıtları gerçek ürünler üzerinde test edilmiş (`docs/evidence/faz1.1/metadata-fields-verified.json`), her alanın yetkili JSON yolu ve durumu tespit edilmiştir:

| Metadata Alanı | JSON Yolu | Örnek Değer | Durum |
|---|---|---|---|
| **Kısa Açıklama (Short Description)** | `LocalizedProperties[0].ShortDescription` | "Oyun ve eğlence dünyasının parlayan yıldızları..." | **VERIFIED** |
| **Uzun Açıklama (Long Description)** | `LocalizedProperties[0].ProductDescription` | "Los Santos'a hoş geldiniz. Genç bir sokak dolandırıcısı..." | **VERIFIED** |
| **Geliştirici (Developer)** | `LocalizedProperties[0].DeveloperName` | "Rockstar Games", "CD PROJEKT RED" | **VERIFIED** |
| **Yayıncı (Publisher)** | `LocalizedProperties[0].PublisherName` | "Rockstar Games", "Ubisoft" | **VERIFIED** |
| **Çıkış Tarihi (Release Date)** | `MarketProperties[0].OriginalReleaseDate` veya `Properties.OriginalReleaseDate` | "2025-04-15T15:00:00.0000000Z" | **VERIFIED** |
| **Türler / Kategoriler (Genres/Categories)** | `Properties.Categories` / `Properties.Category` | `["Action & adventure"]` | **VERIFIED** |
| **Özellikler / Yetenekler (Capabilities)** | `Properties.Attributes[].Name` | `["XboxLive", "BroadcastSupport", "SinglePlayer"]` | **VERIFIED** |
| **Platform Desteği (Platforms)** | `Conditions.ClientConditions.AllowedPlatforms[].PlatformName` | `["Windows.Xbox", "Windows.Desktop"]` | **VERIFIED** |
| **Ekran Görüntüleri (Screenshots)** | `LocalizedProperties[0].Images[ImagePurpose='Screenshot'].Uri` | `//store-images.s-microsoft.com/image/...` (4K/HD resimler) | **VERIFIED** |
| **Tanıtım Videoları (Trailers / Videos)** | `LocalizedProperties[0].Videos` | Çoğu üründe boş dizi veya CDN bağlantısı | **PARTIAL** |
| **Yaş Derecelendirmesi (Age Rating)** | `MarketProperties[0].UsageData` / `ContentRatings` | PEGI / USK / ESRB dereceleri | **VERIFIED** |
| **Desteklenen Diller (Languages)** | `Packages[].Languages` | `["en-us", "tr-tr", "de-de", ...]` | **VERIFIED** |

---

## 2. Dürüst UI İlkeleri (Truthful UI)
- Ekran görüntüleri mevcut değilse sahte resim basılmaz; ekran görüntüsü galerisi gizlenir.
- Açıklamalar untrusted girdi kabul edilerek React varsayılan güvenli string escaping ile basılır, `dangerouslySetInnerHTML` kullanılmaz.
- Video/fragman linki bulunmuyorsa video oynatıcı yer tutucusu gösterilmez.
