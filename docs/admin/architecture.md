# Game Deals — Admin Control Center Mimari ve İşletim Kılavuzu (FAZ 1.5)

## 1. Genel Bakış ve Ayrım Prensibi

Game Deals Faz 1.5 ile birlikte sistem yönetimi ile kişisel kullanıcı ayarları kesin olarak iki bağımsız rotaya ayrılmıştır:

- **/ayarlar**: Tüm giriş yapmış kullanıcılara (Free, Pro, Owner) açık Kişisel Hesap ve Bildirim Ayarları portalıdır.
- **/admin**: Yalnızca `Role.OWNER` yetkisine sahip sistem yöneticilerine açık Sistem Kontrol Merkezidir.

```
                    ┌─────────────────────────┐
                    │       KULLANICI         │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
        [ Role === USER ]               [ Role === OWNER ]
                 │                               │
                 ▼                               ▼
          /ayarlar                           /admin
   (Kişisel Profil, Tercihler,        (Sistem Kontrol Merkezi,
    Telegram Bağlama, Bildirimler)     Katalog, İşçi, Denetim)
```

---

## 2. Güvenlik ve Yetkilendirme Değişmezleri

### Server-Side Owner Gate (`requireOwner`)
Tüm `/admin` rotaları, layout seviyesinde ve sayfa/API endpoint seviyesinde `requireOwner()` ile korunur.
UI üzerinde menü gizlemek tek başına güvenlik kabul edilmez; sunucu katmanında oturum JWT'si çözümlenir, kullanıcının veritabanı kaydı çekilir, askıya alma durumu denetlenir (`requireActiveUser`) ve rolün `OWNER` olduğu doğrulanır. Aksi halde `403 FORBIDDEN` veya `UNAUTHORIZED` fırlatılır.

### Owner Güvenlik Kuralları (INV-001)
1. **Kendi Rolünü Düşürme Yasağı (Self-Demotion Disallowed):** Hiçbir OWNER kendi rolünü USER yapamaz.
2. **Kendi Hesabını Askıya Alma Yasağı (Self-Suspension Disallowed):** Hiçbir OWNER kendi hesabını askıya alamaz.
3. **Son OWNER Koruması (Last Remaining Owner Protection):** Sistemde tek bir aktif OWNER kaldığında, bu yöneticinin rolü düşürülemez, hesabı askıya alınamaz ve silinemez.

### Denetim Günlüğü ve Sırların Maskelenmesi (INV-002)
Tüm idari işlemler (`AdminAuditLog`) tablosuna değişmez (append-only) şekilde işlenir.
`sanitizeAuditData` fonksiyonu loglanan JSON verileri içerisinde parola, token, bot token, chat ID, secret ve oturum çerezlerini tespit ederek `[REDACTED]` ile maskeler.

---

## 3. Admin Kontrol Merkezi Modülleri

| Kategori | Rota | Açıklama |
| :--- | :--- | :--- |
| **GENEL** | `/admin` | Canlı sistem göstergeleri, veritabanı metrikleri ve servis sağlık kartları. |
| **YÖNETİM** | `/admin/users` | Kullanıcı tablosu, filtreleme, arama, rol ve durum yönetimi. |
| | `/admin/users/[id]` | Kullanıcı detay kartı, alarmlar, kütüphane, oturumlar ve Telegram bağlantısı. |
| | `/admin/membership` | FREE ve PRO katman dağılımı, kota ve yetki matrisi. |
| | `/admin/auth` | Kayıt olma politikası (`allowRegistration`), Google OAuth 2.0 durumu ve güvenlik ilkeleri. |
| **KATALOG** | `/admin/catalog` | Tüm katalog oyunları, fiyat durumları, sınıf filtreleri ve arama. |
| | `/admin/catalog/[id]` | 4 sekmeli oyun yönetim paneli (Genel Bakış, Fiyat Geçmişi, İlişkiler, Manuel Ezme). |
| | `/admin/ratings` | Metacritic ve OpenCritic skor dökümü. |
| | `/admin/subscriptions` | Game Pass, EA Play, PS Plus kütüphane aidiyetleri. |
| | `/admin/languages` | Türkçe dublaj, altyazı ve arayüz desteği dökümü. |
| | `/admin/media` | Afiş, ekran görüntüsü ve video fragman varlıkları. |
| **MAĞAZALAR** | `/admin/integrations` | Microsoft Store (Canlı), Steam (NOT_CONFIGURED), PSN (NOT_CONFIGURED). |
| **FİYAT ZEKA**| `/admin/deal-intelligence`| Fırsat skoru algoritması formülü (%40 indirim, %35 dip bonusu, %25 popülerlik). |
| **OPERASYON** | `/admin/operations/scheduler` | Zamanlayıcı aralıkları, anlık senkronizasyon ve canlı ScheduledJobsTable. |
| | `/admin/operations/sync-runs` | Senkronizasyon çalıştırmaları geçmişi, kalem analizleri ve takılan kilit iptali. |
| | `/admin/operations/quality` | Veri kalitesi, eksik afiş, yetim DLC analizleri (`CatalogQualityPanel`). |
| | `/admin/notifications` | SMTP E-posta ve Telegram Bot API yapılandırma ve test gönderim kartları. |
| | `/admin/notifications/deliveries` | Çok kanallı bildirim teslimat kuyruğu, hata günlükleri ve yeniden deneme. |
| **SİTE** | `/admin/site` | Platform genel ayarları, para birimi, dil ve parametreler. |
| | `/admin/seo` | Robots.txt ve sitemap.xml indeksleme kontrolü. |
| **SİSTEM** | `/admin/system/backup` | Tam sistem ve katalog JSON yedekleri, indirme, doğrulama ve geri yükleme. |
| | `/admin/audit` | Denetim günlüğü (`AdminAuditLog`) arama ve payload inceleyici. |
| | `/admin/system/health` | Node.js çalışma zamanı, bellek tahsisi, DB gecikmesi tanılaması. |
| | `/admin/system/danger-zone` | Acil durum kilit sıfırlama ve yüksek sürtünmeli operasyonlar. |

---

## 4. Güvenli Manuel Ezme Modeli (ADR-003)

Mağazalardan (Microsoft/Steam) toplanan veriler ile editöryal düzeltmeler `GameManualOverride` modeli ile birbirinden ayrılmıştır:
- Orijinal mağaza başlığı, afişi ve geliştirici bilgisi silinmez veya bozulmaz.
- Yönetici özel bir başlık, poster veya sınıf atadığında `GameManualOverride` kaydı oluşturulur ve zorunlu bir `reason` (gerekçe) istenir.
- Arayüzde hem orijinal mağaza değeri hem de ezilmiş değer yan yana görüntülenir.
- "Ezilmeleri Sıfırla" eylemi ile tek tıkla orijinal mağaza verisine dönülebilir.
