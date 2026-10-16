# Game Deals — Çok Kanallı Bildirim Mimarisi ve İletim Hattı (FAZ 1.5)

## 1. Mimari Tasarım ve Ayrık Boru Hattı (ADR-002)

Game Deals bildirim mimarisi, senkronizasyon döngülerinden ve web isteklerinden tamamen ayrık (decoupled), asenkron ve idempotent çalışan bir boru hattı olarak kurgulanmıştır.

```
┌─────────────────────────────────┐
│     DOMAİN OLAYI ÜRETİCİLERİ     │
│  - price-sync (fiyat düşüşü)    │
│  - alert-evaluator (alarm eşleş)│
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│       NotificationEvent         │  (dedupeKey: `evt_user1_game2_drop_20261016`)
│   - Tip, Oyun, Kullanıcı        │
└────────────────┬────────────────┘
                 │
                 ▼ enqueueEventDeliveries
┌─────────────────────────────────┐
│      NotificationDelivery       │  (@@unique([eventId, channel]))
│   - EMAIL (PENDING)             │
│   - TELEGRAM (PENDING)          │
│   - IN_APP (PENDING)            │
└────────────────┬────────────────┘
                 │
                 ▼ worker-loop (processNotificationDeliveries)
┌─────────────────────────────────────────────────────────────┐
│                       İŞLEYİCİ MANTIK                       │
│  1. Sessiz Saat Kontrolü (Europe/Istanbul quiet-hours)      │
│  2. Kullanıcı Kanal & Olay Tercihi Doğrulaması              │
│  3. Multi-Channel Şablon Render (HTML/Text/MarkdownV2)      │
│  4. İlgili Kanala Teslimat (Nodemailer / Telegram Bot API)  │
│  5. Durum Güncellemesi: SENT | RETRYING | FAILED           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Desteklenen Kanallar ve Entegrasyonlar

### A. SMTP E-posta Sağlayıcısı
- **Protokol:** Node.js `nodemailer` modülü üzerinden güvenli TLS/SSL SMTP bağlantısı.
- **Şablon:** Modern, semantik HTML e-posta kartı (oyun afişi, güncel fiyat, indirim yüzdesi, tarihi dip rozeti) ve eşzamanlı sade metin (plain text) alternatifi.
- **Doğrulama:** E-posta doğrulama tokenları SHA-256 hash olarak saklanır (`EmailVerificationToken`). Doğrulama bağlantısı `15 dakika` geçerlidir.
- **Sır Güvenliği:** Sunucu şifreleri ve SMTP detayları kesinlikle istemci tarafına aktarılmaz, `userMasked` olarak gizlenir.

### B. Telegram Bot API
- **Protokol:** Resmi Telegram Bot API HTTPS endpoint'leri (`sendMessage`).
- **Hesap Eşleme:** Kullanıcı ayarlarından tek kullanımlık 15 dakikalık kriptografik link tokenı üretilir (`/start <token>`). Webhook bu tokenı doğrular ve kullanıcının `telegramChatId` değerini güvenle bağlar.
- **Hata Yönetimi:**
  - 429 Rate Limit: Telegram `retry_after` başlığı okunarak üstel geri çekilme (exponential backoff) uygulanır.
  - 403 Forbidden: Kullanıcı botu engellediyse bağlantı otomatik olarak pasifize edilir (`isActive: false`).
- **MarkdownV2 Güvenliği:** Metin içindeki özel karakterler (`_ * [ ] ( ) ~ \ > # + - = | { } . !`) kaçış karakterleriyle (`\`) korunarak Telegram sözdizimi hataları engellenir.

### C. Site İçi Gelen Kutusu (In-App Inbox)
- **Doğrudan Veritabanı:** `UserNotification` tablosu üzerinde yerel gelen kutusu.
- **Okunma Durumu:** `readAt` zaman damgası ile takip edilir; başlık çubuğundaki bildirim zili canlı okunmamış sayısını (unread badge) gösterir.
- **Erişim:** `/bildirimler` sayfası üzerinden tüm kullanıcılara açıktır.

---

## 3. İdempotens ve Sessiz Saatler (Quiet Hours)

### Dedupe Key İlkesi
Fiyat senkronizasyonu gün içerisinde birden çok kez çalışsa bile, aynı kullanıcıya aynı oyun için aynı indirim gününde mükerrer bildirim gönderilmez. Olaylar deterministik `dedupeKey` ile korunur:
```ts
const dedupeKey = `evt_${userId}_${gameId}_${eventType}_${dateStr}`;
```

### Europe/Istanbul Sessiz Saatler
Kullanıcılar `/ayarlar` sayfasından sessiz saatler tanımlayabilir (varsayılan: 23:00 - 08:00, Europe/Istanbul):
- Belirtilen saat aralığında arka plan işçisi harici anlık teslimatları (Telegram/E-posta) geciktirir veya sessiz saat bitiminde işlenmek üzere `nextAttemptAt` zamanını öteler.
- In-App bildirimler her zaman gelen kutusuna yazılır.

---

## 4. Arka Plan İşçi Döngüsü Entegrasyonu

`src/lib/scheduler/worker-loop.ts` ana işçi döngüsü her çalışma adımında (tick):
1. Kuyrukta bekleyen veya yeniden deneme zamanı gelmiş `NotificationDelivery` kayıtlarını çeker (`limit: 25`).
2. Sağlayıcı durumunu denetler; yapılandırılmamış kanalları atlar.
3. Hata durumunda üstel geri çekilme (`attemptCount`, `nextAttemptAt`) hesaplar ve maksimum 5 denemeden sonra `FAILED` olarak işaretler.
