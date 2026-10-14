# KULLANICI DENEYİMİ VE TASARIM MODELİ (UX & DESIGN SPECIFICATION)

**Proje:** Xbox Gerçek Fırsat Takip Sistemi (`game.alperates.com.tr`)  
**Tasarım Dili:** ALPER DESIGN OS Dark-First Gaming Intelligence  
**Dil:** %100 Türkçe  

---

## 1. Tasarım Yönü ve Prensipleri

1. **Amaca Odaklı Hiyerarşi:** Kullanıcının ana sorusu: *"Şimdi almalı mıyım?"* Arayüz bir e-ticaret vitrini ya da karmaşık admin paneli değil, rasyonel bir satın alma karar motorudur.
2. **Karanlık Tema Odaklı (Dark-First):** Göz yormayan derin koyu arka planlar (`#090D12`, `#0F172A`), yüksek kontrastlı metinler.
3. **Ölçülü Xbox Yeşil Vurgusu:** Ucuz neon yeşil veya RGB pavyon ışıkları yerine; resmi Xbox kimliğine saygılı, sofistike zümrüt/yeşil aksanlar (`#107C10`, Emerald-500/400).
4. **Güçlü Fiyat Hiyerarşisi:** Güncel fiyat (`text-2xl font-bold text-white`), üstü çizili liste fiyatı (`text-sm line-through text-zinc-400`), indirim oranı ve fırsat kararı rozeti anında seçilebilmelidir.
5. **Dürüst UI ve Şeffaf Veri (Truthful UI):** Sentetik süsleme veya gerçek dışı iddia yok. Dip fiyatlar "Takip başladığından beri en düşük" olarak net biçimde ifade edilir.

---

## 2. Tasarım Belirteçleri (Design Tokens)

- **Arka Planlar:**
  - Ana Arka Plan: `bg-zinc-950` (`#09090b`)
  - Kart Arka Planı: `bg-zinc-900/80` (`#18181b`)
  - Kart Hover: `hover:bg-zinc-800/80 border-zinc-800 hover:border-emerald-500/50`
- **Vurgu Renkleri:**
  - Xbox Yeşili: `text-emerald-400`, `bg-emerald-600`, `border-emerald-500/30`
  - Fırsat Renkleri:
    - Kaçırma / Çok İyi: `emerald-400`, `bg-emerald-950/60`, `border-emerald-500/40`
    - İyi: `amber-400`, `bg-amber-950/60`, `border-amber-500/40`
    - Bekle / Zayıf: `zinc-400` / `rose-400`, `bg-zinc-900`, `border-zinc-700`
- **Tipografi:**
  - Sans: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  - Fiyat ve Rakamlar: `tabular-nums font-semibold`

---

## 3. Sayfa Mimarisi ve Rotalar

### A. Ana Sayfa (`/`)
- **Header:** Logo, Arama çubuğu, Hızlı Gezinti (Fırsatlar, Tarihi Dip, Hakkında).
- **Hero & Özet İstatistikler:** Takip edilen oyun sayısı, aktif indirim sayısı, bugün tespit edilen tarihi dip sayısı, son senkronizasyon zamanı.
- **Öne Çıkan Fırsatlar (Best Deals):** Fırsat puanı $\ge 85$ olan güncel indirimler.
- **Tarihi Dip Fiyattakiler (Historical Lows):** Takip süresi boyunca en düşük fiyata inen oyunlar.
- **Popüler Seriler (Core Franchises):** GTA, Cyberpunk, Forza, Assassin's Creed, Witcher vb. hızlı filtre sekmeleri.
- **Footer:** Veri şeffaflığı ve yasal bilgilendirme ("Microsoft veya Xbox ile resmi bir bağı yoktur. Veriler halka açık mağaza bilgilerine dayanır.").

### B. Fırsatlar Kataloğu (`/firsatlar`)
- Filtreler: İndirim Oranı (%25+, %50+, %75+), Fırsat Puanı (Kaçırma, Çok İyi), Platform (Xbox Series X\|S, Xbox One, PC).
- Sıralama: Fırsat Puanı (Azalan), İndirim Oranı (Azalan), Fiyat (Artan/Azalan), Alfabetik.
- Grid: Duyarlı 2/3/4 sütunlu oyun kartları.

### C. Tarihi Dip Sayfası (`/tarihi-dip`)
- Yalnızca şu an takip edildiğinden beri en ucuz seviyesinde olan oyunlar.
- Fiyat farkı ve önceki dip fiyattan bu yana geçen süre.

### D. Oyun Detay Sayfası (`/oyun/[slug]`)
- **Üst Panel:** Büyük kapak görseli, başlık, yayıncı, platform rozetleri, doğrudan Xbox Store satın alma butonu.
- **Fırsat Analiz Kartı:** Fırsat Puanı (0-100 gauge/bar), Türkçe Karar (`🔥 Kaçırma`), Veri Güven Seviyesi (`💎 Çok Yüksek Güven - 180+ gün`), Deterministik Gerekçe metni.
- **Fiyat Geçmişi Grafiği (Recharts):** Zaman serisi çizgi/alan grafiği. Tarihi dip çizgisi, indirim dönemleri vurgusu.
- **Fiyat Geçmişi Tablosu:** Gözlem tarihi, liste fiyatı, satış fiyatı, indirim oranı.

---

## 4. Durum Yönetimi (State Modeling)

| Durum | Görsel Davranış |
|---|---|
| **SUCCESS** | Veriler tam ve güncel yüklenir, kartlar ve grafikler çizilir. |
| **LOADING** | İskelet (Skeleton) yükleyiciler ile kart ve grafik yer tutucuları gösterilir. |
| **EMPTY** | Filtreye uygun oyun bulunamadığında dostça Türkçe mesaj ve temizleme butonu sunulur. |
| **PARTIAL** | Fiyat geçmişi henüz 1 gözlemden ibaretse grafik yerine "İlk kez takip ediliyor, geçmiş oluşuyor" bilgi kartı gösterilir. |
| **ERROR** | Veritabanı veya ağ kesintisinde zarif hata ekranı ve yeniden deneme butonu gösterilir. |
