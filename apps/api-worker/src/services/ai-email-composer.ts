import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { orders, tickets } from "../db/schema.js";
import { Env } from "../types.js";

export interface AiReplyResult {
  success: boolean;
  replyText: string;
  modelUsed: "deepseek-chat" | "template-fallback";
  ordersMatched: number;
}

const SHIPPING_KEYWORDS = [
  "shipping",
  "tracking",
  "track",
  "where is my order",
  "where's my order",
  "where is my package",
  "where's my package",
  "delivery",
  "deliver",
  "shipped",
  "status",
  "package",
  "when will i receive",
  "order status",
  "shipment",
  "have not received",
  "haven't received",
  "not arrived",
  "transit",
  "carrier",
  "usps",
  "17track",
  "tracking number",
  "tracking link",
  "order update"
];

/**
 * Analyzes subject and message body to check if customer is asking about shipping/order status.
 */
export function isShippingInquiry(subject: string = "", bodyText: string = ""): boolean {
  const combined = `${subject} ${bodyText}`.toLowerCase();
  
  // Keyword match
  if (SHIPPING_KEYWORDS.some((kw) => combined.includes(kw))) {
    return true;
  }

  // Order reference regex match (e.g., AST_10092, #10092, WOC 123)
  if (/(?:order\s*#?|ast_|woc\s*)\d+/i.test(combined)) {
    return true;
  }

  return false;
}

/**
 * Resolves DeepSeek API key from environment binding or KV settings.
 */
async function resolveDeepSeekApiKey(env: Env): Promise<string | null> {
  if (env.DEEPSEEK_API_KEY) {
    return env.DEEPSEEK_API_KEY;
  }

  try {
    const rawEmailSettings = await env.FONTS_CACHE_KV.get("email_settings");
    if (rawEmailSettings) {
      const parsed = JSON.parse(rawEmailSettings);
      if (parsed.deepseek_api_key) return parsed.deepseek_api_key;
    }

    const rawPinterest = await env.FONTS_CACHE_KV.get("pinterest_settings");
    if (rawPinterest) {
      const parsed = JSON.parse(rawPinterest);
      if (parsed.deepseekApiKey) return parsed.deepseekApiKey;
    }
  } catch (err) {
    console.error("[AI Composer] Error reading KV for DeepSeek key:", err);
  }

  return null;
}

/**
 * Composes a shipping reply draft using DeepSeek Chat or a deterministic fallback template.
 */
export async function composeShippingReply(
  env: Env,
  customerEmail: string,
  customerName?: string,
  ticketMessage: string = "",
  ticketSubject: string = ""
): Promise<AiReplyResult> {
  const normalizedEmail = customerEmail.trim().toLowerCase();
  const db = drizzle(env.DB);

  // 1. Fetch matching orders for this customer email
  const matchedOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerEmail, normalizedEmail))
    .orderBy(desc(orders.createdAt));

  if (matchedOrders.length === 0) {
    return {
      success: false,
      replyText: "",
      modelUsed: "template-fallback",
      ordersMatched: 0
    };
  }

  const primaryName =
    customerName?.trim() ||
    matchedOrders[0]?.customerName?.trim() ||
    normalizedEmail.split("@")[0] ||
    "Valued Customer";

  const firstName = primaryName.split(" ")[0] || primaryName;

  // 2. Build structured order information
  const orderDetails = matchedOrders.map((ord) => {
    const orderId = ord.orderId || (ord.orderName ? `#${ord.orderName}` : `#${ord.id}`);
    const tracking = ord.trackingNumber?.trim() || null;
    const trackingUrl = tracking ? `https://www.17track.net/en/track?nums=${encodeURIComponent(tracking)}` : null;
    const status = ord.shippingStatus || "placed";
    const product = ord.productName || "Custom Sports Jersey";
    const variant = ord.variant ? ` (${ord.variant})` : "";
    const date = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent";

    return {
      orderId,
      product: `${product}${variant}`,
      status,
      tracking,
      trackingUrl,
      date
    };
  });

  // 3. Attempt DeepSeek Generation
  const apiKey = await resolveDeepSeekApiKey(env);

  if (apiKey) {
    try {
      const systemPrompt = `You are the customer support AI assistant for Vulius, a premium sports apparel and custom jersey brand.
A customer sent an email inquiring about their order and shipping status.
Compose a warm, helpful, professional, and clear reply email draft.

RULES & GUIDELINES:
1. Address the customer by their first name (e.g. "Hi ${firstName},").
2. Acknowledge their message and clearly summarize the status for their order(s).
3. If an order has a tracking number, provide the tracking number and the tracking link:
   Track your package: https://www.17track.net/en/track?nums={tracking_number}
4. If status is "placed" (no tracking number yet), reassure the customer that their custom jersey is currently being prepared/printed and typically ships in 3-5 business days.
5. If status is "in transit", explain that it's on the way and invite them to check the tracking link.
6. If status is "delivered", confirm delivery and kindly suggest checking with household members, front porch, or building office if not yet received.
7. If status is "incident", apologize for the transit delay and assure them our logistics team is following up with the carrier.
8. Keep the response concise (90 to 180 words), empathetic, and professional.
9. Sign off with:
Best regards,
Vulius Support Team
10. STRICT CONSTRAINT: Do NOT hallucinate or invent tracking numbers, dates, or details not present in the order data below.

OUTPUT REQUIREMENT:
Return ONLY the plain text email body. Do not include markdown backticks (\`\`\`), subject headers, or JSON formatting.`;

      const userPrompt = `Customer Name: ${primaryName}
Customer Email: ${normalizedEmail}
Customer Inquiry Subject: ${ticketSubject || "Order inquiry"}
Customer Inquiry Message: "${ticketMessage || "Where is my order?"}"

Orders in our database for this customer:
${orderDetails
  .map(
    (o, idx) =>
      `${idx + 1}. Order ${o.orderId}:
   - Item: ${o.product}
   - Order Date: ${o.date}
   - Shipping Status: ${o.status}
   - Tracking Number: ${o.tracking || "Not yet assigned (in production)"}
   - Tracking URL: ${o.trackingUrl || "N/A"}`
  )
  .join("\n\n")}`;

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 600
        })
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        let content = data.choices?.[0]?.message?.content?.trim() || "";

        // Clean up any markdown code fencing if model wrapped it
        if (content.startsWith("```")) {
          content = content.replace(/^```(?:markdown|text)?\n?/, "").replace(/\n?```$/, "").trim();
        }

        if (content.length > 20) {
          return {
            success: true,
            replyText: content,
            modelUsed: "deepseek-chat",
            ordersMatched: matchedOrders.length
          };
        }
      } else {
        console.error(`[AI Composer] DeepSeek request failed (${response.status}):`, await response.text());
      }
    } catch (err) {
      console.error("[AI Composer] Error calling DeepSeek API:", err);
    }
  }

  // 4. Deterministic Fallback Template
  const orderSummaryText = orderDetails
    .map((o) => {
      let statusDesc = `Status: ${o.status.toUpperCase()}`;
      if (o.tracking) {
        statusDesc += `\nTracking Number: ${o.tracking}\nTrack package: ${o.trackingUrl}`;
      } else if (o.status === "placed") {
        statusDesc += " (Currently in production, ships in 3-5 business days)";
      }
      return `• ${o.orderId} — ${o.product}\n  ${statusDesc}`;
    })
    .join("\n\n");

  const fallbackBody = `Hi ${firstName},

Thank you for reaching out regarding your order status!

Here is the current logistics update for your order(s):

${orderSummaryText}

If you have any questions or need further assistance with your shipment, please reply directly to this message.

Best regards,
Vulius Support Team`;

  return {
    success: true,
    replyText: fallbackBody,
    modelUsed: "template-fallback",
    ordersMatched: matchedOrders.length
  };
}

