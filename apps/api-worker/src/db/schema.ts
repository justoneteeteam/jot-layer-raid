import { sqliteTable, integer, text, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// 1. Leagues
export const leagues = sqliteTable("leagues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url")
}, (table) => ({
  idxLeaguesSlug: index("idx_leagues_slug").on(table.slug),
}));

// 2. Teams
export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leagueId: integer("league_id")
    .notNull()
    .references(() => leagues.id),
  name: text("name").notNull(),
  region: text("region"),
  slug: text("slug").notNull().unique(),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  logoUrl: text("logo_url"),
  yahooRosterUrl: text("yahoo_roster_url")
}, (table) => ({
  idxTeamsSlug: index("idx_teams_slug").on(table.slug),
  idxTeamsLeague: index("idx_teams_league").on(table.leagueId),
}));

// 3. Players
export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  number: integer("number").notNull(),
  type: text("type").default("Current"),
  group: text("group").default("Football"),
  isActive: integer("is_active", { mode: "boolean" }).default(true)
}, (table) => ({
  idxPlayersTeam: index("idx_players_team").on(table.teamId),
  idxPlayersActive: index("idx_players_active").on(table.isActive),
}));

// 4. Roster Changes
export const rosterChanges = sqliteTable("roster_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  playerName: text("player_name").notNull(),
  playerNumber: integer("player_number").notNull(),
  changeType: text("change_type").notNull(), // new, updated, removed
  source: text("source").default("csv"), // csv, yahoo
  status: text("status").default("pending"), // pending, approved, rejected
  diffData: text("diff_data"), // Serialized JSON string
  detectedAt: text("detected_at") // ISO timestamp
}, (table) => ({
  idxRosterChangesTeam: index("idx_roster_changes_team").on(table.teamId),
  idxRosterChangesStatus: index("idx_roster_changes_status").on(table.status),
}));

// 5. Mockup Templates
export const mockupTemplates = sqliteTable("mockup_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamId: integer("team_id").references(() => teams.id),
  name: text("name").notNull(),
  colorVariant: text("color_variant"),
  originalImageUrl: text("original_image_url"),
  fontConfig: text("font_config"), // Serialized JSON string
  canvasJson: text("canvas_json"), // Serialized JSON string
  backgroundColor: text("background_color").default("#e5e7eb")
}, (table) => ({
  idxTemplatesTeam: index("idx_templates_team").on(table.teamId),
}));

// 6. Fonts
export const fonts = sqliteTable("fonts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  previewUrl: text("preview_url"),
  category: text("category").default("NFL"),
  teamId: integer("team_id").references(() => teams.id),
  jerseyType: text("jersey_type") // Home, Away, Alternate, None
}, (table) => ({
  idxFontsTeam: index("idx_fonts_team").on(table.teamId),
  idxFontsCategory: index("idx_fonts_category").on(table.category),
}));

// 7. Patches
export const patches = sqliteTable("patches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  width: integer("width"),
  height: integer("height")
});

// 8. Bulk Jobs
export const bulkJobs = sqliteTable("bulk_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").default("pending"), // pending, running, completed, failed
  totalItems: integer("total_items").default(0),
  completedItems: integer("completed_items").default(0),
  failedItems: integer("failed_items").default(0),
  storeTargets: text("store_targets"), // Serialized JSON list
  seoTemplate: text("seo_template"), // Serialized JSON object
  createdAt: text("created_at"), // ISO timestamp
  completedAt: text("completed_at") // ISO timestamp
}, (table) => ({
  idxBulkJobsStatus: index("idx_bulk_jobs_status").on(table.status),
}));

