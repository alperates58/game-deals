import { describe, it, expect } from "vitest";
import { SETTINGS_TABS, SettingsTabId } from "@/components/settings/user-settings-center";
import { getTelegramConfigStatus } from "@/lib/notifications/telegram-provider";
import { getEmailConfigStatus } from "@/lib/notifications/email-provider";

describe("Mobile Navigation & Settings Center Contract", () => {
  describe("1. Mobile & Desktop Settings Tabs Specification", () => {
    it("should export exactly the 6 required setting tabs in expected order", () => {
      const tabIds: SettingsTabId[] = [
        "account",
        "security",
        "notifications",
        "channels",
        "quiet",
        "defaults",
      ];
      const tabLabels = [
        "Hesap",
        "Güvenlik",
        "Bildirimler",
        "Kanallar",
        "Sessiz Saatler",
        "Varsayılanlar",
      ];

      expect(SETTINGS_TABS.map((t) => t.id)).toEqual(tabIds);
      expect(SETTINGS_TABS.map((t) => t.label)).toEqual(tabLabels);
    });

    it("should provide full labels for desktop sidebar view", () => {
      expect(SETTINGS_TABS.find((t) => t.id === "account")?.fullLabel).toBe("Hesap Bilgileri");
      expect(SETTINGS_TABS.find((t) => t.id === "security")?.fullLabel).toBe("Giriş & Güvenlik");
      expect(SETTINGS_TABS.find((t) => t.id === "notifications")?.fullLabel).toBe("Bildirim Tercihleri");
      expect(SETTINGS_TABS.find((t) => t.id === "channels")?.fullLabel).toBe("Bildirim Kanalları");
      expect(SETTINGS_TABS.find((t) => t.id === "quiet")?.fullLabel).toBe("Sessiz Saatler");
      expect(SETTINGS_TABS.find((t) => t.id === "defaults")?.fullLabel).toBe("Varsayılanlar & Bölge");
    });
  });

  describe("2. Telegram Configuration Safety Contract", () => {
    it("should return configured: false and never leak secrets when env vars are missing or empty", () => {
      const origToken = process.env.TELEGRAM_BOT_TOKEN;
      const origUsername = process.env.TELEGRAM_BOT_USERNAME;
      const origSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

      try {
        delete process.env.TELEGRAM_BOT_TOKEN;
        delete process.env.TELEGRAM_BOT_USERNAME;
        delete process.env.TELEGRAM_WEBHOOK_SECRET;

        const status = getTelegramConfigStatus();
        expect(status.configured).toBe(false);
        expect(status.botUsername).toBeNull();
        expect((status as any).token).toBeUndefined();
        expect((status as any).secret).toBeUndefined();
      } finally {
        if (origToken) process.env.TELEGRAM_BOT_TOKEN = origToken;
        if (origUsername) process.env.TELEGRAM_BOT_USERNAME = origUsername;
        if (origSecret) process.env.TELEGRAM_WEBHOOK_SECRET = origSecret;
      }
    });

    it("should mark configured: true ONLY when token, username, and secret are all present", () => {
      const origToken = process.env.TELEGRAM_BOT_TOKEN;
      const origUsername = process.env.TELEGRAM_BOT_USERNAME;
      const origSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

      try {
        process.env.TELEGRAM_BOT_TOKEN = "test_bot_token_123456";
        process.env.TELEGRAM_BOT_USERNAME = "GameDealsTestBot";
        process.env.TELEGRAM_WEBHOOK_SECRET = "whsec_super_secret_test";

        const status = getTelegramConfigStatus();
        expect(status.configured).toBe(true);
        expect(status.botUsername).toBe("GameDealsTestBot");
        // Ensure no secret leak in response
        expect(JSON.stringify(status)).not.toContain("test_bot_token_123456");
        expect(JSON.stringify(status)).not.toContain("whsec_super_secret_test");
      } finally {
        if (origToken) process.env.TELEGRAM_BOT_TOKEN = origToken; else delete process.env.TELEGRAM_BOT_TOKEN;
        if (origUsername) process.env.TELEGRAM_BOT_USERNAME = origUsername; else delete process.env.TELEGRAM_BOT_USERNAME;
        if (origSecret) process.env.TELEGRAM_WEBHOOK_SECRET = origSecret; else delete process.env.TELEGRAM_WEBHOOK_SECRET;
      }
    });
  });

  describe("3. Email Configuration Safety Contract", () => {
    it("should return configured: false and never leak password when SMTP env vars are empty", () => {
      const status = getEmailConfigStatus();
      if (!process.env.SMTP_HOST) {
        expect(status.configured).toBe(false);
      }
      expect((status as any).password).toBeUndefined();
      expect(JSON.stringify(status)).not.toContain("password");
    });
  });
});
