import nodemailer, { type Transporter } from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isTransient?: boolean;
}

export interface EmailProviderStatus {
  configured: boolean;
  provider: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  fromAddress: string | null;
  fromName: string | null;
  userMasked: string | null;
}

/**
 * Returns safe email provider configuration status.
 * NEVER leaks passwords or secrets.
 */
export function getEmailConfigStatus(): EmailProviderStatus {
  const host = process.env.SMTP_HOST?.trim() || null;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
  const user = process.env.SMTP_USER?.trim() || null;
  const password = process.env.SMTP_PASSWORD?.trim() || null;
  const fromAddress = process.env.EMAIL_FROM?.trim() || null;
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || "Game Deals";
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const configured = Boolean(host && port && user && password && fromAddress);
  const userMasked = user
    ? `${user.slice(0, 3)}***@${user.split("@")[1] || "domain"}`
    : null;

  return {
    configured,
    provider: process.env.EMAIL_PROVIDER || "SMTP",
    host,
    port,
    secure,
    fromAddress,
    fromName,
    userMasked,
  };
}

export function isEmailConfigured(): boolean {
  return getEmailConfigStatus().configured;
}

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  const status = getEmailConfigStatus();
  if (!status.configured) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: status.secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return cachedTransporter;
}

/**
 * Sends a transactional notification email.
 */
export async function sendNotificationEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const status = getEmailConfigStatus();
  if (!status.configured) {
    return {
      success: false,
      error: "SMTP provider is not configured. Missing required environment variables.",
      isTransient: false,
    };
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${status.fromName}" <${status.fromAddress}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: any) {
    const errorMessage = err?.message || "Unknown SMTP error";
    // Check if error is transient (e.g., connection timeout, network reset, 4xx)
    const isTransient =
      err?.code === "ETIMEDOUT" ||
      err?.code === "ECONNRESET" ||
      err?.code === "ECONNREFUSED" ||
      err?.responseCode?.toString().startsWith("4");

    return {
      success: false,
      error: errorMessage,
      isTransient,
    };
  }
}
