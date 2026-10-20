import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  escapeTelegramHtml,
  escapeTelegramHtmlAttr,
  formatTelegramPrice,
  renderTelegramTestMessage,
  renderTelegramLinkSuccessMessage,
  renderTelegramInvalidTokenMessage,
  renderTelegramHelpMessage,
  renderTelegramStopMessage,
  NotificationTemplateService,
} from "@/lib/notifications/template-service";
import { sendTelegramMessage } from "@/lib/notifications/telegram-provider";
import { NotificationEventType } from "@prisma/client";

describe("Telegram Delivery Hardening & HTML Formatting", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, APP_URL: "https://game.alperates.com.tr" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Telegram HTML Escaping (escapeTelegramHtml)", () => {
    it("should escape &, <, > accurately", () => {
      const input = "Tom & Jerry <Definitive Edition> (2026)";
      const output = escapeTelegramHtml(input);

      expect(output).toBe("Tom &amp; Jerry &lt;Definitive Edition&gt; (2026)");
    });

    it("should NOT alter MarkdownV2 reserved characters like !, ., -, _, *, (, )", () => {
      // In MarkdownV2, !, ., -, etc. cause Bad Request (HTTP 400).
      // In HTML, they are harmless and must remain literal.
      const input = "God of War! 199.90 TL - 50% (İndirimli!)";
      const output = escapeTelegramHtml(input);

      expect(output).toBe("God of War! 199.90 TL - 50% (İndirimli!)");
      expect(output).not.toContain("\\!");
      expect(output).not.toContain("\\.");
      expect(output).not.toContain("\\-");
    });

    it("should preserve Turkish characters accurately", () => {
      const turkishInput = "Şampiyonlar Ligi: İndirim Fırsatı! Çok İyi Fiyat";
      const output = escapeTelegramHtml(turkishInput);

      expect(output).toBe("Şampiyonlar Ligi: İndirim Fırsatı! Çok İyi Fiyat");
    });

    it("should handle null, undefined and empty strings safely", () => {
      expect(escapeTelegramHtml(null)).toBe("");
      expect(escapeTelegramHtml(undefined)).toBe("");
      expect(escapeTelegramHtml("")).toBe("");
    });

    it("should escape quotes in attributes via escapeTelegramHtmlAttr", () => {
      const attr = 'https://game.alperates.com.tr/oyun/test?title="special"&ref=bot';
      const output = escapeTelegramHtmlAttr(attr);

      expect(output).toContain("&quot;special&quot;");
      expect(output).toContain("&amp;ref=bot");
    });
  });

  describe("2. Turkish Price Formatting (formatTelegramPrice)", () => {
    it("should format decimal prices with comma separator", () => {
      expect(formatTelegramPrice(199.9, "TL")).toBe("199,90 TL");
      expect(formatTelegramPrice(399.95, "TL")).toBe("399,95 TL");
    });

    it("should format whole integer prices cleanly", () => {
      expect(formatTelegramPrice(200, "TL")).toBe("200 TL");
      expect(formatTelegramPrice(0, "TL")).toBe("0 TL");
    });
  });

  describe("3. Domain Event Notification HTML Rendering", () => {
    it("should render PRICE_DROP event with HTML tags and safe entities", () => {
      const payload = {
        gameTitle: "Half-Life: Alyx & DLC <VR Exclusive>!",
        gameSlug: "half-life-alyx",
        currentPrice: 199.9,
        listPrice: 399.9,
        discountPercent: 50,
        dealScore: 92,
        matchReason: "Tarihi dip seviyesine %20 daha yakın!",
        currency: "TL",
      };

      const rendered = NotificationTemplateService.renderTelegram(
        NotificationEventType.PRICE_DROP,
        payload
      );

      // Verify HTML tags
      expect(rendered.text).toContain("📉 <b>Fiyat Düştü!</b>");
      expect(rendered.text).toContain("🎮 <b>Half-Life: Alyx &amp; DLC &lt;VR Exclusive&gt;!</b>");
      expect(rendered.text).toContain("💡 Tarihi dip seviyesine %20 daha yakın!");
      expect(rendered.text).toContain("💰 Güncel Fiyat: <b>199,90 TL</b>");
      expect(rendered.text).toContain("🏷️ Liste Fiyatı: <s>399,90 TL</s>");
      expect(rendered.text).toContain("🎯 İndirim Oranı: <b>%50</b>");
      expect(rendered.text).toContain("⚡ Fırsat Skoru: <b>92/100</b>");
      expect(rendered.text).toContain(
        '<a href="https://game.alperates.com.tr/oyun/half-life-alyx">Oyunu İncele</a>'
      );
      expect(rendered.text).toContain(
        '<a href="https://game.alperates.com.tr/ayarlar?tab=channels">Bildirim Ayarları</a>'
      );

      // Ensure NO MarkdownV2 backslash escapes were introduced
      expect(rendered.text).not.toContain("\\!");
      expect(rendered.text).not.toContain("\\.");
    });
  });

  describe("4. Centralized Telegram Messages", () => {
    it("should render test message with real HTML delivery format", () => {
      const testMsg = renderTelegramTestMessage("https://game.alperates.com.tr");

      expect(testMsg.text).toContain("🎮 <b>Oyun Fırsat Test Bildirimi</b>");
      expect(testMsg.text).toContain("Telegram bağlantınız başarıyla çalışıyor.");
      expect(testMsg.text).toContain("💰 Fiyat: <b>199,90 TL</b>");
      expect(testMsg.text).toContain("🏷️ Liste Fiyatı: <s>399,90 TL</s>");
      expect(testMsg.text).toContain("🎯 İndirim: <b>%50</b>");
      expect(testMsg.text).toContain(
        '<a href="https://game.alperates.com.tr/ayarlar?tab=channels">Bildirim Ayarlarını Aç</a>'
      );
      expect(testMsg.replyMarkup?.inline_keyboard).toEqual([
        [
          {
            text: "⚙️ Bildirim Ayarlarını Aç",
            url: "https://game.alperates.com.tr/ayarlar?tab=channels",
          },
        ],
      ]);
    });

    it("should render link success message with inline return-to-site keyboard", () => {
      const successMsg = renderTelegramLinkSuccessMessage("https://game.alperates.com.tr");

      expect(successMsg.text).toContain("✅ <b>Telegram hesabınız bağlandı!</b>");
      expect(successMsg.text).toContain("Oyun Fırsat bildirimleriniz artık bu sohbet üzerinden gönderilecek.");
      expect(successMsg.replyMarkup?.inline_keyboard).toEqual([
        [
          {
            text: "🌐 Siteye Dön",
            url: "https://game.alperates.com.tr/ayarlar?tab=channels&telegram=connected",
          },
        ],
      ]);
    });

    it("should render invalid token message with settings link", () => {
      const invalidMsg = renderTelegramInvalidTokenMessage("https://game.alperates.com.tr");

      expect(invalidMsg.text).toContain("❌ <b>Geçersiz veya Süresi Dolmuş Bağlantı</b>");
      expect(invalidMsg.text).toContain(
        '<a href="https://game.alperates.com.tr/ayarlar?tab=channels">Ayarlar</a>'
      );
      expect(invalidMsg.replyMarkup?.inline_keyboard[0][0].url).toBe(
        "https://game.alperates.com.tr/ayarlar?tab=channels"
      );
    });

    it("should render help message when /start without token", () => {
      const helpMsg = renderTelegramHelpMessage("https://game.alperates.com.tr");

      expect(helpMsg.text).toContain("👋 <b>Merhaba!</b>");
      expect(helpMsg.replyMarkup?.inline_keyboard[0][0].text).toBe("⚙️ Hesabını Bağla");
    });

    it("should render stop message on /stop", () => {
      const stopMsg = renderTelegramStopMessage("https://game.alperates.com.tr");

      expect(stopMsg.text).toContain("🛑 <b>Bildirimler Durduruldu</b>");
      expect(stopMsg.replyMarkup?.inline_keyboard[0][0].text).toBe("⚙️ Ayarları Yönet");
    });
  });

  describe("5. Telegram Provider HTML Payload Guarantee", () => {
    it("should default parse_mode to HTML in Bot API sendMessage payload", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";

      let capturedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 999 } }),
        };
      });

      const result = await sendTelegramMessage(
        "12345678",
        "<b>Test Mesajı</b>",
        mockFetch as any
      );

      expect(result.success).toBe(true);
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.chat_id).toBe("12345678");
      expect(capturedPayload.text).toBe("<b>Test Mesajı</b>");
      expect(capturedPayload.parse_mode).toBe("HTML");
    });

    it("should forward inline keyboard reply_markup in payload", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";

      let capturedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 1000 } }),
        };
      });

      const markup = {
        inline_keyboard: [[{ text: "Siteye Git", url: "https://game.alperates.com.tr" }]],
      };

      const result = await sendTelegramMessage(
        "12345678",
        "Mesaj",
        { replyMarkup: markup },
        mockFetch as any
      );

      expect(result.success).toBe(true);
      expect(capturedPayload.reply_markup).toEqual(markup);
      expect(capturedPayload.parse_mode).toBe("HTML");
    });

    it("should include modern link_preview_options in payload alongside disable_web_page_preview", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";

      let capturedPayload: any = null;
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 1001 } }),
        };
      });

      await sendTelegramMessage(
        "12345678",
        "Mesaj",
        { disableWebPagePreview: true },
        mockFetch as any
      );

      expect(capturedPayload.disable_web_page_preview).toBe(true);
      expect(capturedPayload.link_preview_options).toEqual({ is_disabled: true });
    });

    it("should automatically fallback to plain text if Telegram rejects HTML with can't parse entities", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";

      const payloads: any[] = [];
      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        const body = JSON.parse(init.body);
        payloads.push(body);

        if (payloads.length === 1) {
          // 1st attempt: Telegram rejects HTML
          return {
            ok: false,
            status: 400,
            json: async () => ({
              ok: false,
              error_code: 400,
              description: "Bad Request: can't parse entities: Character '<' is reserved",
            }),
          };
        }

        // 2nd attempt (fallback): Plain text succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 1002 } }),
        };
      });

      const result = await sendTelegramMessage(
        "12345678",
        "<b>Corrupted <Tag> Test</b>",
        mockFetch as any
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("1002");
      expect(payloads).toHaveLength(2);
      expect(payloads[0].parse_mode).toBe("HTML");
      expect(payloads[1].parse_mode).toBeUndefined();
      expect(payloads[1].text).not.toContain("<b>");
      expect(payloads[1].text).not.toContain("</b>");
    });
  });

  describe("6. Resilient Price and URL Formatting", () => {
    it("should parse string or decimal prices cleanly in formatTelegramPrice", () => {
      expect(formatTelegramPrice("199.9" as any, "TL")).toBe("199,90 TL");
      expect(formatTelegramPrice("350" as any, "TL")).toBe("350 TL");
      expect(formatTelegramPrice(undefined as any, "TL")).toBe("0 TL");
    });

    it("should encode game slugs in renderTelegram to protect URL entities", () => {
      const rendered = NotificationTemplateService.renderTelegram(
        NotificationEventType.PRICE_DROP,
        {
          gameTitle: "Özel Oyun (2026)",
          gameSlug: "ozel oyun 2026",
          currentPrice: 100,
        }
      );

      expect(rendered.text).toContain("ozel%20oyun%202026");
    });
  });
});
