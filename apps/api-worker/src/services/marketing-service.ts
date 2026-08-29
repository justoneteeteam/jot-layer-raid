import { drizzle } from "drizzle-orm/d1";
import { eq, and, notInArray, count, desc, sql } from "drizzle-orm";
import {
  marketingContacts,
  emailTemplates,
  marketingCampaigns,
  campaignSends,
  emailSenderIdentities,
  emailSuppressions
} from "../db/schema.js";
import { Env } from "../types.js";
import { sendEmail, isSuppressed } from "./email-service.js";

// List of common disposable / temporary email domains & spam traps
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "guerrillamail.info",
  "guerrillamail.biz",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "throwawaymail.com",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.org",
  "getairmail.com",
  "dispostable.com",
  "crazymailing.com",
  "mohmal.com",
  "mytemp.email",
  "fakemailgenerator.com",
  "disposablemail.xyz",
  "tempail.com",
  "generator.email",
  "emailondeck.com",
  "fakeinbox.com",
  "burnermail.io",
  "maildrop.cc",
  "inboxkitten.com",
  "nada.ltd",
  "dropmail.me"
]);

// Email syntax regex according to RFC 5322 standard
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Ensure marketing tables exist in D1 (self-healing migration)
 */
export async function initMarketingTables(d1: D1Database): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS marketing_contacts (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      store_id text DEFAULT 'WaiRaiders Store',
      email text NOT NULL,
      first_name text,
      last_name text,
      consent_status text DEFAULT 'subscribed',
      consent_source text DEFAULT 'csv_import',
      is_valid integer DEFAULT 1,
      validation_note text,
      created_at text
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS marketing_contacts_email_unique ON marketing_contacts (email);`,
    `CREATE INDEX IF NOT EXISTS idx_marketing_contacts_email ON marketing_contacts (email);`,
    `CREATE INDEX IF NOT EXISTS idx_marketing_contacts_store ON marketing_contacts (store_id);`,
    `CREATE TABLE IF NOT EXISTS email_templates (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      store_id text DEFAULT 'WaiRaiders Store',
      name text NOT NULL,
      subject text NOT NULL,
      body_html text NOT NULL,
      created_at text
    );`,
    `CREATE INDEX IF NOT EXISTS idx_email_templates_store ON email_templates (store_id);`,
    `CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      name text NOT NULL,
      subject text NOT NULL,
      body_html text NOT NULL,
      store_id text DEFAULT 'WaiRaiders Store',
      sender_identity_id integer,
      status text DEFAULT 'draft',
      sent_count integer DEFAULT 0,
      total_contacts integer DEFAULT 0,
      daily_limit integer DEFAULT 20,
      scheduled_at text,
      created_at text
    );`,
    `CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns (status);`,
    `CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_store ON marketing_campaigns (store_id);`,
    `CREATE TABLE IF NOT EXISTS campaign_sends (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      campaign_id integer NOT NULL,
      contact_id integer NOT NULL,
      to_email text NOT NULL,
      status text DEFAULT 'queued',
      sent_at text,
      error_message text,
      created_at text
    );`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends (campaign_id);`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_sends_contact ON campaign_sends (contact_id);`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_sends_status ON campaign_sends (status);`
  ];

  for (const sql of statements) {
    try {
      await d1.prepare(sql).run();
    } catch (err) {
      console.warn("Table init statement warning:", err);
    }
  }
}

/**
 * Scan an email address for deliverability validity:
 * 1. Syntax format check
 * 2. Disposable / temporary domain check
 * 3. DNS MX record validation via Cloudflare DNS-over-HTTPS (1.1.1.1)
 */
