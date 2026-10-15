# HOME DOCKER QA TEST RUNBOOK & CHECKLIST
## Faz 1.3B (Autonomous Operations) + Faz 1.4 (Catalog Data Quality)
**Tarih:** 15 Ekim 2026  
**Hedef Ortam:** Docker & PostgreSQL (Home Development & Coolify Staging)  
**Durum:** `DEFERRED_TO_HOME_DOCKER_QA` (Şirket bilgisayarında Docker olmadığı için evde test edilecek)

---

### Ortam Hazırlığı ve Ön Kontroller
Şirket bilgisayarında `npm run typecheck`, `npm run lint`, `npm test` (80 test) ve `npm run build` (Next.js 15.5.28 production build) doğrulanmıştır.  
Evdeki test adımları aşağıdaki 15 aşamadan oluşur:

---

### Adım 1: Docker Compose Build (web + worker + postgres)
```bash
# 1. Temiz build oluştur
docker compose build --no-cache

# Beklenen Çıktı:
# - deps aşamasında prisma generate hatasız çalışır
# - builder aşamasında next build hatasız tamamlanır
# - runner aşamasında src ve tsconfig.json dosyaları kopyalanır
```

---

### Adım 2: Fresh DB Migrate (Prisma Non-Destructive Migrations)
```bash
# 1. PostgreSQL container'ını başlat
docker compose up -d postgres

# 2. Sağlık kontrolünü bekle
docker compose ps postgres

# 3. Prisma migrasyonlarını uygula
docker compose run --rm web npx prisma migrate deploy

# Beklenen Çıktı:
# - 20261015170000_scheduled_job_state migrasyonu uygulanır
# - ScheduledJobType ve ScheduledJobStatus enumları oluşturulur
# - ScheduledJobState tablosu hatasız üretilir
```

---

### Adım 3: Full Stack Başlatma (web + worker + postgres)
```bash
# Tüm servisleri ayağa kaldır
docker compose up -d

# Servis durumlarını listele
docker compose ps

# Beklenen Çıktı:
# - postgres: Up (healthy)
# - web: Up (healthy) - port 3000
# - worker: Up (running) - portsuz arka plan
```

---

### Adım 4: Worker Canlı Günlükleri (Worker Logs Verification)
```bash
# Worker loglarını canlı izle
docker compose logs -f worker

# Beklenen Çıktı:
# ==================================================
#   GAME-DEALS AUTONOMOUS SCHEDULER WORKER STARTED  
#   Poll Interval: 30s
# ==================================================
# [Worker] Initialized ScheduledJobState for CATALOG_DISCOVERY...
# [Worker] Initialized ScheduledJobState for PRICE_SYNC...
# [Worker] Initialized ScheduledJobState for METADATA_REFRESH...
# [Worker] Initialized ScheduledJobState for RELATIONSHIP_REFRESH...
```

---

### Adım 5: Manuel Eylem vs Zamanlayıcı Kilit Çakışması (Lock Collision Test)
```bash
# Senaryo:
# 1. /ayarlar sayfasından "Tüm Mağazayı Otomatik Çek" veya "Katalog Taraması" başlat.
# 2. Hemen ardından ikinci bir sekmeden veya terminalden aynı işlemi tetikle:
curl -X POST http://localhost:3000/api/settings/sync-now \
  -H "Content-Type: application/json" \
  -d '{"action": "CATALOG_DISCOVERY"}'

# Beklenen Sonuç:
# - HTTP 409 Conflict döner
# - { "error": "Aynı iş (CATALOG_DISCOVERY) şu anda başka bir süreç tarafından yürütülüyor. Advisory lock devrede.", "locked": true }
# - Aynı anda iki işlem asla çalışmaz (Race condition engellenir).
```

---

### Adım 6: Worker Yeniden Başlatma & Durum Korunumu (Worker Restart Resilience)
```bash
# 1. Worker'ı durdur ve yeniden başlat
docker compose restart worker

# 2. Worker loglarını incele
docker compose logs --tail=50 worker

# Beklenen Sonuç:
# - Graceful shutdown tetiklenir ("Graceful shutdown requested...")
# - Yeniden başlarken PostgreSQL'deki ScheduledJobState okunur
# - Sıfırdan tekrar başlamaz; önceki nextRunAt değerleri aynen korunur.
```

---

### Adım 7: Fiyat Senkronizasyonu (PRICE_SYNC Job)
```bash
# 1. Fiyat senkronizasyonu çalıştır
curl -X POST http://localhost:3000/api/settings/sync-now \
  -H "Content-Type: application/json" \
  -d '{"action": "PRICE_SYNC", "limit": 50}'

# Beklenen Sonuç:
# - Fiyatlar taranır
# - Fiyatı değişmeyen oyunlarda PriceHistory üretilmez (idempotensi)
# - ScheduledJobState tablosunda lastStatus = COMPLETED, nextRunAt = +6 saat olur.
```

---

### Adım 8: Katalog Keşfi (CATALOG_DISCOVERY Job)
```bash
# 1. 5 sayfalık hızlı keşif çalıştır
curl -X POST http://localhost:3000/api/settings/sync-now \
  -H "Content-Type: application/json" \
  -d '{"action": "CATALOG_DISCOVERY", "maxPages": 5}'

# Beklenen Sonuç:
# - Microsoft Display Catalog'dan yeni oyunlar aranır
# - Series X|S ve Xbox One etiketleri atanır
# - ScheduledJobState tablosunda lastStatus = COMPLETED, nextRunAt = +24 saat olur.
```