// 9. Bulk Job Items
export const bulkJobItems = sqliteTable("bulk_job_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id")
    .notNull()
    .references(() => bulkJobs.id),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  mockupTemplateId: integer("mockup_template_id")
    .notNull()
    .references(() => mockupTemplates.id),
  gender: text("gender").notNull(), // Men, Women, Youth
  color: text("color"),
  status: text("status").default("pending"), // pending, generating, uploading, done, failed
  generatedImageUrl: text("generated_image_url"),
  productTitle: text("product_title"),
  productDescription: text("product_description"),
  productCategory: text("product_category"),
  storeProductIds: text("store_product_ids"), // Serialized JSON map
  errorMessage: text("error_message")
}, (table) => ({
  idxJobItemsJob: index("idx_job_items_job").on(table.jobId),
  idxJobItemsPlayer: index("idx_job_items_player").on(table.playerId),
  idxJobItemsStatus: index("idx_job_items_status").on(table.status),
}));

// 10. Stores
export const stores = sqliteTable("stores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // woocommerce, shopbase, astro
  url: text("url").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(),
  webhookUrl: text("webhook_url"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at")
});

// 11. Users
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  role: text("role").default("admin"),
  createdAt: text("created_at")
});

// 12. Orders
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeId: text("store_id").default("default"),
  orderId: text("order_id").notNull(),
  orderName: text("order_name"),
  customerName: text("customer_name").notNull(),
  customerAddress: text("customer_address").notNull(),
  customerEmail: text("customer_email"),
  productName: text("product_name").notNull(),
  productImage: text("product_image"),
  quantity: integer("quantity").default(1),
  variant: text("variant").default(""),
  variantValue: text("variant_value").default(""),
  revenue: real("revenue").default(0.0),
  cost: real("cost").default(0.0),
  shippingStatus: text("shipping_status").default("placed"), // placed, in transit, delivered, incident
  trackingNumber: text("tracking_number"),
  emailSent: integer("email_sent", { mode: "boolean" }).default(false),
  trackingEmailSent: integer("tracking_email_sent", { mode: "boolean" }).default(false),
  createdAt: text("created_at"),
  syncedAt: text("synced_at")
}, (table) => ({
  uniqueStoreOrderLineItem: uniqueIndex("uniq_store_order_item").on(
    table.storeId,
    table.orderId,
    table.productName,
    table.variant
  ),
  idxOrdersStore: index("idx_orders_store").on(table.storeId),
  idxOrdersEmail: index("idx_orders_email").on(table.customerEmail),
  idxOrdersStatus: index("idx_orders_status").on(table.shippingStatus),
}));

// 13. Synced Products
export const syncedProducts = sqliteTable("synced_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  platformProductId: text("platform_product_id"),
  platform: text("platform").notNull(), // woocommerce, shopbase, astro
  imageUrl: text("image_url"),
  price: real("price").default(0.0),
  sku: text("sku"),
  createdAt: text("created_at")
}, (table) => ({
  idxSyncedPlatform: index("idx_synced_platform").on(table.platform),
  idxSyncedSku: index("idx_synced_sku").on(table.sku),
}));

// 14. Tickets
export const tickets = sqliteTable("tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").default("open"), // open, pending, resolved, spam, snoozed
  replies: text("replies").default("[]"), // Serialized JSON string of replies
  recipientEmail: text("recipient_email"),
  tags: text("tags").default(""),
  snoozedUntil: text("snoozed_until"),
  createdAt: text("created_at")
}, (table) => ({
  idxTicketsStatus: index("idx_tickets_status").on(table.status),
  idxTicketsEmail: index("idx_tickets_email").on(table.customerEmail),
}));

// 15. Email Sender Identities
export const emailSenderIdentities = sqliteTable("email_sender_identities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeId: text("store_id").notNull(),
  provider: text("provider").notNull(), // cloudflare, resend, ses, smtp
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  replyToEmail: text("reply_to_email"),
  domain: text("domain").notNull(),
  status: text("status").default("pending"), // pending, verified, active, disabled
  providerConfigRef: text("provider_config_ref"),
  createdAt: text("created_at")
});

