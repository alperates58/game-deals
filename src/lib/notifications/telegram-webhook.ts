/**
 * Telegram Webhook Manager Service
 *
 * Centralized service to manage Telegram Bot API Webhook registration,
 * status verification, and removal.
 *
 * Adheres strictly to ALPER DESIGN OS Truthful UI principles:
 * - Never claims ACTIVE status without verifying getWebhookInfo against Telegram.
 * - Never exposes or logs TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET.
 * - Categorizes network/egress failure causes deterministically.
 */

export type TelegramWebhookStatus =
  | "NOT_CONFIGURED"
  | "NOT_REGISTERED"
  | "ACTIVE"
  | "MISMATCH"
  | "ERROR";

export type TelegramConnectivityCause =
  | "OK"
  | "DNS_ERROR"
  | "CONNECT_TIMEOUT"
  | "TLS_ERROR"
  | "IPV6_ROUTING"
  | "EGRESS_BLOCKED"
  | "OTHER";

export interface TelegramWebhookInfoResult {
  configured: boolean;
  botUsername: string | null;
  webhookStatus: TelegramWebhookStatus;
  canonicalUrl: string;
  webhookUrl: string | null;
  pendingUpdateCount: number;
  lastErrorDate: string | null;
  lastErrorMessage: string | null;
  ipAddress?: string | null;
  hasCustomCertificate?: boolean;
  maxConnections?: number;
  allowedUpdates?: string[];
  connectivity?: {
    status: TelegramConnectivityCause;
    details: string;
  };
  error?: string;
}

export interface SetWebhookResult {
  success: boolean;
  status: TelegramWebhookStatus;
  webhookInfo: TelegramWebhookInfoResult;
  error?: string;
}

/**
 * Returns canonical production webhook URL for Telegram.
 * Guaranteed to match: ${APP_URL}/api/integrations/telegram/webhook
 */
export function getCanonicalWebhookUrl(): string {
  const rawUrl = process.env.APP_URL?.trim();
  const baseUrl = rawUrl ? rawUrl.replace(/\/+$/, "") : "https://game.alperates.com.tr";
  return `${baseUrl}/api/integrations/telegram/webhook`;
}

/**
 * Deterministically classifies fetch/network errors into structured failure causes.
 * Never logs or prints sensitive data.
 */
export function classifyFetchError(err: any): { status: TelegramConnectivityCause; details: string } {
  const msg = err?.message || "";
  const code = err?.cause?.code || err?.code || "";
  const errString = `${err?.name} ${msg} ${code}`.toLowerCase();

  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || errString.includes("getaddrinfo")) {
    return {
      status: "DNS_ERROR",
      details: "api.telegram.org domain adı DNS tarafından çözümlenemedi (ENOTFOUND/EAI_AGAIN).",
    };
  }
  if (code === "ETIMEDOUT" || errString.includes("timeout") || errString.includes("aborterror")) {
    return {
      status: "CONNECT_TIMEOUT",
      details: "Telegram API sunucularına bağlantı zaman aşımına uğradı (ETIMEDOUT / Timeout).",
    };
  }
  if (
    code === "CERT_HAS_EXPIRED" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    errString.includes("tls") ||
    errString.includes("certificate")
  ) {
    return {
      status: "TLS_ERROR",
      details: "TLS/SSL sertifika doğrulaması başarısız oldu (TLS_ERROR).",
    };
  }
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH" || errString.includes("network is unreachable")) {
    return {
      status: "IPV6_ROUTING",
      details: "Ağ yolu bulunamadı; muhtemelen IPv6 yönlendirme hatası (IPV6_ROUTING / ENETUNREACH).",
    };
  }
  if (code === "ECONNREFUSED" || errString.includes("connection refused")) {
    return {
      status: "EGRESS_BLOCKED",
      details: "Dışarıya (egress) 443 portu erişimi engellendi veya reddedildi (EGRESS_BLOCKED / ECONNREFUSED).",
    };
  }

  return {
    status: "OTHER",
    details: `Telegram bağlantı hatası: ${msg || "Bilinmeyen ağ hatası"}`,
  };
}

/**
 * Checks outbound connectivity to Telegram API without requiring bot token.
 */
