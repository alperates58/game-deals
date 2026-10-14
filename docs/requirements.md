# SİSTEM GEREKSİNİMLERİ (REQUIREMENTS SPECIFICATION)

**Proje:** Xbox Gerçek Fırsat Takip Sistemi (`game.alperates.com.tr`)  
**Kapsam:** Faz 0 & Faz 1  
**Versiyon:** 1.0.0  

---

## 1. Fonksiyonel Gereksinimler (Functional Requirements)

| ID | Kategori | Açıklama | Kaynak | Öncelik | Kabul Kriteri | Durum |
|---|---|---|---|---|---|---|
| **FR-01** | Katalog | Sistem ~300-600 popüler ücretli Xbox oyununu ve 32 CORE franchise'ı takip edebilmelidir. | Brief §2 | P0 | CORE franchise oyunları veritabanında tohumlanabilir ve senkronize edilir. | DEFINED |
| **FR-02** | Filtreleme | Ücretsiz oyunlar, DLC'ler, eklentiler, sanal para paketleri ana katalogdan filtrelenmelidir. | Brief §2 | P0 | `isFree === true` veya `productType` eklenti/consumable olanlar kataloğa eklenmez. | DEFINED |
| **FR-03** | Fiyat Çekme | Microsoft Display Catalog API üzerinden Türkiye (TR/TRY) fiyatları çekilmelidir. | Brief §9, §19 | P0 | `currentPrice`, `listPrice`, `currency='TRY'` doğru SKU/Availability'den alınır. | DEFINED |
| **FR-04** | Fiyat Geçmişi | Sadece fiyat değiştiğinde `PriceHistory` tablosuna yeni kayıt açılmalı; değişmediğinde mükerrer kayıt açılmamalıdır. | Brief §22 | P0 | Aynı fiyatta ardışık sync çalıştığında PriceHistory satır sayısı artmaz. | DEFINED |
| **FR-05** | Dip Fiyat Tespiti | Takip süresi boyunca gözlemlenen en düşük fiyat (`historicalLow`) ve gözlem zamanı hesaplanmalıdır. | Brief §23 | P0 | Gözlemlenen en düşük fiyat doğru `PriceHistory` kaydından türetilir. | DEFINED |
| **FR-06** | Fırsat Puanı (V1) | Fırsat Puanı (Deal Score 0-100) kural tabanlı ağırlıklarla hesaplanmalıdır (%55 Dip Fiyat Yakınlığı, %20 Mağaza İndirimi, %15 İndirim Nadirliği, %10 Fiyat Momentumu). | Brief §24 | P0 | 0-100 aralığında puan ve 5 kademeli Türkçe karar (`🔥 Kaçırma`, `🟢 Çok İyi`, vb.) üretilir. | DEFINED |
| **FR-07** | Veri Güveni | Fiyat takip süresine dayalı Güven Skoru (`confidenceScore`: LOW, MEDIUM, HIGH, VERY_HIGH) ayrı tutulmalıdır. | Brief §23, §24 | P0 | Takip gün sayısına göre güven skoru hesaplanır. | DEFINED |
| **FR-08** | Ana Sayfa | Kullanıcıya öne çıkan fırsatlar, tarihi diptekiler, yeni indirimler ve popüler oyunları kartlar halinde sunmalıdır. | Brief §26, §28 | P0 | Gerçek veritabanı verisiyle kartlar, fiyatlar, rozetler ve filtreler listelenir. | DEFINED |
| **FR-09** | Fırsat Listesi | `/firsatlar` rotasında tüm indirimli oyunlar sıralama ve filtreleme seçenekleriyle listelenmelidir. | Brief §28 | P0 | İndirim oranı ve fırsat puanına göre sıralanabilir grid. | DEFINED |
| **FR-10** | Dip Fiyat Listesi | `/tarihi-dip` rotasında takip başlangıcından beri en düşük fiyata inen oyunlar listelenmelidir. | Brief §28 | P0 | Yalnızca `currentPrice <= historicalLow` olan indirimli oyunlar listelenir. | DEFINED |
| **FR-11** | Oyun Detay | `/oyun/[slug]` sayfasında oyun bilgileri, fiyat geçmiş grafiği (Recharts), geçmiş tablosu ve mağaza linki gösterilmelidir. | Brief §29 | P0 | Gerçek geçmiş verisiyle grafik çizilir, geçmiş yoksa bilgilendirici durum gösterilir. | DEFINED |
| **FR-12** | Senkronizasyon CLI | `npm run xbox:sync-prices`, `npm run xbox:sync-core`, `npm run xbox:discover` komutları CLI üzerinden çalıştırılabilmelidir. | Brief §25 | P0 | Komut satırından çağrıldığında advisory lock ile güvenli senkronizasyon yapar. | DEFINED |

---

## 2. Güvenilirlik ve Performans Gereksinimleri (Reliability & Performance)