// ── Pinterest AI Studio ─────────────────────────────────────────────────────

// 16. Pinterest Niches
export const pinterestNiches = sqliteTable("pinterest_niches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  targetAudience: text("target_audience"),
  language: text("language").default("English"),
  market: text("market").default("United States"),
  aiRawResponse: text("ai_raw_response"),
  status: text("status").default("draft"), // draft, approved, archived
  createdAt: text("created_at")
}, (table) => ({
  idxPinterestNichesStatus: index("idx_pinterest_niches_status").on(table.status),
}));

// 17. Pinterest Content Types
export const pinterestContentTypes = sqliteTable("pinterest_content_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nicheId: integer("niche_id"),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at")
}, (table) => ({
  idxPinterestContentTypesNiche: index("idx_pinterest_content_types_niche").on(table.nicheId),
}));

// 18. Pinterest Trends (queue of keywords to process)
export const pinterestTrends = sqliteTable("pinterest_trends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nicheId: integer("niche_id"),
  keyword: text("keyword").notNull(),
  theme: text("theme"),
  style: text("style"),
  contentType: text("content_type"),
  product: text("product"),
  imageUrl: text("image_url"),
  status: text("status").default("pending"), // pending, generating, completed, failed
  createdAt: text("created_at")
}, (table) => ({
  idxPinterestTrendsStatus: index("idx_pinterest_trends_status").on(table.status),
  idxPinterestTrendsNiche: index("idx_pinterest_trends_niche").on(table.nicheId),
}));

// 19. Pinterest Prompts (reusable style prompt library)
export const pinterestPrompts = sqliteTable("pinterest_prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nicheId: integer("niche_id"),
  name: text("name").notNull(),
  styleDescription: text("style_description"),
  positivePrompt: text("positive_prompt"),
  negativePrompt: text("negative_prompt"),
  colorPalette: text("color_palette"),
  lightingStyle: text("lighting_style"),
  cameraStyle: text("camera_style"),
  createdAt: text("created_at")
}, (table) => ({
  idxPinterestPromptsNiche: index("idx_pinterest_prompts_niche").on(table.nicheId),
}));

// 20. Pinterest Themes (theme library)
export const pinterestThemes = sqliteTable("pinterest_themes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nicheId: integer("niche_id"),
  name: text("name").notNull(),
  description: text("description"),
  season: text("season"),
  decorElements: text("decor_elements"),
  colorPalette: text("color_palette"),
  mood: text("mood"),
  recommendedStyles: text("recommended_styles"),
  createdAt: text("created_at")
}, (table) => ({
  idxPinterestThemesNiche: index("idx_pinterest_themes_niche").on(table.nicheId),
}));

// 21. Pinterest Recipes (generation recipes / prompt construction instructions)
export const pinterestRecipes = sqliteTable("pinterest_recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nicheId: integer("niche_id"),
  contentTypeId: integer("content_type_id"),
  name: text("name").notNull(),
  description: text("description"),
  promptTemplate: text("prompt_template"),
  seoDirection: text("seo_direction"),
  visualParams: text("visual_params"), // JSON string
  createdAt: text("created_at")
}, (table) => ({
  idxPinterestRecipesNiche: index("idx_pinterest_recipes_niche").on(table.nicheId),
  idxPinterestRecipesContentType: index("idx_pinterest_recipes_content_type").on(table.contentTypeId),
}));

// 22. Pinterest Theme-Style Junction (compatible styles per theme)
export const pinterestThemeStyles = sqliteTable("pinterest_theme_styles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  themeId: integer("theme_id").notNull(),
  styleId: integer("style_id").notNull(),
}, (table) => ({
  idxPinterestThemeStylesTheme: index("idx_pinterest_theme_styles_theme").on(table.themeId),
  idxPinterestThemeStylesStyle: index("idx_pinterest_theme_styles_style").on(table.styleId),
}));

