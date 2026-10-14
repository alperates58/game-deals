# TEHDİT MODELİ VE GÜVENLİK ANALİZİ (SECURITY THREAT MODEL)

**Proje:** Xbox Gerçek Fırsat Takip Sistemi (`game.alperates.com.tr`)  
**Metodoloji:** STRIDE & ALPER DESIGN OS Threat Matrix  

---

## 1. Tehdit Analiz Matrisi

| Tehdit ID | Tehdit Kategorisi | Risk Tanımı | Etki | Alınan Önlem / Azaltma Stratejisi (Mitigation) | Doğrulama Yöntemi |
|---|---|---|---|---|---|
| **THREAT-01** | SSRF (Server-Side Request Forgery) | Dış istek URL'lerinin dinamik kullanıcı girdisiyle zehirlenmesi | Yüksek | Display Catalog API URL'i sabit kodlanmış şablondur (`https://displaycatalog.mp.microsoft.com/v7.0/products`). Yalnızca regex doğrulamalı 12 haneli alfanümerik Product ID kabul edilir (`/^[A-Z0-9]{12}$/`). | Input validation testleri |
| **THREAT-02** | Malicious Upstream Payload | Dış API'den gelen yanıltıcı veya devasa boyutta JSON yanıtı | Orta | Yanıt boyutu sınırı (Max 10MB) ve Zod şeması ile tip katılığı. Beklenmeyen alanlar otomatik yok sayılır. | Zod schema parse testleri |
| **THREAT-03** | Upstream Schema Breaking | Microsoft'un JSON alanlarını değiştirmesi veya kaldırması | Yüksek | Zod `safeParse` kullanılır. Hatalı öğeler loglanır, mevcut veritabanı bozulmaz, sync işlemi kontrollü `PARTIAL` durumuna geçer. | Fault tolerance testleri |
| **THREAT-04** | SQL Injection | Kullanıcı arama veya filtre parametreleriyle veritabanı enjeksiyonu | Kritik | Prisma ORM parametrik sorguları kullanılır; raw dinamik string SQL birleştirme KESİNLİKLE yasaktır. | Static code scan & Prisma AST |
| **THREAT-05** | XSS (Cross-Site Scripting) | Dış kaynaktan gelen oyun başlığı veya açıklamalarında kötü amaçlı script etiketleri | Yüksek | Ham HTML render (`dangerouslySetInnerHTML`) kullanılmaz. React varsayılan güvenli string escaping mekanizması işletilir. | React code audit |
| **THREAT-06** | Secret Sızıntısı | Veritabanı şifresi veya bağlantı URL'sinin loglara veya frontend bundle'ına sızması | Kritik | `DATABASE_URL` sunucu tarafında tutulur (`NEXT_PUBLIC_` öneki verilmez). Log mesajlarında bağlantı dizesi maskelenir. | Environment isolation scan |
| **THREAT-07** | Eşzamanlı Senkronizasyon (Race Condition) | İki sync işinin aynı anda çalışıp veritabanını kilitlemesi veya mükerrer veri üretmesi | Orta | PostgreSQL `pg_try_advisory_lock` ile oturum seviyesinde tekil yürütme garanti edilir. | Concurrency unit test |
| **THREAT-08** | Yeniden Deneme Fırtınası (Retry Storm / DoS) | Microsoft API geçici 5xx verdiğinde sonsuz ve agresif istek gönderilmesi | Orta | Maksimum 4 deneme sınırı (`MAX_RETRIES=4`), üstel geri çekilme (exponential backoff) ve rastgele gecikme (jitter). | Rate limiter & backoff unit test |
| **THREAT-09** | Güvensiz Dış Yönlendirme (Unsafe Redirect) | Kullanıcıyı sahte bir mağaza sitesine yönlendirme riski | Yüksek | Mağaza linkleri kesinlikle izinli listeye tabidir: yalnızca `https://www.xbox.com/tr-tr/games/store/...` domainine yönlendirilir. | Store URL validator unit test |
