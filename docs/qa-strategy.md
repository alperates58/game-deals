# KALİTE GÜVENCE VE TEST STRATEJİSİ (QA STRATEGY)

**Proje:** Xbox Gerçek Fırsat Takip Sistemi (`game.alperates.com.tr`)  
**Prensip:** ALPER DESIGN OS — No Claim Without Evidence  

---

## 1. Test Piramidi (Test Pyramid)

```text
               ▲
              / \
             /   \
            / E2E \       Playwright / Browser Doğrulaması (Sayfa Yükleme & Görsel)
           /-------\
          /  Integ  \     API / Database & Advisory Lock Entegrasyonu
         /-----------\
        /  Unit Tests \   Fiyat, Skor, Güven, Zod, Rate-Limiter Birim Testleri
       /---------------\
```

---

## 2. Zorunlu Birim ve Entegrasyon Testleri

Aşağıdaki senaryolar otomatik test paketi ile doğrulanacaktır:
1. `price normalization`: Ondalık fiyatların, MSRP ve satış fiyatının doğru ayrıştırılması.
2. `free-game filtering`: Ücretsiz (0 TL) ve demo oyunların kataloğa eklenmesinin engellenmesi.
3. `price-change detection`: Fiyat değişiminin hassas tespiti.
4. `duplicate-history prevention`: Fiyat aynı kaldığında mükerrer geçmiş kaydının açılmaması.
5. `observed-low calculation`: Takip başladığından beri en düşük fiyatın doğru güncellenmesi.
6. `deal-score calculation`: Deal Score formülünün 4 faktörle hatasız hesaplanması.
7. `confidence calculation`: Takip gün sayısına göre güven düzeyinin (LOW..VERY_HIGH) belirlenmesi.
8. `slug handling`: Türkçe karakterlerin (ş, ğ, ı, ö, ü, ç) SEO ve URL uyumlu slug'a dönüştürülmesi.
9. `duplicate-game handling`: Aynı `xboxProductId` ile gelen mükerrer kayıtların upsert ile yönetilmesi.
10. `API mapping`: Display Catalog JSON yapısının domain modeline dönüştürülmesi.
11. `invalid-upstream-payload`: Bozuk veya eksik JSON geldiğinde sistemin çökmeden loglaması.
12. `429 retry behavior`: HTTP 429 durumunda `Retry-After` süresine riayet edilmesi.
13. `5xx backoff behavior`: Ağ ve sunucu hatalarında exponential backoff + jitter çalışması.

---

## 3. Doğrulama Komutları (Quality Gates)

Tüm adımlar gerçek terminal çıktısı ile doğrulanacaktır:
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
Herhangi bir adımda hata varsa `PASS` denilemez.

---

## 4. UI ve Görsel Doğrulama (Visual & Responsive QA)

Test edilecek viewport boyutları:
- **Desktop Yüksek Çözünürlük:** `1920x1080`
- **Laptop Çözünürlük:** `1440x900`
- **Mobil Ekran:** `390x844` (iPhone 14 / modern mobil)

Kontrol Listesi:
- Yatay taşma (horizontal scrollbar/overflow) olmamalı.
- Fiyatlar ve indirim rozetleri kırılmamalı.
- Recharts fiyat grafiği mobil ekranda responsive davranmalı ve kapsayıcı dışına taşmamalı.
- Yüklenme durumlarında skeleton yer tutucuları gösterilmeli.
- Boş veri durumlarında dostça Türkçe mesaj verilmeli.

---

## 5. Erişilebilirlik Hedefi (Accessibility)

- **Hedef Seviye:** Designed toward WCAG 2.2 AA.
- **Kriterler:**
  - Renk kontrast oranı en az 4.5:1 (metinler) ve 3:1 (grafik ve UI bileşenleri).
  - Tüm butonlar ve linkler klavye ile (Tab, Enter, Space) erişilebilir olmalı.
  - Etkileşimli öğelerde görünür odak halkası (`focus-visible:ring-2`) bulunmalı.
  - Ekran okuyucu etiketleri (`aria-label`) eksiksiz tanımlanmalıdır.