// 23. Pinterest History (generation log — metadata only, no image URLs)
export const pinterestHistory = sqliteTable("pinterest_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nicheId: integer("niche_id"),
  trendId: integer("trend_id"),
  jobId: text("job_id"),
  keyword: text("keyword").notNull(),
  theme: text("theme"),
  style: text("style"),
  contentType: text("content_type"),
  recipeName: text("recipe_name"),
  product: text("product"),
  promptUsed: text("prompt_used"),
  negativePrompt: text("negative_prompt"),
  fileName: text("file_name"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoTags: text("seo_tags"),
  seoAltText: text("seo_alt_text"),
  modelUsed: text("model_used"),
  generationTimeMs: integer("generation_time_ms"),
  referenceImageUrl: text("reference_image_url"),
  generatedImageUrl: text("generated_image_url"),
  accountChannelId: text("account_channel_id"),
  status: text("status").default("completed"),
  createdAt: text("created_at")
}, (table) => ({
  idxPinterestHistoryKeyword: index("idx_pinterest_history_keyword").on(table.keyword),
  idxPinterestHistoryStatus: index("idx_pinterest_history_status").on(table.status),
  idxPinterestHistoryNiche: index("idx_pinterest_history_niche").on(table.nicheId),
  idxPinterestHistoryJobId: index("idx_pinterest_history_job_id").on(table.jobId),
}));

// ── Email Deliverability & Suppression Management ──────────────────────────

// 20. Email Suppressions (Hard bounces, complaints, unsubscribes)
export const emailSuppressions = sqliteTable("email_suppressions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  reason: text("reason").notNull(), // hard_bounce, complaint, unsubscribed, manual
  source: text("source").default("system"),
  createdAt: text("created_at")
}, (table) => ({
  idxSuppressionsEmail: index("idx_suppressions_email").on(table.email),
  idxSuppressionsReason: index("idx_suppressions_reason").on(table.reason),
}));

// 21. Email Logs (Audit trail of sent, delivered, bounced, and suppressed emails)
export const emailLogs = sqliteTable("email_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  toEmail: text("to_email").notNull(),
  fromEmail: text("from_email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(), // sent, delivered, soft_bounce, hard_bounce, complaint, suppressed
  messageId: text("message_id"),
  errorMessage: text("error_message"),
  createdAt: text("created_at")
}, (table) => ({
  idxEmailLogsToEmail: index("idx_email_logs_to_email").on(table.toEmail),
  idxEmailLogsStatus: index("idx_email_logs_status").on(table.status),
}));

// ── Outbound Email Marketing (Cold Outreach & Drip Campaigns) ───────────────

// 22. Marketing Contacts (Audience list with email validation scanner flags)
export const marketingContacts = sqliteTable("marketing_contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeId: text("store_id").default("WaiRaiders Store"),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  consentStatus: text("consent_status").default("subscribed"), // subscribed, unsubscribed, pending
  consentSource: text("consent_source").default("csv_import"), // csv_import, woocommerce, manual
  isValid: integer("is_valid", { mode: "boolean" }).default(true),
  validationNote: text("validation_note"),
  createdAt: text("created_at")
}, (table) => ({
  idxMarketingContactsEmail: index("idx_marketing_contacts_email").on(table.email),
  idxMarketingContactsStore: index("idx_marketing_contacts_store").on(table.storeId),
  idxMarketingContactsConsent: index("idx_marketing_contacts_consent").on(table.consentStatus),
  idxMarketingContactsValid: index("idx_marketing_contacts_valid").on(table.isValid),
}));

// 23. Email Templates (Reusable marketing email HTML designs)
export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeId: text("store_id").default("WaiRaiders Store"),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  createdAt: text("created_at")
}, (table) => ({
  idxEmailTemplatesStore: index("idx_email_templates_store").on(table.storeId),
}));