export async function checkTelegramConnectivity(
  fetchFn: typeof fetch = fetch
): Promise<{ status: TelegramConnectivityCause; details: string; latencyMs?: number }> {
  const start = Date.now();
  try {
    const res = await fetchFn("https://api.telegram.org", {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    return {
      status: "OK",
      details: `Telegram API sunucusuna erişim başarılı (HTTP ${res.status}).`,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return classifyFetchError(err);
  }
}

/**
 * Queries Telegram Bot API getWebhookInfo to retrieve current real registration state.
 * Never leaks token or secret.
 */
export async function getTelegramWebhookInfo(
  fetchFn: typeof fetch = fetch
): Promise<TelegramWebhookInfoResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim() || null;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
  const canonicalUrl = getCanonicalWebhookUrl();

  if (!token || !secret) {
    return {
      configured: false,
      botUsername: username,
      webhookStatus: "NOT_CONFIGURED",
      canonicalUrl,
      webhookUrl: null,
      pendingUpdateCount: 0,
      lastErrorDate: null,
      lastErrorMessage: null,
    };
  }

  const endpoint = `https://api.telegram.org/bot${token}/getWebhookInfo`;

  try {
    const response = await fetchFn(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok || !data?.result) {
      const description = data?.description || `HTTP ${response.status} from Telegram Bot API`;
      return {
        configured: true,
        botUsername: username,
        webhookStatus: "ERROR",
        canonicalUrl,
        webhookUrl: null,
        pendingUpdateCount: 0,
        lastErrorDate: null,
        lastErrorMessage: description,
        error: description,
      };
    }

    const result = data.result;
    const registeredUrl = result.url ? String(result.url).trim() : null;

    let webhookStatus: TelegramWebhookStatus = "NOT_REGISTERED";

    if (!registeredUrl) {
      webhookStatus = "NOT_REGISTERED";
    } else if (registeredUrl === canonicalUrl) {
      webhookStatus = "ACTIVE";
    } else {
      webhookStatus = "MISMATCH";
    }

    const lastErrorDateIso = result.last_error_date
      ? new Date(result.last_error_date * 1000).toISOString()
      : null;

    return {
      configured: true,
      botUsername: username,
      webhookStatus,
      canonicalUrl,
      webhookUrl: registeredUrl,
      pendingUpdateCount: Number(result.pending_update_count) || 0,
      lastErrorDate: lastErrorDateIso,
      lastErrorMessage: result.last_error_message || null,
      ipAddress: result.ip_address || null,
      hasCustomCertificate: Boolean(result.has_custom_certificate),
      maxConnections: result.max_connections,
      allowedUpdates: result.allowed_updates,
      connectivity: {
        status: "OK",
        details: "Telegram getWebhookInfo çağrısı başarılı.",
      },
    };
  } catch (err: any) {
    const connectivity = classifyFetchError(err);
    return {
      configured: true,
      botUsername: username,
      webhookStatus: "ERROR",
      canonicalUrl,
      webhookUrl: null,
      pendingUpdateCount: 0,
      lastErrorDate: null,
      lastErrorMessage: connectivity.details,
      connectivity,
      error: `Telegram Bot API çağrısı başarısız: ${connectivity.status}`,
    };
  }
}

/**
 * Registers or updates the Telegram webhook to point to the canonical URL.
 * Immediately verifies the registration with getWebhookInfo to avoid fake success.
 */
export async function ensureTelegramWebhook(
  fetchFn: typeof fetch = fetch
): Promise<SetWebhookResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim() || null;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
  const canonicalUrl = getCanonicalWebhookUrl();

  if (!token || !secret) {
    const info = await getTelegramWebhookInfo(fetchFn);
    return {
      success: false,
      status: "NOT_CONFIGURED",
      webhookInfo: info,
      error: "TELEGRAM_BOT_TOKEN veya TELEGRAM_WEBHOOK_SECRET tanımlanmamış.",
    };
  }

  const endpoint = `https://api.telegram.org/bot${token}/setWebhook`;

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: canonicalUrl,
        secret_token: secret,
        allowed_updates: ["message"],
      }),
      signal: AbortSignal.timeout(12000),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      const description = data?.description || `HTTP ${response.status} from Telegram setWebhook`;
      const currentInfo = await getTelegramWebhookInfo(fetchFn);
      return {
        success: false,
        status: "ERROR",
        webhookInfo: currentInfo,
        error: description,
      };
    }

    // Verify registration truthfully
    const verifiedInfo = await getTelegramWebhookInfo(fetchFn);

    const isSuccess = verifiedInfo.webhookStatus === "ACTIVE";

    return {
      success: isSuccess,
      status: verifiedInfo.webhookStatus,
      webhookInfo: verifiedInfo,
      error: isSuccess ? undefined : "Webhook kaydedildi ancak doğrulama ACTIVE durumu dönmedi.",
    };
  } catch (err: any) {
    const connectivity = classifyFetchError(err);
    const verifiedInfo = await getTelegramWebhookInfo(fetchFn);
    return {
      success: false,
      status: "ERROR",
      webhookInfo: verifiedInfo,
      error: connectivity.details,
    };
  }
}

/**
 * Removes the Telegram webhook from Telegram Bot API.
 * Immediately verifies the removal.
 */
export async function deleteTelegramWebhook(
  fetchFn: typeof fetch = fetch
): Promise<SetWebhookResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;

  if (!token || !secret) {
    const info = await getTelegramWebhookInfo(fetchFn);
    return {
      success: false,
      status: "NOT_CONFIGURED",
      webhookInfo: info,
      error: "TELEGRAM_BOT_TOKEN veya TELEGRAM_WEBHOOK_SECRET tanımlanmamış.",
    };
  }

  const endpoint = `https://api.telegram.org/bot${token}/deleteWebhook`;

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        drop_pending_updates: false,
      }),
      signal: AbortSignal.timeout(12000),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      const description = data?.description || `HTTP ${response.status} from Telegram deleteWebhook`;
      const currentInfo = await getTelegramWebhookInfo(fetchFn);
      return {
        success: false,
        status: "ERROR",
        webhookInfo: currentInfo,
        error: description,
      };
    }

    const verifiedInfo = await getTelegramWebhookInfo(fetchFn);
    const isSuccess = verifiedInfo.webhookStatus === "NOT_REGISTERED";

    return {
      success: isSuccess,
      status: verifiedInfo.webhookStatus,
      webhookInfo: verifiedInfo,
      error: isSuccess ? undefined : "Webhook silindi ancak doğrulama NOT_REGISTERED durumu dönmedi.",
    };
  } catch (err: any) {
    const connectivity = classifyFetchError(err);
    const verifiedInfo = await getTelegramWebhookInfo(fetchFn);
    return {
      success: false,
      status: "ERROR",
      webhookInfo: verifiedInfo,
      error: connectivity.details,
    };
  }
}