export async function scanEmail(email: string): Promise<{ isValid: boolean; reason?: string }> {
  const normalized = email.trim().toLowerCase();
  
  // 1. Syntax check
  if (!normalized || !EMAIL_REGEX.test(normalized)) {
    return { isValid: false, reason: "Invalid email syntax" };
  }

  const parts = normalized.split("@");
  if (parts.length !== 2 || !parts[1]) {
    return { isValid: false, reason: "Malformed email format" };
  }

  const domain = parts[1];

  // 2. Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { isValid: false, reason: `Disposable domain detected (${domain})` };
  }

  // 3. Check MX record via Cloudflare DNS over HTTPS
  try {
    const dnsUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`;
    const res = await fetch(dnsUrl, {
      headers: { Accept: "application/dns-json" }
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      // Status 0 is NOERROR
      if (data.Status === 0) {
        if (!data.Answer || data.Answer.length === 0) {
          // If no MX records found, check for A record fallback
          const aRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
            headers: { Accept: "application/dns-json" }
          });
          if (aRes.ok) {
            const aData = (await aRes.json()) as any;
            if (!aData.Answer || aData.Answer.length === 0) {
              return { isValid: false, reason: `No MX or A records found for domain ${domain}` };
            }
          }
        }
      } else if (data.Status === 3) { // NXDOMAIN
        return { isValid: false, reason: `Domain ${domain} does not exist (NXDOMAIN)` };
      }
    }
  } catch (err) {
    // Non-fatal if DNS check fails due to network, allow email through
    console.warn(`DNS check warning for ${domain}:`, err);
  }

  return { isValid: true };
}

export interface SyncContactInput {
  email: string;
  first_name?: string;
  last_name?: string;
  consent_source?: string;
}

/**
 * Bulk import / sync contacts with email validation scanner
 */
export async function syncMarketingContacts(
  d1: D1Database,
  contacts: SyncContactInput[],
  storeId: string = "WaiRaiders Store"
): Promise<{
  created: number;
  updated: number;
  invalid: number;
  scan_results: Array<{ email: string; valid: boolean; reason?: string }>;
}> {
  await initMarketingTables(d1);
  const db = drizzle(d1);

  let created = 0;
  let updated = 0;
  let invalid = 0;
  const scanResults: Array<{ email: string; valid: boolean; reason?: string }> = [];

  // Group / deduplicate in memory first
  const contactMap = new Map<string, SyncContactInput>();
  for (const c of contacts) {
    if (!c.email) continue;
    const normalized = c.email.trim().toLowerCase();
    if (normalized) {
      contactMap.set(normalized, { ...c, email: normalized });
    }
  }

  const uniqueList = Array.from(contactMap.values());

  for (const item of uniqueList) {
    const scan = await scanEmail(item.email);
    scanResults.push({
      email: item.email,
      valid: scan.isValid,
      reason: scan.reason
    });

    if (!scan.isValid) {
      invalid++;
    }

    const now = new Date().toISOString();
    
    // Check if contact already exists
    const existing = await db
      .select()
      .from(marketingContacts)
      .where(eq(marketingContacts.email, item.email))
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      await db
        .update(marketingContacts)
        .set({
          storeId,
          firstName: item.first_name || existing[0].firstName,
          lastName: item.last_name || existing[0].lastName,
          isValid: scan.isValid,
          validationNote: scan.reason || null,
        })
        .where(eq(marketingContacts.id, existing[0].id));
      updated++;
    } else {
      await db.insert(marketingContacts).values({
        storeId,
        email: item.email,
        firstName: item.first_name || null,
        lastName: item.last_name || null,
        consentStatus: scan.isValid ? "subscribed" : "pending",
        consentSource: item.consent_source || "csv_import",
        isValid: scan.isValid,
        validationNote: scan.reason || null,
        createdAt: now
      });
      created++;
    }
  }

  return {
    created,
    updated,
    invalid,
    scan_results: scanResults
  };
}

/**
 * Dispatch a drip batch for a campaign up to its daily_limit (or remaining limit today)
 */
export async function sendCampaignDripBatch(
  env: Env,
  campaignId: number,
  overrideMaxBatch?: number
): Promise<{
  sent: number;
  failed: number;
  suppressed: number;
  remaining: number;
  total_contacts: number;
  daily_limit: number;
  status: string;
}> {
  await initMarketingTables(env.DB);
  const db = drizzle(env.DB);

  // 1. Fetch Campaign
  const campaignRes = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, campaignId))
    .limit(1);

  if (campaignRes.length === 0 || !campaignRes[0]) {
    throw new Error(`Campaign ID ${campaignId} not found`);
  }

  const campaign = campaignRes[0];
  const dailyLimit = campaign.dailyLimit || 20;

  // 2. Fetch Sender Identity if configured
  let fromEmail = env.DEFAULT_FROM_EMAIL || "contact@vulius.com";
  let fromName = env.DEFAULT_FROM_NAME || "Vulius Store";

  if (campaign.senderIdentityId) {
    const senderRes = await db
      .select()
      .from(emailSenderIdentities)
      .where(eq(emailSenderIdentities.id, campaign.senderIdentityId))
      .limit(1);

    if (senderRes.length > 0 && senderRes[0]) {
      fromEmail = senderRes[0].fromEmail;
      fromName = senderRes[0].fromName;
    }
  }

  // 3. Determine how many emails have already been sent TODAY for this campaign
  const todaySends = await db
    .select({ count: count() })
    .from(campaignSends)
    .where(
      and(
        eq(campaignSends.campaignId, campaignId),
        eq(campaignSends.status, "sent"),
        sql`date(${campaignSends.sentAt}) = date('now')`
      )
    );

  const sentToday = todaySends[0]?.count || 0;
  const remainingTodayLimit = Math.max(0, dailyLimit - sentToday);

  const batchLimit = overrideMaxBatch !== undefined
    ? overrideMaxBatch
    : remainingTodayLimit;

  // 4. Find all already-processed contact IDs for this campaign
  const processedSends = await db
    .select({ contactId: campaignSends.contactId })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId));

  const processedIds = new Set(processedSends.map(s => s.contactId));

  // 5. Query eligible target contacts
  let contactQuery = db
    .select()
    .from(marketingContacts)
    .where(
      and(
        eq(marketingContacts.isValid, true),
        eq(marketingContacts.consentStatus, "subscribed")
      )
    );

  if (campaign.storeId && campaign.storeId !== "all") {
    contactQuery = db
      .select()
      .from(marketingContacts)
      .where(
        and(
          eq(marketingContacts.storeId, campaign.storeId),
          eq(marketingContacts.isValid, true),
          eq(marketingContacts.consentStatus, "subscribed")
        )
      );
  }

  const allEligibleContacts = await contactQuery;
  const totalContacts = allEligibleContacts.length;

  // Filter unsent contacts
  const unsentContacts = allEligibleContacts.filter(c => !processedIds.has(c.id));
  const contactsToSend = unsentContacts.slice(0, batchLimit);

  let sentCount = 0;
  let failedCount = 0;
  let suppressedCount = 0;

  for (const contact of contactsToSend) {
    const toEmail = contact.email.trim().toLowerCase();
    const customerName = contact.firstName
      ? `${contact.firstName}${contact.lastName ? ` ${contact.lastName}` : ""}`
      : "Valued Customer";

    // Personalize HTML body
    let personalizedHtml = campaign.bodyHtml
      .replace(/{customer_name}/g, customerName)
      .replace(/{first_name}/g, contact.firstName || "Customer")
      .replace(/{email}/g, toEmail);

    const now = new Date().toISOString();

    // Check suppression list first
    const suppressed = await isSuppressed(db, toEmail);
    if (suppressed) {
      await db.insert(campaignSends).values({
        campaignId,
        contactId: contact.id,
        toEmail,
        status: "suppressed",
        errorMessage: "Suppressed due to previous bounce or unsubscription",
        createdAt: now
      });
      suppressedCount++;
      continue;
    }

    // Send the email
    const sendResult = await sendEmail(env, {
      to: toEmail,
      subject: campaign.subject,
      fromEmail,
      fromName,
      category: "marketing",
      html: personalizedHtml,
      text: `${campaign.name}\n\nHello ${customerName},\n\nVisit https://vulius.com`
    });

    if (sendResult.success) {
      await db.insert(campaignSends).values({
        campaignId,
        contactId: contact.id,
        toEmail,
        status: "sent",
        sentAt: now,
        createdAt: now
      });
      sentCount++;
    } else {
      await db.insert(campaignSends).values({
        campaignId,
        contactId: contact.id,
        toEmail,
        status: "failed",
        errorMessage: sendResult.error || "Failed to deliver email",
        createdAt: now
      });
      failedCount++;
    }
  }

  // Update campaign total sent counter
  const totalSentRes = await db
    .select({ count: count() })
    .from(campaignSends)
    .where(
      and(
        eq(campaignSends.campaignId, campaignId),
        eq(campaignSends.status, "sent")
      )
    );

  const newTotalSent = totalSentRes[0]?.count || 0;
  const remainingTotal = Math.max(0, totalContacts - (processedIds.size + contactsToSend.length));
  
  let newStatus = campaign.status || "draft";
  if (remainingTotal === 0 && totalContacts > 0) {
    newStatus = "completed";
  } else if (campaign.status === "draft" || campaign.status === "scheduled") {
    newStatus = "sending";
  }

  await db
    .update(marketingCampaigns)
    .set({
      sentCount: newTotalSent,
      totalContacts,
      status: newStatus
    })
    .where(eq(marketingCampaigns.id, campaignId));

  return {
    sent: sentCount,
    failed: failedCount,
    suppressed: suppressedCount,
    remaining: remainingTotal,
    total_contacts: totalContacts,
    daily_limit: dailyLimit,
    status: newStatus
  };
}

/**
 * Execute daily drip sends across all active 'sending' campaigns
 */
export async function runDailyMarketingDrip(env: Env): Promise<void> {
  try {
    await initMarketingTables(env.DB);
    const db = drizzle(env.DB);

    const activeCampaigns = await db
      .select()
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.status, "sending"));

    console.log(`[Marketing Drip] Processing ${activeCampaigns.length} active campaigns`);

    for (const campaign of activeCampaigns) {
      try {
        const result = await sendCampaignDripBatch(env, campaign.id);
        console.log(`[Marketing Drip] Campaign ${campaign.id} batch result:`, result);
      } catch (cErr) {
        console.error(`[Marketing Drip] Error processing campaign ${campaign.id}:`, cErr);
      }
    }
  } catch (err) {
    console.error("[Marketing Drip] Fatal error running daily marketing drip:", err);
  }
}
