export interface SendTelegramResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isTransient?: boolean;
  retryAfterSeconds?: number;
  isBlockedOrInactive?: boolean;
}

export interface SendTelegramOptions {
  parseMode?: "HTML" | "MarkdownV2" | null;
  disableWebPagePreview?: boolean;
  replyMarkup?: any;
}

export interface TelegramConfigStatus {
  configured: boolean;
  botUsername: string | null;
}

/**
 * Returns safe Telegram configuration status.
 * NEVER exposes bot token or webhook secret.
 */
export function getTelegramConfigStatus(): TelegramConfigStatus {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim() || null;

  // Sending telegram messages only requires the bot token
  const configured = Boolean(token);

  return {
    configured,
    botUsername: username,
  };
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

/**
 * Sends a message via Telegram Bot API with robust error classification.
 * Defaults to "HTML" parse mode.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  optionsOrFetch?: SendTelegramOptions | typeof fetch,
  fetchFnArg?: typeof fetch
): Promise<SendTelegramResult> {
  let options: SendTelegramOptions = {};
  let fetchFn: typeof fetch = fetch;

  if (typeof optionsOrFetch === "function") {
    fetchFn = optionsOrFetch;
  } else if (optionsOrFetch) {
    options = optionsOrFetch;
    if (fetchFnArg) fetchFn = fetchFnArg;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return {
      success: false,
      error: "TELEGRAM_BOT_TOKEN is not configured.",
      isTransient: false,
    };
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload: Record<string, any> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: options.disableWebPagePreview ?? false,
    link_preview_options: {
      is_disabled: Boolean(options.disableWebPagePreview),
    },
  };

  // Default to HTML unless explicitly set to null
  if (options.parseMode !== null) {
    payload.parse_mode = options.parseMode || "HTML";
  }

  if (options.replyMarkup) {
    payload.reply_markup = options.replyMarkup;
  }

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.ok) {
      return {
        success: true,
        messageId: String(data.result?.message_id || Date.now()),
      };
    }

    const description = data?.description || `HTTP ${response.status} from Telegram`;
    const statusCode = response.status;

    // Resilient fallback: If Telegram rejects HTML formatting, retry once as plain text
    if (
      statusCode === 400 &&
      description.toLowerCase().includes("can't parse entities") &&
      payload.parse_mode
    ) {
      try {
        const plainText = text.replace(/<[^>]*>/g, "");
        const fallbackResponse = await fetchFn(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            text: plainText,
            parse_mode: undefined,
          }),
          signal: AbortSignal.timeout(10000),
        });
        const fallbackData = await fallbackResponse.json().catch(() => null);
        if (fallbackResponse.ok && fallbackData?.ok) {
          return {
            success: true,
            messageId: String(fallbackData.result?.message_id || Date.now()),
          };
        }
      } catch {
        // Fall through
      }
    }

    // Rate Limiting (HTTP 429)
    if (statusCode === 429) {
      const retryAfter = data?.parameters?.retry_after || 60;
      return {
        success: false,
        isTransient: true,
        retryAfterSeconds: retryAfter,
        error: `Rate limited by Telegram. Retry after ${retryAfter}s: ${description}`,
      };
    }

    // Bot blocked by user or Chat Not Found (HTTP 403 / 400)
    if (
      statusCode === 403 ||
      description.toLowerCase().includes("bot was blocked by the user") ||
      description.toLowerCase().includes("chat not found") ||
      description.toLowerCase().includes("user is deactivated")
    ) {
      return {
        success: false,
        isTransient: false,
        isBlockedOrInactive: true,
        error: `Permanent Telegram error: ${description}`,
      };
    }

    // 5xx Server Errors are transient
    if (statusCode >= 500) {
      return {
        success: false,
        isTransient: true,
        error: `Telegram server error (HTTP ${statusCode}): ${description}`,
      };
    }

    return {
      success: false,
      isTransient: false,
      error: `Telegram error (HTTP ${statusCode}): ${description}`,
    };
  } catch (err: any) {
    return {
      success: false,
      isTransient: true,
      error: `Network/Timeout sending Telegram message: ${err?.message || "Unknown error"}`,
    };
  }
}
