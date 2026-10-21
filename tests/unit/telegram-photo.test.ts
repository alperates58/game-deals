import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTelegramMessage } from "@/lib/notifications/telegram-provider";
import { NotificationTemplateService } from "@/lib/notifications/template-service";
import { NotificationEventType } from "@prisma/client";

const replyMarkup = { inline_keyboard: [[{ text: "Oyunu İncele", url: "https://example.com/game" }]] };
const options = { photoUrl: "https://example.com/cover.jpg", replyMarkup };
const response = (status: number, description = "") => ({
  ok: status === 200, status,
  json: async () => ({ ok: status === 200, description, result: { message_id: 123 }, parameters: { retry_after: 30 } }),
});
afterEach(() => vi.unstubAllEnvs());

describe("Telegram photo delivery", () => {
  it("sends photo, HTML caption and button together", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test");
    const fetcher = vi.fn().mockResolvedValue(response(200));
    expect((await sendTelegramMessage("1", "<b>Oyun</b>", options, fetcher)).success).toBe(true);
    expect(fetcher.mock.calls[0][0]).toMatch(/\/sendPhoto$/);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      chat_id: "1", photo: options.photoUrl, caption: "<b>Oyun</b>", parse_mode: "HTML", reply_markup: replyMarkup,
    });
  });
  it("falls back to text with the same button on rejected media", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test");
    const fetcher = vi.fn().mockResolvedValueOnce(response(400, "Bad Request: failed to get HTTP URL content")).mockResolvedValueOnce(response(200));
    expect((await sendTelegramMessage("1", "Oyun", options, fetcher)).success).toBe(true);
    expect(fetcher.mock.calls[1][0]).toMatch(/\/sendMessage$/);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ text: "Oyun", reply_markup: replyMarkup });
  });
  it.each([429, 403, 500])("does not send fallback on HTTP %s", async status => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test");
    const fetcher = vi.fn().mockResolvedValue(response(status));
    const result = await sendTelegramMessage("1", "Oyun", options, fetcher);
    expect(result.success).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    if (status === 429) expect(result.retryAfterSeconds).toBe(30);
    if (status === 403) expect(result.isBlockedOrInactive).toBe(true);
  });
  it("uses text when the game has no image", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test");
    const fetcher = vi.fn().mockResolvedValue(response(200));
    await sendTelegramMessage("1", "Oyun", { replyMarkup }, fetcher);
    expect(fetcher.mock.calls[0][0]).toMatch(/\/sendMessage$/);
  });
  it("does not immediately resend after an ambiguous timeout", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test");
    const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    expect((await sendTelegramMessage("1", "Oyun", options, fetcher)).isTransient).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("retains alarm context and bounds long captions without broken HTML", () => {
    const result = NotificationTemplateService.renderTelegram(NotificationEventType.ALERT_MATCHED, {
      gameTitle: "<&".repeat(200), parentGameTitle: "DLC".repeat(200),
      currentPrice: 0, listPrice: 100, discountPercent: 100,
      matchReason: "Hedef fiyatınız gerçekleşti. ".repeat(100),
    });
    const visibleText = result.text.replace(/<[^>]*>/g, "").replace(/&lt;|&amp;/g, "x");
    expect(visibleText.length).toBeLessThan(1024);
    expect(result.text).toContain("<b>Ücretsiz</b>");
    expect(result.text).toContain("Hedef fiyatınız gerçekleşti.");
    expect(result.text).toContain("&lt;&amp;");
  });
});
