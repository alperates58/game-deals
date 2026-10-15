# ADR-004: Otonom Worker Mimarisi ve İki Aşamalı PostgreSQL Advisory Lock Stratejisi

## Durum
Kabul Edildi (Accepted)

## Bağlam
Game Deals platformunda katalog keşfi (`CATALOG_DISCOVERY`), fiyat güncelleme (`PRICE_SYNC`), metadata tazeleme (`METADATA_REFRESH`) ve ilişki çözümleme (`RELATIONSHIP_REFRESH`) işlemlerinin otonom olarak arka planda çalıştırılması gerekmektedir.

Mevcut sistemde web process içinde `setInterval` veya zamanlayıcı çalıştırmak şu riskleri barındırır:
1. Web process'in HTTP isteklerine yanıt verirken CPU/Network darboğazına girmesi.
2. Next.js serverless/container yeniden başlatmalarında (Coolify redeploy) bellek içi sayaçların kaybolması.
3. Yönetici panelinden (`/ayarlar`) manuel tetikleme yapıldığında arka plan zamanlayıcısı ile çakışma yaşanması.
4. Microsoft Display Catalog / Emerald API'ye aynı anda birden fazla iş parçacığı tarafından istek atılması sonucu HTTP 429 (Too Many Requests) hız limiti aşımı yaşanması.

## Karar

### 1. Ayrık Worker Çalışma Zamanı (Dedicated Worker Runtime)
Web process (`next start`) ve Worker process (`npm run worker`) aynı Docker imajı ve kod tabanını paylaşacak, ancak bağımsız container servisleri olarak koşturulacaktır.
- `web`: Port 3000 üzerinden UI ve API trafiğini yönetir.
- `worker`: Port dinlemez; 30 saniyelik aralıklarla PostgreSQL veritabanındaki `SystemSetting` ve `ScheduledJobState` tablolarını sorgulayarak vadesi gelmiş (`nextRunAt <= now`) işleri sırayla yürütür.

### 2. İki Düzeyli PostgreSQL Advisory Lock (Two-Level Locking)
Çakışmaları ve upstream hız aşımını önlemek için PostgreSQL'in transaction dışı oturum/bağlantı kilitleri (`pg_try_advisory_lock`) kullanılır:

1. **İş Düzeyi Kilit (Job-Specific Lock)**:
   - `CATALOG_DISCOVERY`: `884729101`
   - `PRICE_SYNC`: `884729102`
   - `METADATA_REFRESH`: `884729103`
   - `RELATIONSHIP_REFRESH`: `884729104`
   Aynı iş türünün aynı anda iki farklı süreç (ör. Worker + Manuel Settings UI) tarafından başlatılmasını kesin olarak engeller. Alınamazsa `ALREADY_RUNNING` döner.

2. **Evrensel Xbox API Kilidi (Global Xbox API Lock)**:
   - `GLOBAL_XBOX_API`: `884729100`
   Farklı işlerin (ör. Katalog Keşfi ile Fiyat Senkronizasyonu) Microsoft Store API'lerini aynı anda aşırı yüklemesini engeller. Eğer katalog keşfi sürerken fiyat güncelleme vakti gelirse, fiyat işi evrensel kilidi bekler, ilk iş bittiğinde bir sonraki worker döngüsünde devreye girer. Alınamazsa `GLOBAL_XBOX_API_BUSY` döner ve iş kilit çakışması yaşamadan bir sonraki tura ötelenir.

### 3. Kalıcı İş Durumu (Persistent Job State)
Tüm iş durumları `ScheduledJobState` tablosunda saklanır:
- `lastStartedAt`, `lastFinishedAt`, `lastSuccessAt`, `nextRunAt`
- Metrikler: `lastDurationMs`, `lastItemsProcessed`, `lastItemsAdded`, `lastItemsChanged`, `lastErrorCount`, `last429Count`, `last5xxCount`
- Sanitized `lastErrorSummary`: Şifre veya gizli anahtar içermeyen hata özeti.

### 4. Hata Güvenliği (Failure Safety)
- Upstream 429 veya 5xx durumunda mevcut veritabanı kayıtları asla silinmez.
- Hata alan iş, worker sürecini çökertmez (`try/catch` izolasyonu).
### 5. Bağlantı Güvenliği & Dedicated Connection Mimarisi (Pre-QA Hotfix)
Prisma ORM bağlantı havuzu (connection pool) kullandığından, session-level advisory kilitlerin (`pg_try_advisory_lock` / `pg_advisory_unlock`) bağımsız Prisma `$queryRaw` çağrılarıyla farklı havuz bağlantılarına dağılması durumunda kilit sızıntısı ve çözülememe riski mevcuttur.

Bu nedenle:
- Advisory kilit yönetimi doğrudan `pg` (node-postgres) üzerinden açılan **özel/dedicated bir veritabanı bağlantısı** ile yürütülür.
- `withXboxJobLocks(jobType, runActualJob)` fonksiyonu:
  1. Tek bir dedicated `pg.Client` bağlantısı açar.
  2. İş kilidini ve evrensel kilidi AYNI bağlantı üzerinde sırayla alır.
  3. Korumalı işi çalıştırır.
  4. `finally` bloğu içinde AYNI bağlantı üzerinde evrensel kilidi ve iş kilidini çözer, ardından bağlantıyı kapatır.
  5. İşlem veya container aniden sonlansa dahi, PostgreSQL TCP bağlantısının kesildiğini tespit ederek session advisory kilitlerini anında otomatik olarak serbest bırakır.
- `pg_advisory_unlock_all()` yalnızca çağıran PostgreSQL oturumunun kilitlerini çözebildiğinden, diğer worker süreçlerinin kilitlerini uzaktan açtığı yönündeki yanıltıcı "Force Unlock" semantiği kaldırılmıştır.
- Bunun yerine **Stale Job Reconciliation** (30 dakikayı aşan RUNNING işlerin otomatik düzeltilmesi) ve **Reset Stuck State** mekanizması devreye alınmıştır.

## Sonuçlar
- Pozitif: Sıfır yarış durumu (race condition), sıfır veri kaybı, 429 koruması.
- Pozitif: Web process hafif ve duyarlı kalır.
- Pozitif: Manuel panel eylemleri ve otonom döngü tam olarak aynı servis katmanını (`runScheduledJob`) kullanır.
- Pozitif: Prisma bağlantı havuzu belirsizliklerinden tamamen arındırılmış, deterministik ve bağlantı-güvenli PostgreSQL advisory lock yaşam döngüsü.

