# GAME.ALPERATES.COM.TR — Ürün Keşif Dokümanı (Product Discovery)
**Proje Adı:** Xbox Gerçek Fırsat Takip Sistemi (`game.alperates.com.tr`)  
**Çalışma Modu:** Greenfield (Yeni Başlangıç)  
**Tarih:** 2026-10-14  
**Dil:** Türkçe  

---

## 1. Ürün Amacı ve Vizyonu
Microsoft Store / Xbox Türkiye mağazasında satışa sunulan popüler ve önemli ücretli konsol ve PC oyunlarının fiyat hareketlerini periyodik olarak kaydetmek, bağımsız ve güvenilir bir fiyat geçmişi veritabanı oluşturmak; mağazada gösterilen indirimlerin ve indirim oranlarının gerçekte ne kadar avantajlı olduğunu geçmiş gözlemlere dayalı olarak analiz etmektir.

## 2. Temel Kullanıcı İhtiyacı ve Karar Sorusu
Kullanıcının tek ve en kritik karar sorusu:
> **"Bu oyun şu an gerçekten ucuz mu, yoksa daha önce çok daha ucuza satıldı mı? Şimdi almalı mıyım, beklemeli miyim?"**

Kullanıcı yanıltıcı "Sahte İndirim" (%75 indirim gibi gösterilip aslında geçen ay aynı fiyata satılan oyunlar) tuzaklarına düşmeden rasyonel satın alma kararı verebilmelidir.

## 3. Ürünün Sağlaması Gereken Temel Cevaplar
1. **Mevcut Fiyat ve Liste Fiyatı:** Oyun şu anda kaç TL? İndirimsiz liste fiyatı ne kadar?
2. **Gözlemlenen En Düşük Fiyat (Observed Historical Low):** Takip süremiz boyunca bu oyun için görülen en düşük fiyat nedir ve ne zaman görüldü?
3. **Fırsat Puanı (Deal Score - 0-100) ve Karar (Verdict):** Bu fiyat kaçırılmayacak bir fırsat mı (🔥 Kaçırma), çok iyi mi (🟢 Çok İyi), normal mi (🟡 İyi), yoksa beklenmeli mi (🟠 Bekle / 🔴 Zayıf Fırsat)?
4. **Veri Güven Skoru (Confidence Score):** Bu oyun ne zamandır takip ediliyor? Fiyat geçmişi veri kalitesi yüksek mi (Yeni takip, Düşük, Orta, Yüksek)?
5. **Fiyat Geçmişi Grafiği ve Tablosu:** Oyunun zaman içindeki fiyat kırılımları ne şekilde gerçekleşti?

## 4. Sistemin Asla Vermemesi Gereken Yanıltıcı Cevaplar (Anti-Patterns)
1. **Asla Sahte Fiyat veya Dip Fiyat İddia Edilemez:** Gerçekte gözlemlenmemiş hiçbir fiyat ya da sahte indirim üretilemez.
2. **"Tüm Zamanların Tarihi Dibi" İddiası Yasaktır:** Takip edilmediği döneme ait varsayım yapılamaz; yalnızca *"Takip başladığından beri görülen en düşük fiyat"* ifadesi kullanılır.
3. **DLC, Eklenti, Sanal Para ve Ücretsiz Oyunlar Karıştırılamaz:** Yalnızca ana ücretli oyunlar listelenir.
4. **Stale / Başarısız Veri Güncel Gibi Gösterilemez:** Microsoft Store erişilemediğinde son gözlem zamanı ve durumu açıkça belirtilir.

## 5. Kapsam (In-Scope — Faz 0 & Faz 1)
- **Hedef Oyun Havuzu:** ~300–600 popüler ve önemli ücretli Xbox oyunu (CORE franchise'lar, TRENDING ve NEW popüler oyunlar).
- **Veri Kaynağı:** Microsoft Display Catalog resmi halka açık uç noktaları (TR pazarı, TRY para birimi).
- **Mimari:** Tek depolu Modüler Monolit (Next.js App Router + TypeScript Strict + PostgreSQL + Prisma ORM + Tailwind CSS + Recharts + Docker Compose).
- **Arka Plan İşleri (CLI Workers):** Fiyat senkronizasyonu (`xbox:sync-prices`), Çekirdek liste senkronizasyonu (`xbox:sync-core`), Keşif senkronizasyonu (`xbox:discover`).
- **Web Arayüzü:** 
  - Ana Sayfa (`/`): Öne çıkan fırsatlar, takip dip fiyatları, yeni indirimler, filtreler.
  - Fırsatlar Sayfası (`/firsatlar`): Fırsat puanına ve indirim oranına göre filtrelenebilir liste.
  - Tarihi Dip Sayfası (`/tarihi-dip`): Takip başladığından beri en düşük fiyatta olanlar.
  - Oyun Detay Sayfası (`/oyun/[slug]`): Fiyat geçmişi grafiği, istatistikler, mağaza bağlantısı.
  - Sistem Sağlık Uç Noktası (`/api/health`): Veritabanı ve servis durumu.

## 6. Kapsam Dışı (Out-of-Scope — Faz 1 için Kesinlikle Yasak)
- Telegram botu, bildirim göndericisi veya komut işleyicisi (Yalnızca gelecek faz mimari hazırlığı).
- Kullanıcı kaydı, giriş yapma (Auth), profil veya takip listesi (Watchlist).
- E-posta veya push bildirim altyapısı.
- Redis, Kafka, RabbitMQ veya mikroservis altyapısı.
- Admin yönetim paneli.
- Ücretsiz oyunlar, DLC'ler, eklentiler, coin paketleri ve sezon biletleri.
- Otomatik scraping bypass, proxy havuzları, CAPTCHA çözücüleri.

## 7. Başarı Kriterleri (Success Criteria)
1. **Display Catalog Doğrulaması:** En az 3 popüler ücretli oyun ve 1 ücretsiz ürün üzerinden Microsoft API uç noktalarının TR pazarında doğru çalıştığının kanıtlanması.
2. **Sıfır Sahte Veri:** Veritabanı ve UI'daki her fiyat kaydının Display Catalog API gözlemine dayanması.
3. **Mükemmel Fiyat Geçmişi İdempotensi:** Fiyat değişmediğinde mükerrer geçmiş kaydı oluşturulmaması, sadece fiyat değiştiğinde yeni kayıt açılması.
4. **Hızlı ve Erişilebilir Arayüz:** Modern, karanlık tema odaklı, Xbox kimliğine saygılı, Türkçe ve WCAG 2.2 AA prensiplerine uygun tasarım.
5. **Eksiksiz Doğrulama:** Lint, TypeScript derleme, birim testleri ve production build işlemlerinin hatasız tamamlanması.
