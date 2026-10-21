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
  matchingEventTypes?: NotificationEventType[];
  badges?: string[];

}

export interface RenderedTelegramNotification {
  text: string;
  replyMarkup?: any;
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
  badges?: string[];

}

export interface TelegramMessageWithMarkup {
  text: string;
  replyMarkup?: any;
}

/**
 * Escapes characters for Telegram HTML parse mode safely.
 * Only &, <, > are special in Telegram HTML text.
 */
export function escapeTelegramHtml(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escapes characters for Telegram HTML attribute values (such as href).
 */
export function escapeTelegramHtmlAttr(text: string | null | undefined): string {
  if (!text) return "";
  return escapeTelegramHtml(text).replace(/"/g, "&quot;");
}

/**
 * Formats price with Turkish locale comma separation for clean Telegram messages.
 */
export function formatTelegramPrice(price: number | string | any, currency: string = "TL"): string {
  const num = typeof price === "number" ? price : parseFloat(String(price));
  if (!Number.isFinite(num)) return `0 ${currency}`;
  const formatted =
    num % 1 === 0
      ? num.toString()
      : num.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted} ${currency}`;
}

/**
 * Escapes characters for Telegram MarkdownV2 safely (retained for backward compatibility).
 */
export function escapeTelegramMarkdown(text: string): string {
  if (!text) return "";
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

function resolveAppUrl(override?: string): string {
  let url = "https://game.alperates.com.tr";
  if (override?.trim()) {
    url = override.trim().replace(/\/+$/, "");
  } else if (process.env.APP_URL?.trim()) {
    url = process.env.APP_URL.trim().replace(/\/+$/, "");
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * Renders standardized test message that exercises real HTML delivery format.
 */
export function renderTelegramTestMessage(appUrlOverride?: string): TelegramMessageWithMarkup {
  const appUrl = resolveAppUrl(appUrlOverride);
  const settingsUrl = `${appUrl}/ayarlar?tab=channels`;

  const lines = [
    "🎮 <b>Oyun Fırsat Test Bildirimi</b>",
    "",
    "Telegram bağlantınız başarıyla çalışıyor.",
    "",
    "💰 Fiyat: <b>199,90 TL</b>",
    "🏷️ Liste Fiyatı: <s>399,90 TL</s>",
    "🎯 İndirim: <b>%50</b>",
    "",
    "<i>Bu bir test bildirimidir. Fiyat alarmlarınız ve dip fırsatlarınız bu formatta iletilecektir.</i>",
    "",
    `👉 <a href="${escapeTelegramHtmlAttr(settingsUrl)}">Bildirim Ayarlarını Aç</a>`,
  ];

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: "⚙️ Bildirim Ayarlarını Aç",
            url: settingsUrl,
          },
        ],
      ],
    },
  };
}

/**
 * Renders confirmation message on successful account link (/start <token>).
 */
export function renderTelegramLinkSuccessMessage(appUrlOverride?: string): TelegramMessageWithMarkup {
  const appUrl = resolveAppUrl(appUrlOverride);
  const returnUrl = `${appUrl}/ayarlar?tab=channels&telegram=connected`;

  const lines = [
    "✅ <b>Telegram hesabınız bağlandı!</b>",
    "",
    "Oyun Fırsat bildirimleriniz artık bu sohbet üzerinden gönderilecek.",
    "",
    "Fiyat düşüşleri, alarm eşleşmeleri ve istek listenizdeki fırsatları buradan takip edebilirsiniz.",
  ];

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: "🌐 Siteye Dön",
            url: returnUrl,
          },
        ],
      ],
    },
  };
}

/**
 * Renders message for invalid or expired link token.
 */
export function renderTelegramInvalidTokenMessage(appUrlOverride?: string): TelegramMessageWithMarkup {
  const appUrl = resolveAppUrl(appUrlOverride);
  const settingsUrl = `${appUrl}/ayarlar?tab=channels`;

  const lines = [
    "❌ <b>Geçersiz veya Süresi Dolmuş Bağlantı</b>",
    "",
    `Lütfen Oyun Fırsat <a href="${escapeTelegramHtmlAttr(settingsUrl)}">Ayarlar</a> sayfasından yeni bir Telegram bağlantısı başlatın.`,
  ];

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: "⚙️ Ayarlar Sayfasına Git",
            url: settingsUrl,
          },
        ],
      ],
    },
  };
}

/**
 * Renders introductory help message when /start is sent without a token.
 */
export function renderTelegramHelpMessage(appUrlOverride?: string): TelegramMessageWithMarkup {
  const appUrl = resolveAppUrl(appUrlOverride);
  const settingsUrl = `${appUrl}/ayarlar?tab=channels`;

  const lines = [
    "👋 <b>Merhaba!</b>",
    "",
    `Oyun Fırsat bildirimlerini almak için web sitesindeki <a href="${escapeTelegramHtmlAttr(settingsUrl)}">Ayarlar</a> sayfasından hesabınızı bağlamanız gerekmektedir.`,
  ];

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: "⚙️ Hesabını Bağla",
            url: settingsUrl,
          },
        ],
      ],
    },
  };
}

/**
 * Renders confirmation message when user sends /stop.
 */
export function renderTelegramStopMessage(appUrlOverride?: string): TelegramMessageWithMarkup {
  const appUrl = resolveAppUrl(appUrlOverride);
  const settingsUrl = `${appUrl}/ayarlar?tab=channels`;

  const lines = [
    "🛑 <b>Bildirimler Durduruldu</b>",
    "",
    `Oyun Fırsat bildirimleriniz askıya alındı. Tekrar etkinleştirmek için web sitemizdeki <a href="${escapeTelegramHtmlAttr(settingsUrl)}">Ayarlar</a> sayfasını ziyaret edebilirsiniz.`,
  ];

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: "⚙️ Ayarları Yönet",
            url: settingsUrl,
          },
        ],
      ],
    },
  };
}

export class NotificationTemplateService {
  private static getAppUrl(): string {
    return resolveAppUrl();
  }

  /**
   * Renders Telegram message for a domain event using robust HTML formatting.
   */
  public static renderTelegram(
    eventType: NotificationEventType,
    payload: NotificationPayload
  ): RenderedTelegramNotification {
    const appUrl = this.getAppUrl();
    const safeSlug = payload.gameSlug ? encodeURIComponent(payload.gameSlug.trim()) : "";
    const gameUrl = safeSlug ? `${appUrl}/oyun/${safeSlug}` : appUrl;
    const currency = escapeTelegramHtml(payload.currency || "TL");

    const labels: Partial<Record<NotificationEventType, string>> = {
      PRICE_DROP: "Fiyat düştü",
      ALERT_MATCHED: "Fiyat alarmın gerçekleşti",
      NEW_OBSERVED_LOW: "Takip edilen en düşük fiyat",
      HISTORICAL_LOW_MATCH: "Takip edilen en düşük fiyatta",
      FREE_GAME_DEAL: "Ücretsiz oyun",
      DEEP_DISCOUNT_DEAL: "Büyük indirim",
      BUNDLE_DEAL: "Paket indirimi",
      DEAL_SCORE_THRESHOLD: "Yüksek fırsat puanı",
      OWNED_GAME_DLC_DEAL: "Oyununa ek içerik indirimi",
      WISHLIST_DEAL: "İstek listende indirim",
      FAVORITE_PRICE_CHANGE: "Favori oyununda fiyat değişimi",
    };
    // Bound variable prose before escaping to preserve entities and leave
    // room within Telegram's 1024-character photo caption limit.
    const compact = (value: string, limit: number) => {
      const normalized = value.replace(/\s+/g, " ").trim();
      return escapeTelegramHtml(normalized.length > limit ? normalized.slice(0, limit - 1) + "…" : normalized);
    };
    const price = Number(payload.currentPrice) === 0
      ? "Ücretsiz" : formatTelegramPrice(payload.currentPrice, currency);
    const prices = ["<b>" + price + "</b>"];
    if (payload.listPrice && payload.listPrice > payload.currentPrice) {
      prices.push("<s>" + formatTelegramPrice(payload.listPrice, currency) + "</s>");
    }
    if (payload.discountPercent && payload.discountPercent > 0) {
      prices.push("%" + payload.discountPercent + " indirim");
    }
    const contextTypes = [
      NotificationEventType.NEW_OBSERVED_LOW,
      NotificationEventType.HISTORICAL_LOW_MATCH,
      NotificationEventType.WISHLIST_DEAL,
      NotificationEventType.OWNED_GAME_DLC_DEAL,
    ];
    const secondaryType = contextTypes.find(type =>
      type !== eventType && payload.matchingEventTypes?.includes(type) &&
      !([NotificationEventType.NEW_OBSERVED_LOW, NotificationEventType.HISTORICAL_LOW_MATCH] as NotificationEventType[]).includes(eventType)
    );
    const subtitle = [labels[eventType] || "Oyun fırsatı", secondaryType ? labels[secondaryType] : null]
      .filter(Boolean).join(" · ");
    const lines = [
      "<b>" + compact(payload.gameTitle, 160) + "</b>",
      subtitle,
      "",
      prices.join("  ·  "),
    ];
    if (payload.dealScore !== undefined) {
      lines.push("Fırsat puanı: " + payload.dealScore + "/100");
    }
    if (payload.parentGameTitle) {
      lines.push("", "Ana oyun: " + compact(payload.parentGameTitle, 100));
    }
    // Generic reasons repeat prices; alarm reasons explain personal targets.
    if (eventType === NotificationEventType.ALERT_MATCHED && payload.matchReason) {
      lines.push("", compact(payload.matchReason, 200));
    }
    return {
      text: lines.join("\n"),
      replyMarkup: { inline_keyboard: [[{ text: "Oyunu İncele", url: gameUrl }]] },
    };
  }

  /**
   * Renders HTML and plain text email for a domain event.
   */
  public static renderEmail(
    eventType: NotificationEventType,
    payload: NotificationPayload,
    userEmail: string = "kullanici@oyunfirsatlari.com"
  ): RenderedEmailNotification {
    const appUrl = this.getAppUrl();
    const safeSlug = payload.gameSlug ? encodeURIComponent(payload.gameSlug.trim()) : "";
    const gameUrl = safeSlug ? `${appUrl}/oyun/${safeSlug}` : appUrl;
    const settingsUrl = `${appUrl}/ayarlar?tab=channels`;
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
      case NotificationEventType.HISTORICAL_LOW_MATCH:
        subjectPrefix = "Tarihi Dip Fiyat";
        title = "Tarihi Dip Fiyata Ulaşıldı";
        break;
      case NotificationEventType.FREE_GAME_DEAL:
        subjectPrefix = "Ücretsiz Fırsat";
        title = "Tamamen Ücretsiz / 0 TL Fırsatı";
        break;
      case NotificationEventType.DEEP_DISCOUNT_DEAL:
        subjectPrefix = "Mega İndirim";
        title = "Mega İndirim (%70 ve Üzeri)";
        break;
      case NotificationEventType.BUNDLE_DEAL:
        subjectPrefix = "Paket İndirimi";
        title = "Paket & Koleksiyon İndirimi";
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
        title = "Yeni Tarihi Dip Fiyat";
        break;
      case NotificationEventType.HISTORICAL_LOW_MATCH:
        title = "Tarihi Dip Fiyatta";
        break;
      case NotificationEventType.FREE_GAME_DEAL:
        title = "Ücretsiz / 0 TL Fırsatı";
        break;
      case NotificationEventType.DEEP_DISCOUNT_DEAL:
        title = "Mega İndirim (%70+)";
        break;
      case NotificationEventType.BUNDLE_DEAL:
        title = "Paket İndirimi";
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

    return { title, body, linkUrl, badges: payload.badges || [] };
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
