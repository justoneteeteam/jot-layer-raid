import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

// 1. Leagues
export const leagues = sqliteTable("leagues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url")
});

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
});

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
});

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
});

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
});

// 6. Fonts
export const fonts = sqliteTable("fonts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  previewUrl: text("preview_url"),
  category: text("category").default("NFL"),
  teamId: integer("team_id").references(() => teams.id),
  jerseyType: text("jersey_type") // Home, Away, Alternate, None
});

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
});

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
});

// 10. Stores
export const stores = sqliteTable("stores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // woocommerce, shopbase
  url: text("url").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at")
});

// 11. Users
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  createdAt: text("created_at")
});

// 12. Orders
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storeId: text("store_id"),
  orderId: text("order_id"),
  orderName: text("order_name"),
  customerName: text("customer_name").notNull(),
  customerAddress: text("customer_address").notNull(),
  customerEmail: text("customer_email"),
  productName: text("product_name").notNull(),
  productImage: text("product_image"),
  quantity: integer("quantity").default(1),
  variant: text("variant"),
  variantValue: text("variant_value"),
  revenue: real("revenue").default(0.0),
  cost: real("cost").default(0.0),
  shippingStatus: text("shipping_status").default("placed"), // placed, in transit, delivered, incident
  trackingNumber: text("tracking_number"),
  emailSent: integer("email_sent", { mode: "boolean" }).default(false),
  trackingEmailSent: integer("tracking_email_sent", { mode: "boolean" }).default(false),
  createdAt: text("created_at"),
  syncedAt: text("synced_at")
});

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
});

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
});

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

// 16. Pinterest Trends (queue of keywords to process)
export const pinterestTrends = sqliteTable("pinterest_trends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyword: text("keyword").notNull(),
  theme: text("theme"),
  style: text("style"),
  product: text("product"),
  imageUrl: text("image_url"),
  status: text("status").default("pending"), // pending, generating, completed, failed
  createdAt: text("created_at")
});

// 17. Pinterest Prompts (reusable style prompt library)
export const pinterestPrompts = sqliteTable("pinterest_prompts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  styleDescription: text("style_description"),
  positivePrompt: text("positive_prompt"),
  negativePrompt: text("negative_prompt"),
  colorPalette: text("color_palette"),
  lightingStyle: text("lighting_style"),
  cameraStyle: text("camera_style"),
  createdAt: text("created_at")
});

// 18. Pinterest Themes (seasonal theme library)
export const pinterestThemes = sqliteTable("pinterest_themes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  season: text("season"),
  decorElements: text("decor_elements"),
  colorPalette: text("color_palette"),
  mood: text("mood"),
  recommendedStyles: text("recommended_styles"),
  createdAt: text("created_at")
});

// 19. Pinterest History (generation log — metadata only, no image URLs)
export const pinterestHistory = sqliteTable("pinterest_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trendId: integer("trend_id"),
  keyword: text("keyword").notNull(),
  theme: text("theme"),
  style: text("style"),
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
});
