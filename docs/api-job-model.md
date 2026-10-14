# API VE ARKA PLAN İŞLERİ MODELİ (API & JOB MODEL SPECIFICATION)

**Proje:** Xbox Gerçek Fırsat Takip Sistemi (`game.alperates.com.tr`)  

---

## 1. Fırsat Puanı Motoru (Deal Score Engine V1)

Deal Score 0–100 arasında hesaplanan ve 4 nesnel faktörün ağırlıklı toplamından oluşan bir formüldür:

$$\text{Deal Score} = (S_{\text{low}} \times 0.55) + (S_{\text{discount}} \times 0.20) + (S_{\text{rarity}} \times 0.15) + (S_{\text{momentum}} \times 0.10)$$

### A. Faktörler ve Hesaplama Kuralları
1. **Dip Fiyat Yakınlığı ($S_{\text{low}}$ — %55):**
   - Eğer `currentPrice <= historicalLow`: 100 puan.
   - Eğer `currentPrice >= listPrice`: 0 puan.
   - Aradaki değerler: $100 \times \left(1 - \frac{\text{currentPrice} - \text{historicalLow}}{\text{listPrice} - \text{historicalLow}}\right)$.
2. **Mağaza İndirimi ($S_{\text{discount}}$ — %20):**
   - İndirim yüzdesi doğrudan puanlanır: $\min(100, \text{discountPercent} \times 1.25)$ (Örn: %80 indirim = 100 puan, %50 = 62.5 puan).
3. **İndirim Nadirliği ($S_{\text{rarity}}$ — %15):**
   - Oyunun takip süresi boyunca indirimde kaldığı gün oranının tersidir. Sürekli indirimde olan oyunların nadirlik puanı düşer; nadiren indirime giren oyunlar yüksek puan alır.
4. **Fiyat Momentumu ($S_{\text{momentum}}$ — %10):**
   - Son 30 gündeki fiyat trendi. Fiyat son gözlemlerde düşme eğilimindeyse ve yeni bir taban oluşturuyorsa yüksek puan alır.

### B. Karar Eşlemesi (Verdict Mapping)

| Skor Aralığı | Karar Kodu | Türkçe UI Rozeti | Karar Anlamı |
|---|---|---|---|
| **90 – 100** | `EXCELLENT` | 🔥 Kaçırma | Tarihi dipte veya çok yakın, büyük ve nadir indirim. Hemen alınmalı. |
| **80 – 89** | `VERY_GOOD` | 🟢 Çok İyi | Fiyat dip seviyeye yakın, güçlü indirim. Alınabilir. |
| **65 – 79** | `GOOD` | 🟡 İyi | Makul indirim, ancak geçmişte biraz daha ucuza görüldü. |
| **45 – 64** | `WAIT` | 🟠 Bekle | Yüzeysel indirim veya önceki dip fiyatlardan belirgin şekilde pahalı. |
| **0 – 44** | `POOR` | 🔴 Zayıf Fırsat | Sahte veya değersiz indirim, tavsiye edilmez. |

### C. Veri Güven Düzeyi (Confidence Model)

| Takip Süresi (Gün) | Güven Kodu | Türkçe Etiket | Açıklama |
|---|---|---|---|
| **0 – 14 gün** | `LOW` | ⚠️ Yeni Takip | Veri geçmişi henüz 2 haftadan kısa, dip fiyat referansı taze. |
| **15 – 59 gün** | `MEDIUM` | 📊 Orta Güven | 1-2 aylık fiyat hareketleri gözlemlendi. |
| **60 – 179 gün** | `HIGH` | 🛡️ Yüksek Güven | Çeyrek yıllık periyotlar ve indirim döngüleri kaydedildi. |
| **180+ gün** | `VERY_HIGH` | 💎 Çok Yüksek Güven | 6 aydan uzun sağlam veri tabanı. |

---

## 2. Arka Plan Senkronizasyon Komutları (CLI Jobs)

Tüm işler `npm run` scriptleri olarak tek kod tabanından çalıştırılır:

1. **`npm run xbox:sync-prices`:**
   - Aktif tüm oyunların (`isActive: true`) Microsoft Display Catalog üzerinden güncel fiyatlarını çeker.
   - Batch boyutu: 25. Concurrency: 2. Gecikme: 750-1500ms.
   - Sadece fiyatı değişenler için `PriceHistory` açar, dip fiyatı ve DealScore'u günceller.
2. **`npm run xbox:sync-core`:**
   - 32 CORE franchise ve temel popüler oyun listesini veritabanına tohumlar (seed/upsert) ve ilk fiyatlarını senkronize eder.
3. **`npm run xbox:discover`:**
   - Microsoft Store arama ve katalog kaynaklarından yeni ücretli oyunları tarar ve kataloğa kazandırır.

### Zamanlanmış Görev Planı (Cron Schedule)
- **Fiyat Senkronizasyonu:** Her gün `06:00 Europe/Istanbul` (Opsiyonel: 06:00, 14:00, 22:00)
- **Haftalık Keşif:** Her Pazar `05:00 Europe/Istanbul`

### Eşzamanlılık Kilidi (PostgreSQL Advisory Lock)
Her senkronizasyon işi başlamadan önce:
```sql
SELECT pg_try_advisory_lock(884729103);
```
sorgusunu çalıştırır. Kilit alınamazsa ("Başka bir senkronizasyon zaten çalışıyor") uyarısı vererek güvenle durur. İş bittiğinde `pg_advisory_unlock` ile kilit bırakılır.

---

## 3. Sistem Sağlık Uç Noktası (Health API)

- **Rotası:** `GET /api/health`
- **Yanıt Biçimi (200 OK):**
```json
{
  "status": "healthy",
  "service": "game.alperates.com.tr",
  "timestamp": "2026-10-14T21:55:00.000Z",
  "database": "connected",
  "stats": {
    "totalGames": 412,
    "activeDeals": 145,
    "lastSyncAt": "2026-10-14T06:12:30.000Z"
  }
}
```
- **Hata Durumu (503 Service Unavailable):** Veritabanına ulaşılamıyorsa secret sızdırmadan hata durumu döner.