/**
 * Handles automated AI drafting in the background (waitUntil).
 * Checks settings, calls composeShippingReply, appends draft to ticket replies, and alerts Telegram.
 */
export async function handleAiDraftReply(
  ticketId: number,
  sender: string,
  senderName: string,
  bodyText: string,
  subject: string,
  env: Env
): Promise<void> {
  const db = drizzle(env.DB);

  // 1. Check if AI Auto Drafting is enabled in KV settings
  try {
    const rawSettings = await env.FONTS_CACHE_KV.get("email_settings");
    if (rawSettings) {
      const settings = JSON.parse(rawSettings);
      if (settings.ai_auto_reply_enabled === false) {
        console.log(`[AI Composer] Auto-drafting is disabled in email_settings. Skipping ticket #${ticketId}.`);
        return;
      }
    }
  } catch (e) {
    // Ignore KV read errors, default to enabled
  }

  // 2. Compose draft reply
  const result = await composeShippingReply(env, sender, senderName, bodyText, subject);

  if (!result.success || !result.replyText || result.ordersMatched === 0) {
    console.log(`[AI Composer] No matching orders or draft generation failed for ${sender}. Skipping ticket #${ticketId}.`);
    return;
  }

  // 3. Load current ticket
  const ticketQuery = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);
  const ticket = ticketQuery[0];
  if (!ticket) return;

  let repliesList: string[] = [];
  if (ticket.replies) {
    try {
      repliesList = JSON.parse(ticket.replies);
    } catch (e) {
      repliesList = [];
    }
  }

  // Prevent duplicate AI drafts if one already exists in recent replies
  const hasExistingDraft = repliesList.some((r) => r.startsWith("[AI Draft"));
  if (hasExistingDraft) {
    console.log(`[AI Composer] Ticket #${ticketId} already has an AI draft. Skipping.`);
    return;
  }

  // 4. Format draft message and save to ticket
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const formattedDraft = `[AI Draft | ${timeStr} via ${result.modelUsed}] ${result.replyText}`;
  repliesList.push(formattedDraft);

  await db
    .update(tickets)
    .set({
      replies: JSON.stringify(repliesList)
    })
    .where(eq(tickets.id, ticketId));

  console.log(`[AI Composer] Successfully saved AI draft for ticket #${ticketId} (${result.modelUsed}).`);

  // 5. Notify Telegram
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const snippet = result.replyText.slice(0, 250).replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const telegramMessage =
        `🤖 <b>[AI Draft Ready — Ticket #${ticketId}]</b>\n` +
        `<b>Customer:</b> ${senderName} (${sender})\n` +
        `<b>Subject:</b> ${subject}\n` +
        `<b>Matched Orders:</b> ${result.ordersMatched}\n` +
        `<b>Engine:</b> <code>${result.modelUsed}</code>\n\n` +
        `<blockquote>${snippet}${result.replyText.length > 250 ? "..." : ""}</blockquote>\n\n` +
        `👉 <a href="https://jot-layer-raid-web.pages.dev/oms/tickets">Review & Send Draft in Dashboard</a>`;

      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: telegramMessage,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      });
    } catch (tgErr) {
      console.error("[AI Composer] Failed to dispatch Telegram notification:", tgErr);
    }
  }
}