| ID | Kategori | Açıklama | Kaynak | Öncelik | Kabul Kriteri | Durum |
|---|---|---|---|---|---|---|
| **NFR-REL-01** | Hız Sınırı | Microsoft isteklerinde batch size: 25, concurrency: 2, gecikme: 750-1500ms uygulanmalıdır. | Brief §11 | P0 | İstekler arasında yapılandırılabilir bekleme ve kuyruk işletilir. | DEFINED |
| **NFR-REL-02** | Hata Toleransı | 429 yanıtlarında `Retry-After` beklenmeli, 5xx yanıtlarında exponential backoff uygulanmalıdır. | Brief §11 | P0 | Hata durumunda maksimum 4 yeniden deneme yapılır. | DEFINED |
| **NFR-REL-03** | Kaynak Çökmesi | Microsoft API erişilemediğinde mevcut DB kayıtları ve dip fiyatlar bozulmamalı, sync `FAILED/PARTIAL` işaretlenmelidir. | Brief §39 | P0 | API hatası DB'deki mevcut fiyatları silmez veya null yapmaz. | DEFINED |
| **NFR-REL-04** | Eşzamanlılık Kilidi | Eşzamanlı iki senkronizasyon işinin aynı anda çalışması PostgreSQL advisory lock ile engellenmelidir. | Brief §25 | P0 | Aynı anda ikinci bir worker başlatıldığında kilit alınamazsa güvenle sonlanır. | DEFINED |

---

## 3. Güvenlik Gereksinimleri (Security Requirements)

| ID | Kategori | Açıklama | Kaynak | Öncelik | Kabul Kriteri | Durum |
|---|---|---|---|---|---|---|
| **NFR-SEC-01** | Veri Doğrulama | Microsoft'tan gelen tüm dış API yanıtları Zod şeması ile doğrulanmalı, beklenmeyen tipler izole edilmelidir. | Brief §19, §30 | P0 | Şemaya uymayan ürünler loglanır, runtime çökmesi engellenir. | DEFINED |
| **NFR-SEC-02** | XSS Önleme | Oyun başlıkları, açıklamaları ve yayıncı adları ham HTML olarak değil sanitize React render ile basılmalıdır. | Brief §30 | P0 | `dangerouslySetInnerHTML` kullanılmaz, metinler escape edilir. | DEFINED |
| **NFR-SEC-03** | Gizli Veri İzolasyonu | Veritabanı bağlantı dizeleri ve gizli anahtarlar asla istemciye veya loglara sızdırılmamalıdır. | Brief §6, §30 | P0 | Client bundle ve commit geçmişi secret içermez. | DEFINED |

---

## 4. Gözlemlenebilirlik ve Operasyonel Gereksinimler (Observability & Ops)

| ID | Kategori | Açıklama | Kaynak | Öncelik | Kabul Kriteri | Durum |
|---|---|---|---|---|---|---|
| **NFR-OPS-01** | Sağlık Kontrolü | `/api/health` rotası uygulama ve PostgreSQL veritabanı bağlantı durumunu JSON olarak dönmelidir. | Brief §31 | P0 | DB bağlıysa 200 `{ status: "ok", database: "connected" }` döner. | DEFINED |
| **NFR-OPS-02** | Senkronizasyon Günlüğü | Her sync işlemi `SyncRun` tablosuna başlangıç, bitiş, taranan, eklenen, değişen fiyat ve hata sayısıyla kaydedilmelidir. | Brief §21, §31 | P0 | Senkronizasyon sonrasında özet rapor veritabanına ve stdout'a yazılır. | DEFINED |
| **NFR-OPS-03** | Docker Desteği | Uygulama ve PostgreSQL Docker Compose ile tek komutla ayağa kaldırılabilmelidir. | Brief §32 | P0 | `docker-compose.yml` ve multi-stage Dockerfile test edilip doğrulanır. | DEFINED |

---

## 5. Kullanıcı Deneyimi ve Erişilebilirlik Gereksinimleri (UX & Accessibility)

| ID | Kategori | Açıklama | Kaynak | Öncelik | Kabul Kriteri | Durum |
|---|---|---|---|---|---|---|
| **NFR-UX-01** | Dil ve Terminoloji | Arayüz tamamen Türkçe olmalı, yanıltıcı pazarlama dili yerine dürüst ifadeler ("Takip başladığından beri en düşük") kullanılmalıdır. | Brief §5, §23, §27 | P0 | UI'da hiçbir İngilizce kırıntı ve yanıltıcı dip fiyat iddiası yer almaz. | DEFINED |
| **NFR-UX-02** | Duyarlı Tasarım (Responsive) | Masaüstü (1920x1080, 1440x900) ve Mobil (390x844) ekran boyutlarında taşma, kırılma olmaksızın kusursuz görüntülenmelidir. | Brief §37 | P0 | Kart ve grafikler ekran genişliğine göre esner. | DEFINED |
| **NFR-UX-03** | Erişilebilirlik | Renk kontrastı, odak halkaları ve klavye navigasyonu WCAG 2.2 AA hedeflerine uygun olmalıdır. | Brief §38 | P0 | Semantik HTML, ARIA etiketleri ve yeterli kontrast oranı sağlanır. | DEFINED |
