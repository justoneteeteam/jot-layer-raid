import { drizzle } from "drizzle-orm/d1";
import { eq, count, sql } from "drizzle-orm";
import { emailSuppressions, emailLogs } from "../db/schema.js";
import { Env } from "../types.js";
import { renderHtmlEmail, renderPlainTextEmail, EmailTemplateData } from "./email-templates.js";


export interface SendEmailOptions {
  to: string;
  subject: string;
  templateData?: EmailTemplateData;
  html?: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
  category?: "transactional" | "marketing";
}

export interface DeliverabilityMetrics {
  totalSent: number;
  totalDelivered: number;
  totalHardBounce: number;
  totalComplaint: number;
  totalSuppressed: number;
  deliveryRatePercent: number;
  hardBounceRatePercent: number;
  complaintRatePercent: number;
}

const DEFAULT_MAX_HOURLY = 20;
const DEFAULT_MAX_DAILY = 100;

/**
 * Check if an email address is suppressed (hard bounce, complaint, or unsubscribed).
 */
export async function isSuppressed(db: any, email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await db
    .select({ count: count() })
    .from(emailSuppressions)
    .where(eq(emailSuppressions.email, normalizedEmail));

  return (result[0]?.count || 0) > 0;
}

/**
 * Add an email address to the suppression list.
 */
export async function suppressEmail(
  db: any,
  email: string,
  reason: "hard_bounce" | "complaint" | "unsubscribed" | "manual",
  source: string = "system"
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();

  try {
    await db.insert(emailSuppressions).values({
      email: normalizedEmail,
      reason,
      source,
      createdAt: now
    }).onConflictDoNothing();
  } catch (err) {
    console.error(`Error suppressing email ${normalizedEmail}:`, err);
  }
}

/**
 * Enforce rate limits stored in KV or fallback defaults.
 */
async function checkRateLimits(env: Env): Promise<{ allowed: boolean; reason?: string }> {
  let maxHourly = DEFAULT_MAX_HOURLY;
  let maxDaily = DEFAULT_MAX_DAILY;

  try {
    const raw = await env.FONTS_CACHE_KV.get("email_sending_controls");
    if (raw) {
      const controls = JSON.parse(raw);
      if (controls.max_hourly_emails) maxHourly = parseInt(controls.max_hourly_emails, 10);
      if (controls.max_daily_emails) maxDaily = parseInt(controls.max_daily_emails, 10);
    }
  } catch (e) {
    // Ignore KV read error, use defaults
  }

  const now = new Date();
  const hourlyKey = `email_counter_hourly_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}_${now.getUTCHours()}`;
  const dailyKey = `email_counter_daily_${now.getUTCFullYear()}_${now.getUTCMonth()}_${now.getUTCDate()}`;

  const currentHourly = parseInt((await env.FONTS_CACHE_KV.get(hourlyKey)) || "0", 10);
  const currentDaily = parseInt((await env.FONTS_CACHE_KV.get(dailyKey)) || "0", 10);

  if (currentHourly >= maxHourly) {
    return { allowed: false, reason: `Hourly limit of ${maxHourly} emails reached (${currentHourly} sent).` };
  }

  if (currentDaily >= maxDaily) {
    return { allowed: false, reason: `Daily limit of ${maxDaily} emails reached (${currentDaily} sent).` };
  }

  // Increment counters with expiration TTL
  await env.FONTS_CACHE_KV.put(hourlyKey, (currentHourly + 1).toString(), { expirationTtl: 7200 }); // 2 hours
  await env.FONTS_CACHE_KV.put(dailyKey, (currentDaily + 1).toString(), { expirationTtl: 172800 }); // 48 hours

  return { allowed: true };
}

/**
 * Dispatch an email with complete deliverability protection.
 */