// 24. Marketing Campaigns (Cold outreach blasts & drip throttling)
export const marketingCampaigns = sqliteTable("marketing_campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  storeId: text("store_id").default("WaiRaiders Store"),
  senderIdentityId: integer("sender_identity_id").references(() => emailSenderIdentities.id),
  status: text("status").default("draft"), // draft, scheduled, sending, paused, completed
  sentCount: integer("sent_count").default(0),
  totalContacts: integer("total_contacts").default(0),
  dailyLimit: integer("daily_limit").default(20),
  scheduledAt: text("scheduled_at"),
  createdAt: text("created_at")
}, (table) => ({
  idxMarketingCampaignsStatus: index("idx_marketing_campaigns_status").on(table.status),
  idxMarketingCampaignsStore: index("idx_marketing_campaigns_store").on(table.storeId),
}));

// 25. Campaign Sends (Individual contact send log for throttling & retry safety)
export const campaignSends = sqliteTable("campaign_sends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull().references(() => marketingCampaigns.id),
  contactId: integer("contact_id").notNull().references(() => marketingContacts.id),
  toEmail: text("to_email").notNull(),
  status: text("status").default("queued"), // queued, sent, failed, suppressed
  sentAt: text("sent_at"),
  errorMessage: text("error_message"),
  createdAt: text("created_at")
}, (table) => ({
  idxCampaignSendsCampaign: index("idx_campaign_sends_campaign").on(table.campaignId),
  idxCampaignSendsContact: index("idx_campaign_sends_contact").on(table.contactId),
  idxCampaignSendsStatus: index("idx_campaign_sends_status").on(table.status),
}));

// 26. Financial Transactions (P&L Cost, Revenue, and Debt Tracking)
export const financialTransactions = sqliteTable("financial_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // 'cost', 'revenue', 'debt'
  category: text("category").notNull(), // 'Personnel', 'Advertising & Marketing', 'Software', 'VPS & Proxy', 'Others', 'Development', 'Stripe Cost', 'Refund', etc.
  amountVnd: real("amount_vnd").notNull().default(0.0),
  amountUsd: real("amount_usd").notNull().default(0.0),
  exchangeRate: real("exchange_rate").notNull().default(26000.0),
  inputCurrency: text("input_currency").notNull().default("VND"), // 'VND' or 'USD'
  transactionDate: text("transaction_date").notNull(), // ISO date or YYYY-MM-DD
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1 to 12
  note: text("note").default(""),
  event: text("event").default(""), // Marketing event / campaign name
  imageProofUrl: text("image_proof_url").default(""), // R2 receipt/invoice URL
  isRecurring: integer("is_recurring", { mode: "boolean" }).default(false),
  repeatFrequency: text("repeat_frequency").default("none"), // 'none', 'monthly', 'weekly', 'yearly'
  repeatUntil: text("repeat_until"),
  isExcludedFromReport: integer("is_excluded_from_report", { mode: "boolean" }).default(false), // 'not count in the report'
  debtStatus: text("debt_status").default("n/a"), // 'unpaid', 'paid', 'partial', 'n/a'
  debtCounterparty: text("debt_counterparty").default(""), // creditor / debtor name
  debtDueDate: text("debt_due_date"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at")
}, (table) => ({
  idxFinTxType: index("idx_fin_tx_type").on(table.type),
  idxFinTxYearMonth: index("idx_fin_tx_year_month").on(table.year, table.month),
  idxFinTxCategory: index("idx_fin_tx_category").on(table.category),
  idxFinTxExcluded: index("idx_fin_tx_excluded").on(table.isExcludedFromReport),
  idxFinTxDebtStatus: index("idx_fin_tx_debt_status").on(table.debtStatus),
}));

// 27. Financial Settings
export const financialSettings = sqliteTable("financial_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  defaultExchangeRate: real("default_exchange_rate").default(26000.0),
  companyName: text("company_name").default("Just One Tee Group"),
  updatedAt: text("updated_at")
});



