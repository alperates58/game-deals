import { NotificationEventType } from "@prisma/client";

export interface NotificationPayload {
  gameTitle: string;
  gameSlug?: string;
  currentPrice: number;
  listPrice?: number;
  discountPercent?: number;
  dealScore?: number;
  matchReason?: string;
  currency?: string;
  triggeredAt?: string;
  parentGameTitle?: string;
}

export interface RenderedTelegramNotification {
  text: string;
}

export interface RenderedEmailNotification {
  subject: string;
  html: string;
  text: string;
}

export interface RenderedInAppNotification {
  title: string;
  body: string;
  linkUrl: string;
}

/**
 * Escapes characters for Telegram MarkdownV2 safely.
 */
export function escapeTelegramMarkdown(text: string): string {
  if (!text) return "";
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

export class NotificationTemplateService {
  private static getAppUrl(): string {
    return process.env.APP_URL || "https://game.alperates.com.tr";
  }

  /**
   * Renders Telegram message for a domain event.
   */
  public static renderTelegram(
    eventType: NotificationEventType,
    payload: NotificationPayload
  ): RenderedTelegramNotification {
    const appUrl = this.getAppUrl();
    const gameUrl = payload.gameSlug ? `${appUrl}/oyun/${payload.gameSlug}` : appUrl;
    const currency = payload.currency || "TL";

    let headline = "🔥 *Fırsat Bildirimi*";
    switch (eventType) {
      case NotificationEventType.PRICE_DROP:
        headline = "📉 *Fiyat Düştü!*";
        break;
      case NotificationEventType.ALERT_MATCHED:
        headline = "🔔 *Fiyat Alarmınız Çaldı!*";
        break;
      case NotificationEventType.NEW_OBSERVED_LOW:
        headline = "🌟 *Yeni Tarihi Dip Fiyat!*";
        break;
      case NotificationEventType.DEAL_SCORE_THRESHOLD:
        headline = "🚀 *Yüksek Fırsat Skoru!*";
        break;
      case NotificationEventType.OWNED_GAME_DLC_DEAL:
        headline = "🎁 *Sahip Olduğunuz Oyuna DLC İndirimi!*";
        break;
      case NotificationEventType.WISHLIST_DEAL:
        headline = "✨ *İstek Listenizdeki Oyun İndirimde!*";
        break;
      case NotificationEventType.FAVORITE_PRICE_CHANGE:
        headline = "❤️ *Favori Oyununuzda Fiyat Değişimi!*";
        break;
    }

    const lines = [
      headline,
      "",
      `🎮 *${escapeTelegramMarkdown(payload.gameTitle)}*`,
    ];

    if (payload.parentGameTitle) {
      lines.push(`📦 Ana Oyun: ${escapeTelegramMarkdown(payload.parentGameTitle)}`);
    }

    if (payload.matchReason) {
      lines.push(`💡 ${escapeTelegramMarkdown(payload.matchReason)}`);
    }

    lines.push(`💰 Güncel Fiyat: *${payload.currentPrice} ${currency}*`);

    if (payload.listPrice && payload.listPrice > payload.currentPrice) {
      lines.push(`🏷️ Liste Fiyatı: ~${payload.listPrice} ${currency}~`);
    }

    if (payload.discountPercent && payload.discountPercent > 0) {
      lines.push(`🎯 İndirim Oranı: *%${payload.discountPercent}*`);
    }

    if (payload.dealScore !== undefined) {
      lines.push(`⚡ Fırsat Skoru: *${payload.dealScore}/100*`);
    }

    lines.push("");
    lines.push(`👉 [Oyunu İncele](${escapeTelegramMarkdown(gameUrl)})`);
    lines.push(`⚙️ [Bildirim Ayarları](${escapeTelegramMarkdown(`${appUrl}/ayarlar`)})`);

    return { text: lines.join("\n") };
  }

  /**
   * Renders HTML and plain text email for a domain event.
   */
  public static renderEmail(
    eventType: NotificationEventType,
    payload: NotificationPayload,
    userEmail: string
  ): RenderedEmailNotification {
    const appUrl = this.getAppUrl();
    const gameUrl = payload.gameSlug ? `${appUrl}/oyun/${payload.gameSlug}` : appUrl;
    const settingsUrl = `${appUrl}/ayarlar`;
    const currency = payload.currency || "TL";

    let subjectPrefix = "Fırsat Bildirimi";
    let title = "Fiyat Güncellemesi";

    switch (eventType) {
      case NotificationEventType.PRICE_DROP:
        subjectPrefix = "Fiyat Düştü";
        title = "Fiyat Düştü";
        break;
      case NotificationEventType.ALERT_MATCHED:
        subjectPrefix = "Fiyat Alarmı";
        title = "Fiyat Alarmınız Gerçekleşti";
        break;
      case NotificationEventType.NEW_OBSERVED_LOW:
        subjectPrefix = "Tarihi Dip Fiyat";
        title = "Yeni Tarihi Dip Fiyat";
        break;
      case NotificationEventType.DEAL_SCORE_THRESHOLD:
        subjectPrefix = "Fırsat Skoru Hedefi";
        title = "Fırsat Skoru Hedefine Ulaşıldı";
        break;
      case NotificationEventType.OWNED_GAME_DLC_DEAL:
        subjectPrefix = "DLC İndirimi";
        title = "Sahip Olduğunuz Oyuna DLC İndirimi Geldi";
        break;
      case NotificationEventType.WISHLIST_DEAL:
        subjectPrefix = "İstek Listesi İndirimi";
        title = "İstek Listenizdeki Oyun İndirime Girdi";
        break;
      case NotificationEventType.FAVORITE_PRICE_CHANGE:
        subjectPrefix = "Favori Oyun Güncellemesi";
        title = "Favori Oyununuzda Fiyat Değişimi";
        break;
    }

    const subject = `[Game Deals] ${subjectPrefix}: ${payload.gameTitle} (${payload.currentPrice} ${currency})`;

    const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 24px 12px; }
    .container { max-width: 580px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
    .header { padding: 24px; border-bottom: 1px solid #27272a; text-align: center; }
    .badge { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 6px; background-color: #064e3b; color: #34d399; margin-bottom: 8px; }
    .content { padding: 28px 24px; }
    .game-title { font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 12px 0; }
    .reason { font-size: 14px; color: #a1a1aa; margin-bottom: 20px; line-height: 1.5; }
    .price-card { background-color: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
    .price-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .price-label { font-size: 12px; color: #71717a; text-transform: uppercase; }
    .price-val { font-size: 22px; font-weight: 800; color: #10b981; }
    .old-price { font-size: 14px; text-decoration: line-through; color: #71717a; }
    .btn { display: block; text-align: center; background-color: #059669; color: #ffffff; font-weight: 700; font-size: 14px; padding: 14px 20px; border-radius: 10px; text-decoration: none; margin: 24px 0 12px 0; }
    .footer { padding: 20px 24px; border-top: 1px solid #27272a; text-align: center; font-size: 12px; color: #71717a; line-height: 1.6; }
    .footer a { color: #10b981; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">${escapeHtml(title)}</div>
      <div style="font-size: 12px; color: #71717a; font-weight: 600;">Game Deals • Türkiye Fiyat Takip Sistemi</div>
    </div>
    <div class="content">
      <h1 class="game-title">${escapeHtml(payload.gameTitle)}</h1>
      ${payload.matchReason ? `<div class="reason">${escapeHtml(payload.matchReason)}</div>` : ""}

      <div class="price-card">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="price-label">Güncel Fiyat</td>
            <td align="right" class="price-val">${payload.currentPrice} ${currency}</td>
          </tr>
          ${
            payload.listPrice && payload.listPrice > payload.currentPrice
              ? `<tr>
                  <td style="font-size: 12px; color: #71717a;">Liste Fiyatı</td>
                  <td align="right" class="old-price">${payload.listPrice} ${currency}</td>
                </tr>`
              : ""
          }
          ${
            payload.discountPercent
              ? `<tr>
                  <td style="font-size: 12px; color: #71717a;">İndirim</td>
                  <td align="right" style="font-size: 13px; font-weight: 700; color: #34d399;">%${payload.discountPercent}</td>
                </tr>`
              : ""
          }
          ${
            payload.dealScore !== undefined
              ? `<tr>
                  <td style="font-size: 12px; color: #71717a;">Fırsat Skoru</td>
                  <td align="right" style="font-size: 13px; font-weight: 700; color: #fbbf24;">${payload.dealScore}/100</td>
                </tr>`
              : ""
          }
        </table>
      </div>

      <a href="${gameUrl}" class="btn">Oyunu İncele & Fiyat Geçmişini Gör</a>
    </div>
    <div class="footer">
      Bu e-postayı <span style="color: #d4d4d8;">${escapeHtml(userEmail)}</span> adresiniz ile kayıtlı Game Deals hesabınızda bildirim talep ettiğiniz için aldınız.<br>
      Bildirim tercihlerinizi güncellemek veya e-posta gönderimini kapatmak için <a href="${settingsUrl}">Ayarlar</a> sayfasını ziyaret edebilirsiniz.
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
Game Deals - ${title}
----------------------------------------
Oyun: ${payload.gameTitle}
${payload.matchReason ? `Açıklama: ${payload.matchReason}\n` : ""}
Güncel Fiyat: ${payload.currentPrice} ${currency}
${payload.listPrice ? `Liste Fiyatı: ${payload.listPrice} ${currency}\n` : ""}${payload.discountPercent ? `İndirim Oranı: %${payload.discountPercent}\n` : ""}${payload.dealScore !== undefined ? `Fırsat Skoru: ${payload.dealScore}/100\n` : ""}
Oyunu İncele: ${gameUrl}

Bildirim tercihlerinizi yönetmek için: ${settingsUrl}
    `.trim();

    return { subject, html, text };
  }

  /**
   * Renders In-App Notification inbox format.
   */
  public static renderInApp(
    eventType: NotificationEventType,
    payload: NotificationPayload
  ): RenderedInAppNotification {
    const currency = payload.currency || "TL";
    let title = "Fiyat Güncellemesi";
    switch (eventType) {
      case NotificationEventType.PRICE_DROP:
        title = "Fiyat Düştü";
        break;
      case NotificationEventType.ALERT_MATCHED:
        title = "Fiyat Alarmı Gerçekleşti";
        break;
      case NotificationEventType.NEW_OBSERVED_LOW:
        title = "Tarihi Dip Fiyat";
        break;
      case NotificationEventType.DEAL_SCORE_THRESHOLD:
        title = "Fırsat Skoru Hedefi";
        break;
      case NotificationEventType.OWNED_GAME_DLC_DEAL:
        title = "DLC İndirimi";
        break;
      case NotificationEventType.WISHLIST_DEAL:
        title = "İstek Listesi İndirimi";
        break;
      case NotificationEventType.FAVORITE_PRICE_CHANGE:
        title = "Favori Oyun Fiyat Değişimi";
        break;
    }

    const body = `${payload.gameTitle} şu an ${payload.currentPrice} ${currency}.${
      payload.discountPercent ? ` (%${payload.discountPercent} indirim)` : ""
    }`;

    const linkUrl = payload.gameSlug ? `/oyun/${payload.gameSlug}` : "/";

    return { title, body, linkUrl };
  }
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