export async function sendEmail(
  env: Env,
  options: SendEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const db = drizzle(env.DB);
  const toEmail = options.to.trim().toLowerCase();
  const fromEmail = options.fromEmail || env.DEFAULT_FROM_EMAIL || "contact@vulius.com";
  const fromName = options.fromName || env.DEFAULT_FROM_NAME || "Vulius Support";

  const now = new Date().toISOString();

  // 1. Basic format validation
  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, error: "Invalid recipient email address syntax." };
  }

  // 2. Check suppression list
  if (await isSuppressed(db, toEmail)) {
    console.warn(`[Deliverability] Blocked dispatch to suppressed email: ${toEmail}`);
    await db.insert(emailLogs).values({
      toEmail,
      fromEmail,
      subject: options.subject,
      status: "suppressed",
      errorMessage: "Recipient email is suppressed due to previous bounce/unsubscription.",
      createdAt: now
    });
    return { success: false, error: "Recipient email is in suppression list." };
  }

  // 3. Rate limiting check
  const limitCheck = await checkRateLimits(env);
  if (!limitCheck.allowed) {
    console.warn(`[Deliverability] Rate limit enforced: ${limitCheck.reason}`);
    return { success: false, error: limitCheck.reason };
  }

  // 4. Build unsubscribe links and email bodies
  const unsubscribeBase = env.UNSUBSCRIBE_BASE_URL || "https://operation.justonetee.org/api/email/unsubscribe";
  const unsubscribeToken = btoa(`${toEmail}:${Date.now()}`);
  const unsubscribeUrl = `${unsubscribeBase}?email=${encodeURIComponent(toEmail)}&token=${encodeURIComponent(unsubscribeToken)}`;

  let htmlContent = "";
  let textContent = "";

  if (options.html) {
    htmlContent = options.html;
    if (!htmlContent.includes("unsubscribe") && !htmlContent.includes("Unsubscribe")) {
      htmlContent += `<div style="text-align:center;padding:24px 0;font-size:12px;color:#94a3b8;"><p style="margin:0;">You are receiving this email because you opted in to updates from ${fromName}. <a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe instantly</a></p></div>`;
    }
    textContent = options.text || options.subject;
  } else if (options.templateData) {
    const templateData: EmailTemplateData = {
      ...options.templateData,
      unsubscribeUrl,
      brandName: fromName
    };
    htmlContent = renderHtmlEmail(templateData);
    textContent = renderPlainTextEmail(templateData);
  } else {
    htmlContent = `<p>${options.subject}</p>`;
    textContent = options.subject;
  }

  // Deliverability Headers (RFC 8058 List-Unsubscribe)
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).substring(7)}`
  };

  let sendSuccess = false;
  let errorMsg = "";
  let messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // 5A. Attempt 1: Cloudflare Worker Email Binding (env.EMAIL.send())
  if (env.EMAIL && typeof env.EMAIL.send === "function") {
    try {
      console.log(`[Deliverability] Dispatching via env.EMAIL.send() to ${toEmail}`);
      await env.EMAIL.send({
        to: toEmail,
        from: `${fromName} <${fromEmail}>`,
        subject: options.subject,
        html: htmlContent,
        text: textContent,
        headers
      });
      sendSuccess = true;
    } catch (err: any) {
      console.error("[Deliverability] env.EMAIL.send() failed:", err);
      errorMsg = err?.message || String(err);
    }
  }

  // 5B. Attempt 2: Fallback to Cloudflare Email Sending REST API if binding isn't active
  if (!sendSuccess) {
    let accountId = env.CLOUDFLARE_ACCOUNT_ID;
    let apiToken = env.CLOUDFLARE_API_TOKEN;

    try {
      const raw = await env.FONTS_CACHE_KV.get("email_settings");
      if (raw) {
        const settings = JSON.parse(raw);
        if (settings.cloudflare_account_id) accountId = settings.cloudflare_account_id;
        if (settings.cloudflare_api_token) apiToken = settings.cloudflare_api_token;
      }
    } catch (e) {
      // Ignore KV error
    }

    if (accountId && apiToken) {
      try {
        console.log(`[Deliverability] Dispatching via Cloudflare REST API to ${toEmail}`);
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            to: toEmail,
            from: `${fromName} <${fromEmail}>`,
            subject: options.subject,
            text: textContent,
            html: htmlContent,
            headers
          })
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.success) {
            sendSuccess = true;
            if (data.result?.id) messageId = data.result.id;
          } else {
            errorMsg = JSON.stringify(data.errors || data);
          }
        } else {
          errorMsg = await res.text();
        }
      } catch (err: any) {
        errorMsg = err?.message || String(err);
      }
    } else if (!env.EMAIL) {
      errorMsg = "Neither env.EMAIL binding nor CLOUDFLARE_API_TOKEN is configured.";
    }
  }

  // 6. Log result in D1 database
  try {
    await db.insert(emailLogs).values({
      toEmail,
      fromEmail,
      subject: options.subject,
      status: sendSuccess ? "sent" : "soft_bounce",
      messageId,
      errorMessage: sendSuccess ? null : errorMsg,
      createdAt: now
    });
  } catch (err) {
    console.error("[Deliverability] Error saving email log:", err);
  }

  if (sendSuccess) {
    return { success: true, messageId };
  } else {
    return { success: false, error: errorMsg };
  }
}

/**
 * Calculates deliverability metrics for operator inspection.
 */
export async function getDeliverabilityMetrics(db: any): Promise<DeliverabilityMetrics> {
  const totalSentRes = await db.select({ count: count() }).from(emailLogs);
  const totalSent = totalSentRes[0]?.count || 0;

  const deliveredRes = await db.select({ count: count() }).from(emailLogs).where(eq(emailLogs.status, "sent"));
  const totalDelivered = deliveredRes[0]?.count || 0;

  const hardBounceRes = await db.select({ count: count() }).from(emailSuppressions).where(eq(emailSuppressions.reason, "hard_bounce"));
  const totalHardBounce = hardBounceRes[0]?.count || 0;

  const complaintRes = await db.select({ count: count() }).from(emailSuppressions).where(eq(emailSuppressions.reason, "complaint"));
  const totalComplaint = complaintRes[0]?.count || 0;

  const suppressedRes = await db.select({ count: count() }).from(emailSuppressions);
  const totalSuppressed = suppressedRes[0]?.count || 0;

  const deliveryRatePercent = totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(2)) : 100;
  const hardBounceRatePercent = totalSent > 0 ? Number(((totalHardBounce / totalSent) * 100).toFixed(2)) : 0;
  const complaintRatePercent = totalSent > 0 ? Number(((totalComplaint / totalSent) * 100).toFixed(2)) : 0;

  return {
    totalSent,
    totalDelivered,
    totalHardBounce,
    totalComplaint,
    totalSuppressed,
    deliveryRatePercent,
    hardBounceRatePercent,
    complaintRatePercent
  };
}
