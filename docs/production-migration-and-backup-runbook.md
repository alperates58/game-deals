# GAME.ALPERATES.COM.TR — FIRST PRODUCTION MIGRATION & BACKUP/RESTORE RUNBOOK

**Belge Versiyonu:** 1.0.0  
**Tarih:** 14 Ekim 2026  
**Uygulama:** game.alperates.com.tr (Xbox Gerçek Fırsat Takip Sistemi)

---

## 1. Genel Bakış

Bu rehber, yerel ortamdaki (Docker Compose) tüm veritabanı (1.924 oyun, 2.082 ilişki, fiyat geçmişi, sistem ayarları ve kullanıcılar) verisinin Coolify/Production sunucusuna sıfır veri kaybıyla aktarılması ve rutin operasyonel yedekleme/geri yükleme süreçlerini belgeler.

---

## 2. Taşınabilirlik & Güvenlik Mimarisi

Kaynak ve hedef veritabanlarının **kullanıcı adı (`POSTGRES_USER`), şifresi (`POSTGRES_PASSWORD`), portu ve veritabanı ismi (`POSTGRES_DB`) tamamen farklı olabilir**.

### A. Dışa Aktarma (`pg_dump` Standartları)
* **Biçim:** PostgreSQL Custom Archive (`-Fc`), zlib sıkıştırmalı.
* **Sahip & Yetki İzolasyonu:** `--no-owner` ve `--no-privileges` parametreleri zorunludur.
* **Sonuç:** Dışa aktarılan arşivde yerel veritabanı rolleri veya grant komutları yer almaz; dosya her ortama uyumludur.

### B. İçe Aktarma (`pg_restore` Standartları)
* **Hedef Kimlik Dinamizmi:** `DATABASE_URL` hedef sunucu ortamından okunur.
* **Sahip İzolasyonu:** `pg_restore -d <hedef_db> -U <hedef_kullanici> --clean --if-exists --no-owner --no-privileges` ile hedef veritabanının kendi kullanıcısı sahipliğinde kurulur.
* **Güvenlik & Kilit:** İşlem öncesi otomatik **pre-restore backup** alınır ve PostgreSQL **advisory lock** ile eşzamanlı veri yazma engellenir.
* **Onay:** Kullanıcı arayüzünde zorunlu `RESTORE` metni girilmeden işlem başlatılamaz.

---

## 3. İlk Prodüksiyon Dağıtım Adımları (Production Migration Workflow)

### Adım 1: Yerel Ortamdan Yedek Alma
1. `http://localhost:3000/ayarlar` sayfasına gidin.
2. **Veri Yönetimi (Yedekleme & Geri Yükleme)** sekmesini açın.
3. **Tam Yedek (FULL BACKUP)** seçeneğini işaretleyip `[ Veritabanı Yedeği Oluştur ]` butonuna basın.
4. Oluşan `game-deals-YYYY-MM-DD-HHmmss.dump` dosyasını `[ İndir ]` butonuyla bilgisayarınıza indirin.

### Adım 2: Coolify / Prodüksiyon Sunucusu Kurulumu
1. Coolify üzerinde yeni PostgreSQL servisi oluşturun (veya mevcut servisi kullanın).
2. `game-deals` Next.js servisini Git reposundan (`https://github.com/alperates58/game-deals`) bağlayın.
3. Ortam değişkenlerini (`DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `BACKUP_DIR=/app/backups`) girin.
4. Servisi deploy edin (`Dockerfile` otomatik olarak `postgresql16-client` kurar ve Prisma migration'larını çalıştırır).

### Adım 3: Prodüksiyona Veri Yükleme & Geri Yükleme
1. Prodüksiyon panelinde `https://game.alperates.com.tr/ayarlar` adresine OWNER hesabıyla girin.
2. **Veri Yönetimi** sekmesinden Adım 1'de indirdiğiniz `.dump` dosyasını seçip `[ Arşivi İncele ]` butonuna basın.
3. Arşiv içeriği (12 tablo, boyut, TOC) doğrulandığında, onay kutucuğuna `RESTORE` yazın.
4. `[ Geri Yüklemeyi Başlat ]` butonuna basın:
   - Sistem otomatik pre-restore güvenlik yedeği alır.
   - Advisory lock ile sistemi bakım moduna alır.
   - `pg_restore` ile tüm oyunları, ilişkileri ve fiyat geçmişini hedef veritabanına yazar.
   - `prisma migrate deploy` çalıştırarak şema güncelliğini teyit eder.
   - Tablo kayıt sayılarını doğrular ve `/api/health` testi yapar.

### Adım 4: Doğrulama
* `GET /api/health` çağrısı yaparak `database: "connected"`, `totalGames: 1924` kontrolü yapın.
* `[ Şimdi Fiyatları Güncelle ]` butonuyla dry-run fiyat senkronizasyonunu test edin.
