import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCanonicalWebhookUrl,
  classifyFetchError,
  checkTelegramConnectivity,
  getTelegramWebhookInfo,
  ensureTelegramWebhook,
  deleteTelegramWebhook,
} from "@/lib/notifications/telegram-webhook";

describe("Telegram Webhook Manager Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Canonical Webhook URL", () => {
    it("should construct canonical webhook URL using APP_URL", () => {
      process.env.APP_URL = "https://game.alperates.com.tr";
      expect(getCanonicalWebhookUrl()).toBe(
        "https://game.alperates.com.tr/api/integrations/telegram/webhook"
      );

      // Trailing slash stripping
      process.env.APP_URL = "https://game.alperates.com.tr/";
      expect(getCanonicalWebhookUrl()).toBe(
        "https://game.alperates.com.tr/api/integrations/telegram/webhook"
      );
    });

    it("should fallback to default domain if APP_URL is unset", () => {
      delete process.env.APP_URL;
      expect(getCanonicalWebhookUrl()).toBe(
        "https://game.alperates.com.tr/api/integrations/telegram/webhook"
      );
    });
  });

  describe("2. Network & Egress Error Classification", () => {
    it("should classify DNS resolution errors", () => {
      const err = new Error("getaddrinfo ENOTFOUND api.telegram.org");
      (err as any).code = "ENOTFOUND";
      const classified = classifyFetchError(err);
      expect(classified.status).toBe("DNS_ERROR");
    });

    it("should classify connection timeouts", () => {
      const err = new Error("The operation timed out");
      (err as any).code = "ETIMEDOUT";
      const classified = classifyFetchError(err);
      expect(classified.status).toBe("CONNECT_TIMEOUT");
    });

    it("should classify TLS / SSL certificate failures", () => {
      const err = new Error("certificate has expired");
      (err as any).code = "CERT_HAS_EXPIRED";
      const classified = classifyFetchError(err);
      expect(classified.status).toBe("TLS_ERROR");
    });

    it("should classify IPv6 routing failures", () => {
      const err = new Error("connect ENETUNREACH 2001:67c:4e8:f004::9");
      (err as any).code = "ENETUNREACH";
      const classified = classifyFetchError(err);
      expect(classified.status).toBe("IPV6_ROUTING");
    });

    it("should classify blocked egress port", () => {
      const err = new Error("connect ECONNREFUSED 149.154.166.110:443");
      (err as any).code = "ECONNREFUSED";
      const classified = classifyFetchError(err);
      expect(classified.status).toBe("EGRESS_BLOCKED");
    });
  });

  describe("3. Connectivity Diagnostics (checkTelegramConnectivity)", () => {
    it("should return OK on successful HTTP response without token", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const result = await checkTelegramConnectivity(mockFetch as any);

      expect(result.status).toBe("OK");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.telegram.org",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should return classified error when connectivity test fails", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 149.154.166.110:443"));
      const result = await checkTelegramConnectivity(mockFetch as any);

      expect(result.status).toBe("OTHER");
    });
  });

  describe("4. Truthful Webhook Status Verification (getTelegramWebhookInfo)", () => {
    it("should report NOT_CONFIGURED when token or secret is missing", async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_WEBHOOK_SECRET;

      const mockFetch = vi.fn();
      const info = await getTelegramWebhookInfo(mockFetch as any);

      expect(info.configured).toBe(false);
      expect(info.webhookStatus).toBe("NOT_CONFIGURED");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should report NOT_REGISTERED when registered url is empty in Telegram response", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";
      process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret-456";
      process.env.TELEGRAM_BOT_USERNAME = "oyunfirsat_bot";
      process.env.APP_URL = "https://game.alperates.com.tr";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            url: "",
            has_custom_certificate: false,
            pending_update_count: 0,
          },
        }),
      });

      const info = await getTelegramWebhookInfo(mockFetch as any);

      expect(info.configured).toBe(true);
      expect(info.webhookStatus).toBe("NOT_REGISTERED");
      expect(info.botUsername).toBe("oyunfirsat_bot");
      expect(info.pendingUpdateCount).toBe(0);
      expect(info.webhookUrl).toBeNull();
    });

    it("should report ACTIVE only when registered url matches canonical url", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";
      process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret-456";
      process.env.APP_URL = "https://game.alperates.com.tr";

      const canonical = "https://game.alperates.com.tr/api/integrations/telegram/webhook";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            url: canonical,
            has_custom_certificate: false,
            pending_update_count: 3,
            last_error_date: 1700000000,
            last_error_message: "Connection reset by peer",
          },
        }),
      });

      const info = await getTelegramWebhookInfo(mockFetch as any);

      expect(info.configured).toBe(true);
      expect(info.webhookStatus).toBe("ACTIVE");
      expect(info.webhookUrl).toBe(canonical);
      expect(info.pendingUpdateCount).toBe(3);
      expect(info.lastErrorMessage).toBe("Connection reset by peer");
      expect(info.lastErrorDate).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it("should report MISMATCH when registered url differs from canonical url", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";
      process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret-456";
      process.env.APP_URL = "https://game.alperates.com.tr";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            url: "https://legacy-domain.com/webhook",
            has_custom_certificate: false,
            pending_update_count: 0,
          },
        }),
      });

      const info = await getTelegramWebhookInfo(mockFetch as any);

      expect(info.webhookStatus).toBe("MISMATCH");
      expect(info.webhookUrl).toBe("https://legacy-domain.com/webhook");
    });

    it("should report ERROR and classify reason when Telegram API call fails", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";
      process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret-456";

      const dnsError = new Error("getaddrinfo ENOTFOUND api.telegram.org");
      (dnsError as any).code = "ENOTFOUND";

      const mockFetch = vi.fn().mockRejectedValue(dnsError);

      const info = await getTelegramWebhookInfo(mockFetch as any);

      expect(info.webhookStatus).toBe("ERROR");
      expect(info.connectivity?.status).toBe("DNS_ERROR");
      expect(info.lastErrorMessage).toContain("DNS tarafından çözümlenemedi");
    });
  });

  describe("5. Automated Webhook Setup (ensureTelegramWebhook)", () => {
    it("should call setWebhook with canonical URL and secret_token, then verify ACTIVE", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";
      process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret-456";
      process.env.APP_URL = "https://game.alperates.com.tr";

      const canonical = "https://game.alperates.com.tr/api/integrations/telegram/webhook";

      // Mock sequence: 1st call is setWebhook (POST), 2nd call is getWebhookInfo (GET)
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, result: true, description: "Webhook was set" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              url: canonical,
              pending_update_count: 0,
            },
          }),
        });

      const result = await ensureTelegramWebhook(mockFetch as any);

      expect(result.success).toBe(true);
      expect(result.status).toBe("ACTIVE");
      expect(result.webhookInfo.webhookStatus).toBe("ACTIVE");

      // Verify POST call payload
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "https://api.telegram.org/bottest-token-123/setWebhook",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            url: canonical,
            secret_token: "test-secret-456",
            allowed_updates: ["message"],
          }),
        })
      );
    });

    it("should fail gracefully if verification does not return ACTIVE", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";
      process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret-456";
      process.env.APP_URL = "https://game.alperates.com.tr";

      // Telegram said OK to setWebhook, but getWebhookInfo returned an empty or mismatched url
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, result: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              url: "https://other.com/api",
              pending_update_count: 0,
            },
          }),
        });

      const result = await ensureTelegramWebhook(mockFetch as any);

      expect(result.success).toBe(false);
      expect(result.status).toBe("MISMATCH");
      expect(result.error).toBe("Webhook kaydedildi ancak doğrulama ACTIVE durumu dönmedi.");
    });
  });

  describe("6. Webhook Deletion (deleteTelegramWebhook)", () => {
    it("should call deleteWebhook and verify NOT_REGISTERED", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "test-token-123";
      process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret-456";

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, result: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              url: "",
              pending_update_count: 0,
            },
          }),
        });

      const result = await deleteTelegramWebhook(mockFetch as any);

      expect(result.success).toBe(true);
      expect(result.status).toBe("NOT_REGISTERED");
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "https://api.telegram.org/bottest-token-123/deleteWebhook",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("7. Zero Secret Leakage Invariant", () => {
    it("should NEVER leak token or secret in returned objects", async () => {
      const secretToken = "super-secret-token-do-not-leak";
      const webhookSecret = "ultra-secret-webhook-key-do-not-leak";

      process.env.TELEGRAM_BOT_TOKEN = secretToken;
      process.env.TELEGRAM_WEBHOOK_SECRET = webhookSecret;
      process.env.APP_URL = "https://game.alperates.com.tr";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            url: "https://game.alperates.com.tr/api/integrations/telegram/webhook",
            pending_update_count: 0,
          },
        }),
      });

      const info = await getTelegramWebhookInfo(mockFetch as any);
      const jsonStr = JSON.stringify(info);

      expect(jsonStr).not.toContain(secretToken);
      expect(jsonStr).not.toContain(webhookSecret);
      expect((info as any).token).toBeUndefined();
      expect((info as any).secret).toBeUndefined();
    });
  });
});