---

### Adım 9: Metadata Yenileme (METADATA_REFRESH Job)
```bash
# 1. Metadata yenilemeyi tetikle
curl -X POST http://localhost:3000/api/settings/sync-now \
  -H "Content-Type: application/json" \
  -d '{"action": "METADATA_REFRESH", "limit": 25}'

# Beklenen Sonuç:
# - Başlık, yapımcı, çıkış tarihi, tür ve afiş bilgileri yenilenir
# - Sahte fiyat geçmişi satırı OLUŞTURULMAZ
# - ScheduledJobState tablosunda lastStatus = COMPLETED, nextRunAt = +168 saat (7 gün) olur.
```

---

### Adım 10: Otoriter İlişki Yenileme (RELATIONSHIP_REFRESH Job)
```bash
# 1. İlişki yenilemeyi tetikle
curl -X POST http://localhost:3000/api/settings/sync-now \
  -H "Content-Type: application/json" \
  -d '{"action": "RELATIONSHIP_REFRESH", "limit": 20}'

# Beklenen Sonuç:
# - Mafia Trilogy, GTA Trilogy gibi paketlerin içerikleri doğrulanır
# - Ters ilişkiler (Parent=Child) silinir ve temizlenir
# - Eksik alt oyunlar RELATED enum değeri ile sisteme kazandırılır
# - ScheduledJobState tablosunda lastStatus = COMPLETED, nextRunAt = +168 saat (7 gün) olur.
```

---

### Adım 11: Katalog Kalitesi API & Teşhis Filtresi (Quality Endpoint & Drill-Down)
```bash
# 1. Genel kalite raporunu sorgula
curl http://localhost:3000/api/settings/catalog-quality

# Beklenen JSON:
# {
#   "success": true,
#   "report": {
#     "healthScore": 95,
#     "grade": "HEALTHY",
#     "totalProducts": ...,
#     "healthyProducts": ...,
#     "metrics": { ... },
#     "sanityChecks": { "wukongDiscovered": true, "status": "PASS" }
#   }
# }

# 2. Detaylı teşhis filtresi (Drill-Down) sorgula
curl "http://localhost:3000/api/settings/catalog-quality?issue=BUNDLE_WITHOUT_CHILDREN"
curl "http://localhost:3000/api/settings/catalog-quality?issue=UNKNOWN_PRODUCT_CLASS"

# Beklenen JSON:
# { "success": true, "issue": "...", "total": ..., "items": [ { "title": "...", "bigId": "...", "issueReason": "..." } ] }
```

---

### Adım 12: Ayarlar Kontrol Merkezi UI Doğrulaması (Settings UI)
1. Tarayıcıda `http://localhost:3000/ayarlar` adresine git.
2. **"Zamanlayıcı & Keşif"** sekmesinde:
   - "Otonom Zamanlanmış İşler & Telemetri" tablosunu gör.
   - 4 işin (Fiyat, Keşif, Metadata, İlişki) durum rozetlerini (COMPLETED / RUNNING / IDLE) kontrol et.
   - Herhangi bir işin yanındaki "Çalıştır" butonuna tıkla, satırın RUNNING animasyonuna geçişini ve tamamlandığında süresini izle.
   - "Açık / Kapalı" butonuna tıklayarak devre dışı bırakmayı test et.
3. **"Katalog Sağlığı"** sekmesine tıkla:
   - Büyük Bento Health Score kartını ve harf derecesini (MÜKEMMEL / SAĞLIKLI) gör.
   - Black Myth: Wukong referans kontrolünün "PASS" olduğunu teyit et.
   - Herhangi bir anomali kartına tıkla; açılan teşhis çekmecesinde sorunlu ürünlerin listelendiğini gör.

---

### Adım 13: Veritabanı Kalıcılığı (Persistence Check)
```bash
# Tüm container'ları kapat ve veritabanı volume'unun korunduğunu test et
docker compose down
docker compose up -d

# Veritabanında ScheduledJobState kayıtlarının silinmediğini doğrula
docker compose exec postgres psql -U postgres -d gamedeals -c "SELECT \"jobType\", \"enabled\", \"lastStatus\", \"nextRunAt\", \"lastItemsProcessed\" FROM \"ScheduledJobState\";"
```

---

### Adım 14: Veritabanı Yedeği & Geri Yükleme (Backup Integration)
```bash
# 1. /ayarlar sayfasından "Yedekleme & Veri" sekmesine geç
# 2. "Şimdi Tam Yedek Al" butonuna bas
# 3. backups_data klasöründe .dump dosyasının oluştuğunu ve ScheduledJobState tablosunu da içerdiğini teyit et.
```

---

### Adım 15: Nihai Regresyon Kontrolü (Final Regression)
1. Ana Sayfa (`/`): Fırsat kartları, indirim oranları, son fiyat düşüşleri sorunsuz yükleniyor mu?
2. Fırsatlar (`/firsatlar`): Platform filtreleri (Series X|S vs One) ve indirim sıralaması çalışıyor mu?
3. Tarihi Dip (`/tarihi-dip`): Dip fiyat grafiği ve listesi sorunsuz mu?
4. Oyun Detay (`/oyun/[slug]`): Paket içerikleri (bundle relations) ve DLC listesi doğru bağlanmış mı?
5. Sağlık Endpoint'i (`/api/health`): `"scheduler": "healthy"` yanıtı dönüyor mu?
