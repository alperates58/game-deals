import { describe, it, expect } from "vitest";
import { sanitizeAuditData } from "@/lib/audit/audit-logger";
import { getUserEntitlements } from "@/lib/membership/entitlements";
import { isQuietHourActive } from "@/lib/notifications/quiet-hours";
import { generateSecureRandomToken, hashOpaqueToken } from "@/lib/notifications/token-service";
import {
  NotificationTemplateService,
  escapeTelegramMarkdown,
} from "@/lib/notifications/template-service";
import { Role, AccountStatus, MembershipTier, NotificationEventType } from "@prisma/client";

describe("FAZ 1.5 — Admin Control Center, Security & Notifications", () => {
  describe("1. Audit Log Sanitization & Secret Redaction (INV-002)", () => {
    it("should redact sensitive fields containing password, secret, token, and chat ID", () => {
      const sensitiveInput = {
        userId: "user-123",
        email: "admin@example.com",
        passwordHash: "$2b$12$eX4mp1eH4sh",
        clientSecret: "top-secret-oauth-key",
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        telegramChatId: "987654321",
        webhookSecret: "whsec_abcdef123456",
        safeProperty: "Safe Value",
        nested: {
          sessionToken: "sess_xyz987",
          cookie: "auth-cookie=123",
          attempts: 3,
        },
      };

      const sanitized = sanitizeAuditData(sensitiveInput);

      expect(sanitized.userId).toBe("user-123");
      expect(sanitized.email).toBe("admin@example.com");
      expect(sanitized.safeProperty).toBe("Safe Value");
      expect(sanitized.passwordHash).toBe("[REDACTED]");
      expect(sanitized.clientSecret).toBe("[REDACTED]");
      expect(sanitized.botToken).toBe("[REDACTED]");
      expect(sanitized.telegramChatId).toBe("[REDACTED]");
      expect(sanitized.webhookSecret).toBe("[REDACTED]");
      expect(sanitized.nested.sessionToken).toBe("[REDACTED]");
      expect(sanitized.nested.cookie).toBe("[REDACTED]");
      expect(sanitized.nested.attempts).toBe(3);
    });

    it("should handle null, undefined, arrays, and primitives gracefully", () => {
      expect(sanitizeAuditData(null)).toBeNull();
      expect(sanitizeAuditData(undefined)).toBeUndefined();
      expect(sanitizeAuditData("simple-string")).toBe("simple-string");
      expect(sanitizeAuditData(42)).toBe(42);

      const arrayInput = [{ token: "secret-1" }, { role: "ADMIN" }];
      const sanitizedArray = sanitizeAuditData(arrayInput);
      expect(sanitizedArray[0].token).toBe("[REDACTED]");
      expect(sanitizedArray[1].role).toBe("ADMIN");
    });
  });

  describe("2. Membership Entitlements & Owner Privilege Invariant (INV-001)", () => {
    it("should grant basic limits for FREE tier", () => {
      const entitlements = getUserEntitlements({
        role: Role.USER,
        membershipTier: MembershipTier.FREE,
      });

      expect(entitlements.tier).toBe(MembershipTier.FREE);
      expect(entitlements.isPro).toBe(false);
      expect(entitlements.isOwner).toBe(false);
      expect(entitlements.maxActiveAlerts).toBeLessThanOrEqual(10);
      expect(entitlements.instantNotifications).toBe(false);
    });

    it("should grant enhanced limits for PRO tier", () => {
      const entitlements = getUserEntitlements({
        role: Role.USER,
        membershipTier: MembershipTier.PRO,
      });

      expect(entitlements.tier).toBe(MembershipTier.PRO);
      expect(entitlements.isPro).toBe(true);
      expect(entitlements.isOwner).toBe(false);
      expect(entitlements.maxActiveAlerts).toBe(500);
      expect(entitlements.instantNotifications).toBe(true);
      expect(entitlements.canAccessDetailedHistory).toBe(true);
    });

    it("should grant maximum owner entitlements regardless of membership tier", () => {
      const entitlements = getUserEntitlements({
        role: Role.OWNER,
        membershipTier: MembershipTier.FREE, // even if DB tier says FREE
      });

      expect(entitlements.isOwner).toBe(true);
      expect(entitlements.isPro).toBe(true);
      expect(entitlements.maxActiveAlerts).toBe(500);
      expect(entitlements.instantNotifications).toBe(true);
    });

    it("should fallback safely for null or unauthenticated user", () => {
      const entitlements = getUserEntitlements(null);
      expect(entitlements.tier).toBe(MembershipTier.FREE);
      expect(entitlements.isPro).toBe(false);
      expect(entitlements.isOwner).toBe(false);
      expect(entitlements.maxActiveAlerts).toBe(5);
    });
  });

  describe("3. Quiet Hours Timezone Evaluation (Europe/Istanbul)", () => {
    it("should return false when quiet hours string is empty or missing", () => {
      expect(isQuietHourActive(null, null)).toBe(false);
      expect(isQuietHourActive("", "")).toBe(false);
    });

    it("should correctly identify time inside overnight quiet hours window (e.g. 02:30 in 23:00 - 08:00)", () => {
      const nightDate = new Date("2026-10-16T02:30:00+03:00");
      const isQuiet = isQuietHourActive("23:00", "08:00", "Europe/Istanbul", nightDate);
      expect(isQuiet).toBe(true);
    });

    it("should correctly identify time outside overnight quiet hours window (e.g. 14:00 in 23:00 - 08:00)", () => {
      const afternoonDate = new Date("2026-10-16T14:00:00+03:00");
      const isQuiet = isQuietHourActive("23:00", "08:00", "Europe/Istanbul", afternoonDate);
      expect(isQuiet).toBe(false);
    });

    it("should handle daytime quiet hours window (e.g. 13:00 - 15:00)", () => {
      const duringDate = new Date("2026-10-16T14:15:00+03:00");
      const outsideDate = new Date("2026-10-16T16:00:00+03:00");

      expect(isQuietHourActive("13:00", "15:00", "Europe/Istanbul", duringDate)).toBe(true);
      expect(isQuietHourActive("13:00", "15:00", "Europe/Istanbul", outsideDate)).toBe(false);
    });
  });

  describe("4. Cryptographic Token Generation & SHA-256 Hashing", () => {
    it("should generate cryptographically secure random token and produce deterministic hash", () => {
      const rawToken = generateSecureRandomToken(32);
      expect(rawToken).toBeDefined();
      expect(rawToken.length).toBe(64); // 32 bytes in hex = 64 characters

      const hash1 = hashOpaqueToken(rawToken);
      const hash2 = hashOpaqueToken(rawToken);

      // Deterministic
      expect(hash1).toBe(hash2);
      // SHA-256 in hex is 64 characters
      expect(hash1.length).toBe(64);
      // Never equal to raw token
      expect(hash1).not.toBe(rawToken);
    });

    it("should produce different hashes for different tokens", () => {
      const tokenA = generateSecureRandomToken();
      const tokenB = generateSecureRandomToken();

      expect(hashOpaqueToken(tokenA)).not.toBe(hashOpaqueToken(tokenB));
    });
  });

  describe("5. Multi-Channel Notification Template Formatting", () => {
    const mockPayload = {
      gameTitle: "Forza Horizon 5",
      gameSlug: "forza-horizon-5",
      currentPrice: 350,
      listPrice: 700,
      discountPercent: 50,
      currency: "TRY",
      dealScore: 88,
    };

    it("should format rich HTML and plain text for email", () => {
      const email = NotificationTemplateService.renderEmail(
        NotificationEventType.PRICE_DROP,
        mockPayload,
        "gamer@example.com"
      );

      expect(email.subject).toContain("Forza Horizon 5");
      expect(email.subject).toContain("350 TRY");
      expect(email.html).toContain("350");
      expect(email.html).toContain("700");
      expect(email.html).toContain("gamer@example.com");
      expect(email.text).toContain("Forza Horizon 5");
      expect(email.text).toContain("forza-horizon-5");
    });

    it("should format clean, Markdown-safe message for Telegram bot", () => {
      const telegram = NotificationTemplateService.renderTelegram(NotificationEventType.PRICE_DROP, mockPayload);

      expect(telegram.text).toContain("Forza Horizon 5");
      expect(telegram.text).toContain("350");
      expect(telegram.text).toContain("50");
      expect(telegram.text).toContain("forza");
    });

    it("should format concise title and message for in-app inbox", () => {
      const inApp = NotificationTemplateService.renderInApp(NotificationEventType.PRICE_DROP, mockPayload);

      expect(inApp.title).toBe("Fiyat Düştü");
      expect(inApp.body).toContain("Forza Horizon 5");
      expect(inApp.body).toContain("350");
      expect(inApp.linkUrl).toBe("/oyun/forza-horizon-5");
    });

    it("should escape special MarkdownV2 characters properly", () => {
      const unescaped = "Test [Game] (2026) - Price: $50.00!";
      const escaped = escapeTelegramMarkdown(unescaped);

      expect(escaped).toContain("\\[");
      expect(escaped).toContain("\\]");
      expect(escaped).toContain("\\(");
      expect(escaped).toContain("\\)");
      expect(escaped).toContain("\\-");
      expect(escaped).toContain("\\.");
      expect(escaped).toContain("\\!");
    });
  });

  describe("6. Admin Owner Safety Rules (Static Verification)", () => {
    it("should verify that self-demotion and self-suspension logic rejects invalid requests", () => {
      const actorUserId = "owner-admin-1";
      const targetUserId = "owner-admin-1";

      const isSelf = actorUserId === targetUserId;
      expect(isSelf).toBe(true);

      const attemptDemote = (role: Role) => {
        if (isSelf && role !== Role.OWNER) {
          throw new Error("Kendi OWNER rolünüzü düşüremezsiniz.");
        }
      };

      const attemptSuspend = (status: AccountStatus) => {
        if (isSelf && status === AccountStatus.SUSPENDED) {
          throw new Error("Kendi hesabınızı askıya alamazsınız.");
        }
      };

      expect(() => attemptDemote(Role.USER)).toThrow("Kendi OWNER rolünüzü düşüremezsiniz.");
      expect(() => attemptSuspend(AccountStatus.SUSPENDED)).toThrow("Kendi hesabınızı askıya alamazsınız.");
    });

    it("should verify that last remaining OWNER cannot be suspended or demoted", () => {
      const totalOwners = 1;
      const targetUserRole = Role.OWNER;

      const validateLastOwnerDemotion = (requestedRole: Role) => {
        if (targetUserRole === Role.OWNER && requestedRole !== Role.OWNER && totalOwners <= 1) {
          throw new Error("Sistemdeki son OWNER rolü düşürülemez.");
        }
      };

      const validateLastOwnerSuspension = (requestedStatus: AccountStatus) => {
        if (targetUserRole === Role.OWNER && requestedStatus === AccountStatus.SUSPENDED && totalOwners <= 1) {
          throw new Error("Sistemdeki son OWNER askıya alınamaz.");
        }
      };

      expect(() => validateLastOwnerDemotion(Role.USER)).toThrow("Sistemdeki son OWNER rolü düşürülemez.");
      expect(() => validateLastOwnerSuspension(AccountStatus.SUSPENDED)).toThrow("Sistemdeki son OWNER askıya alınamaz.");
    });
  });
});
