import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc, and, or, isNull, like, gte, lt } from "drizzle-orm";
import { Env } from "./types";
import {
  mockupTemplates,
  bulkJobs,
  bulkJobItems,
  players,
  teams,
  fonts,
  patches,
  users,
  stores,
  emailSenderIdentities,
  orders,
  tickets,
  leagues,
  pinterestTrends,
  pinterestPrompts,
  pinterestThemes,
  pinterestHistory,
  pinterestNiches,
  pinterestContentTypes,
  pinterestRecipes,
  pinterestThemeStyles,
  syncedProducts,
  marketingContacts,
  emailTemplates,
  marketingCampaigns,
  campaignSends,
  financialTransactions,
  financialSettings
} from "./db/schema";
import { uploadToR2, getFromR2, deleteFromR2 } from "./services/r2-storage";
import {
  initFinancialTables,
  generatePLReport,
  getFinancialTransactions,
  createFinancialTransaction,
  updateFinancialTransaction,
  deleteFinancialTransaction,
  getDebtSummary,
  DEFAULT_CATEGORIES
} from "./services/financials";
import { generateJersey } from "./services/image-engine";
import { generatePinterestCreative, generatePinterestSEO, generateFileName } from "./services/pinterest-ai";
import { buildPinterestRSSFeed } from "./services/rss-service";
import {
  generateNicheLibrary,
  validateNicheLibrary,
  saveApprovedNiche
} from "./services/niche-generator";
import { cacheResponse, invalidateCache } from "./services/cache";
import {
  runAutoPilotBatch,
  runRecurringBatches,
  DEFAULT_CHANNELS,
  getActiveChannels,
  cancelJob,
  deleteChannel,
  deleteQueueJob,
  getActiveQueueJobs,
  getQueueHistory
} from "./services/autopilot";
import bcrypt from "bcryptjs";
import { sign } from "hono/jwt";
import { syncOrders } from "./services/oms-sync";
import { extractFromPdfBuffer, matchLabelWithOrders } from "./services/wechat-service";
import {
  isShippingInquiry,
  composeShippingReply,
  handleAiDraftReply
} from "./services/ai-email-composer.js";
import {
  initMarketingTables,
  scanEmail,
  syncMarketingContacts,
  sendCampaignDripBatch,
  runDailyMarketingDrip
} from "./services/marketing-service.js";

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for frontend and other origins
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "Expires", "X-Requested-With"]
}));

// Authentication Routes
app.post("/api/auth/login", async (c) => {
  const db = drizzle(c.env.DB);
  
  const body = await c.req.parseBody();
  const username = body.username as string;
  const password = body.password as string;

  if (!username || !password) {
    return c.json({ detail: "Username and password are required" }, 400);
  }

  const userQuery = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const user = userQuery[0];

  if (!user) {
    return c.json({ detail: "Invalid username or password" }, 401);
  }

  const isValid = await bcrypt.compare(password, user.hashedPassword);
  if (!isValid) {
    return c.json({ detail: "Invalid username or password" }, 401);
  }

  const payload = {
    sub: user.username,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
  };
  const secret = c.env.JWT_SECRET || "change-me-in-production";
  const token = await sign(payload, secret);

  return c.json({
    access_token: token,
    token_type: "bearer"
  });
});

app.post("/api/auth/register", async (c) => {
  const db = drizzle(c.env.DB);
  
  const body = await c.req.json();
  const username = body.username as string;
  const password = body.password as string;

  if (!username || !password) {
    return c.json({ detail: "Username and password are required" }, 400);
  }

  const existingQuery = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existingQuery.length > 0) {
    return c.json({ detail: "Username already taken" }, 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await db.insert(users).values({
    username,
    hashedPassword,
    createdAt: new Date().toISOString()
  });

  const payload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
  };
  const secret = c.env.JWT_SECRET || "change-me-in-production";
  const token = await sign(payload, secret);

  return c.json({
    access_token: token,
    token_type: "bearer"
  }, 201);
});

// Root landing page
app.get("/", (c) => {
  return c.html(`
    <div style="font-family: sans-serif; padding: 3rem 1.5rem; max-width: 600px; margin: 0 auto; text-align: center; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-top: 5rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
      <h1 style="color: #004C54; font-size: 2.25rem; margin-bottom: 0.5rem;">JOTLayerRaid D1 API</h1>
      <p style="color: #4b5563; font-size: 1.125rem;">Your Cloudflare Worker API is running and connected successfully.</p>
      <div style="margin-top: 2rem; border-top: 1px solid #e5e7eb; padding-top: 1.5rem;">
        <a href="/api/health" style="display: inline-block; padding: 0.625rem 1.25rem; background-color: #004C54; color: white; text-decoration: none; border-radius: 0.375rem; font-weight: 500; transition: background-color 0.2s;">Check API Health</a>
      </div>
    </div>
  `);
});

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({ status: "ok", service: "JOTLayerRaid D1 API" });
});

// ── Mockup Template Routes ──────────────────────────────────────────────────

// 1. List Templates
app.get("/api/mockups/templates", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select().from(mockupTemplates);
  return c.json(result);
});

// 2. Create Template
app.post("/api/mockups/templates", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  
  const result = await db.insert(mockupTemplates).values({
    name: body.name,
    teamId: body.team_id || null,
    colorVariant: body.color_variant || null,
    fontConfig: JSON.stringify({
      font_id: null,
      size: 60,
      color: "#FFFFFF",
      outline_color: "#000000",
      outline_width: 2
    }),
    canvasJson: null,
    backgroundColor: "#e5e7eb"
  }).returning();

  return c.json(result[0]);
});

// 3. Get Template
app.get("/api/mockups/templates/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const result = await db.select().from(mockupTemplates).where(eq(mockupTemplates.id, id)).limit(1);
  
  if (result.length === 0) {
    return c.json({ error: "Template not found" }, 404);
  }

  const t = result[0]!;
  return c.json({
    ...t,
    font_config: t.fontConfig ? JSON.parse(t.fontConfig) : null,
    canvas_json: t.canvasJson ? JSON.parse(t.canvasJson) : null
  });
});

// 4. Update Template
app.put("/api/mockups/templates/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  const updates: any = {};
  if (body.canvas_json !== undefined) {
    updates.canvasJson = JSON.stringify(body.canvas_json);
  }
  if (body.font_config !== undefined) {
    updates.fontConfig = JSON.stringify(body.font_config);
  }
  if (body.background_color !== undefined) {
    updates.backgroundColor = body.background_color;
  }

  await db.update(mockupTemplates)
    .set(updates)
    .where(eq(mockupTemplates.id, id));

  const refreshed = await db.select().from(mockupTemplates).where(eq(mockupTemplates.id, id)).limit(1);
  return c.json(refreshed[0]);
});

// 5. Delete Template
app.delete("/api/mockups/templates/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  await db.delete(mockupTemplates).where(eq(mockupTemplates.id, id));
  return c.json({ deleted: true });
});

// 6. Upload Background File
app.post("/api/mockups/templates/:id/background", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const ext = file.name.split(".").pop() || "png";
  const key = `mockups/${id}/bg_${crypto.randomUUID()}.${ext}`;

  await uploadToR2(key, arrayBuffer, file.type, c.env);

  await db.update(mockupTemplates)
    .set({ originalImageUrl: key })
    .where(eq(mockupTemplates.id, id));

  return c.json({ message: "Background updated", image_url: key });
});

// 7. Serves Background directly from R2 (Avoid CORS issues in Fabric editor)
app.get("/api/mockups/templates/:id/background/download", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const result = await db.select().from(mockupTemplates).where(eq(mockupTemplates.id, id)).limit(1);

  if (result.length === 0 || !result[0]!.originalImageUrl) {
    return c.json({ error: "Background not found" }, 404);
  }

  const key = result[0]!.originalImageUrl;
  const object = await c.env.BUCKET.get(key);

  if (!object) {
    return c.json({ error: "File not found in storage" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  
  return new Response(object.body, { headers });
});

// 8. Retrieve Background CDN URL
app.get("/api/mockups/templates/:id/layers", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const result = await db.select().from(mockupTemplates).where(eq(mockupTemplates.id, id)).limit(1);

  if (result.length === 0) {
    return c.json({ error: "Template not found" }, 404);
  }

  const template = result[0]!;
  const layers: any = {};
  if (template.originalImageUrl) {
    const url = c.env.R2_PUBLIC_URL 
      ? `${c.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${template.originalImageUrl}`
      : `${new URL(c.req.url).origin}/api/mockups/templates/${id}/background/download`;
    layers.original = url;
  }

  return c.json({ template_id: id, layers });
});


// ── Bulk Job Routes ─────────────────────────────────────────────────────────

// 1. List Jobs
app.get("/api/bulk/jobs", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select()
    .from(bulkJobs)
    .orderBy(desc(bulkJobs.id));

  const jobsWithMeta = [];
  for (const j of result) {
    const firstItem = await db.select({
      templateName: mockupTemplates.name,
      teamName: teams.name
    })
    .from(bulkJobItems)
    .leftJoin(mockupTemplates, eq(bulkJobItems.mockupTemplateId, mockupTemplates.id))
    .leftJoin(teams, eq(mockupTemplates.teamId, teams.id))
    .where(eq(bulkJobItems.jobId, j.id))
    .limit(1);

    const meta = firstItem[0];

    jobsWithMeta.push({
      id: j.id,
      name: j.seoTemplate ? `${meta?.teamName || "Global"} Bulk Run` : `Bulk Job #${j.id}`,
      status: j.status,
      total: j.totalItems,
      done: j.completedItems,
      created: j.createdAt ? new Date(j.createdAt).toLocaleDateString() : "Unknown",
      store: j.storeTargets ? JSON.parse(j.storeTargets)[0]?.name || "None" : "None",
      team: meta?.teamName || "Global",
      template: meta?.templateName || "Unknown"
    });
  }

  return c.json(jobsWithMeta);
});

// GET Product Feed (for Astro/External storefronts to pull catalog data)
app.get("/api/feed/products", async (c) => {
  const db = drizzle(c.env.DB);
  const storeId = c.req.query("store_id");
  
  // Find all bulk job items that have completed rendering
  const items = await db.select({
    itemId: bulkJobItems.id,
    jobId: bulkJobItems.jobId,
    playerName: players.name,
    playerNumber: players.number,
    gender: bulkJobItems.gender,
    imageUrl: bulkJobItems.generatedImageUrl,
    productTitle: bulkJobItems.productTitle,
    description: bulkJobItems.productDescription,
    category: bulkJobItems.productCategory
  })
  .from(bulkJobItems)
  .innerJoin(players, eq(bulkJobItems.playerId, players.id))
  .where(eq(bulkJobItems.status, "done"))
  .orderBy(desc(bulkJobItems.id));

  // If a store_id filter is passed, we can filter based on the job's target store
  let filteredItems = items;
  if (storeId) {
    const targetStoreId = parseInt(storeId);
    const jobs = await db.select().from(bulkJobs);
    const validJobIds = new Set(
      jobs
        .filter(j => {
          try {
            const targets = j.storeTargets ? JSON.parse(j.storeTargets) : [];
            return targets.some((t: any) => t.store_id === targetStoreId);
          } catch {
            return false;
          }
        })
        .map(j => j.id)
    );
    filteredItems = items.filter(item => validJobIds.has(item.jobId));
  }

  // Format as standard product feed
  return c.json({
    status: "ok",
    total_products: filteredItems.length,
    products: filteredItems.map(item => ({
      id: item.itemId,
      title: item.productTitle || `${item.playerName} Jersey`,
      sku: `JRSY-${item.jobId}-${item.itemId}`,
      image_url: item.imageUrl,
      price: "29.99",
      category: item.category || "Jerseys",
      description: item.description || "",
      attributes: {
        player_name: item.playerName,
        player_number: item.playerNumber,
        gender: item.gender
      }
    }))
  });
});

// 2. Trigger Bulk Job
app.post("/api/bulk/jobs", async (c) => {
  const db = drizzle(c.env.DB);
  const req = await c.req.json();

  // Validate template exists
  const template = await db.select().from(mockupTemplates).where(eq(mockupTemplates.id, req.template_id)).limit(1);
  if (template.length === 0) {
    return c.json({ error: "Mockup template not found" }, 404);
  }

  // Determine genders from sizes list
  const selectedGenders = new Set<string>();
  for (const size of req.sizes || []) {
    const lower = size.toLowerCase();
    if (lower.includes("men")) selectedGenders.add("Men");
    else if (lower.includes("women")) selectedGenders.add("Women");
    else if (lower.includes("youth")) selectedGenders.add("Youth");
  }
  if (selectedGenders.size === 0) {
    selectedGenders.add("Men");
  }

  // Get store details
  const storeQuery = await db.select().from(stores).where(eq(stores.id, req.store_id)).limit(1);
  const store = storeQuery[0];
  const storeTargetsList = [{
    store_id: req.store_id,
    name: store ? store.name : "Store target",
    platform: store ? store.platform : "woocommerce"
  }];

  // Insert bulk job
  const jobResult = await db.insert(bulkJobs).values({
    status: "pending",
    totalItems: (req.player_ids || []).length * selectedGenders.size,
    completedItems: 0,
    failedItems: 0,
    storeTargets: JSON.stringify(storeTargetsList),
    seoTemplate: JSON.stringify({
      title_pattern: req.seo_title_pattern,
      description_pattern: req.seo_description_html,
      category_pattern: req.seo_category,
      tags_pattern: req.seo_tags,
      sizes: req.sizes
    }),
    createdAt: new Date().toISOString()
  }).returning();

  const bulkJob = jobResult[0]!;

  // Generate all items in "pending" status
  for (const playerId of req.player_ids || []) {
    for (const gender of selectedGenders) {
      await db.insert(bulkJobItems).values({
        jobId: bulkJob.id,
        playerId: playerId,
        mockupTemplateId: req.template_id,
        gender: gender,
        status: "pending"
      });
    }
  }

  // Push job trigger task to Cloudflare Queue
  await c.env.BULK_QUEUE.send({ jobId: bulkJob.id });

  return c.json({ message: "Bulk job triggered successfully", job_id: bulkJob.id }, 201);
});

// 3. Get Job Details
app.get("/api/bulk/jobs/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  
  const jobQuery = await db.select().from(bulkJobs).where(eq(bulkJobs.id, id)).limit(1);
  if (jobQuery.length === 0) {
    return c.json({ error: "Bulk job not found" }, 404);
  }

  const job = jobQuery[0]!;
  const items = await db.select().from(bulkJobItems).where(eq(bulkJobItems.jobId, id));

  const itemsMapped = [];
  for (const it of items) {
    const playerQuery = await db.select({ name: players.name })
      .from(players)
      .where(eq(players.id, it.playerId))
      .limit(1);
    
    itemsMapped.push({
      id: it.id,
      player_id: it.playerId,
      player_name: playerQuery[0]?.name || "Unknown",
      gender: it.gender,
      status: it.status,
      generated_image_url: it.generatedImageUrl,
      product_title: it.productTitle,
      error_message: it.errorMessage
    });
  }

  return c.json({
    id: job.id,
    status: job.status,
    total_items: job.totalItems,
    completed_items: job.completedItems,
    failed_items: job.failedItems,
    store_targets: job.storeTargets ? JSON.parse(job.storeTargets) : [],
    seo_template: job.seoTemplate ? JSON.parse(job.seoTemplate) : {},
    created_at: job.createdAt,
    completed_at: job.completedAt,
    items: itemsMapped
  });
});

// 4. Delete Bulk Job
app.delete("/api/bulk/jobs/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  
  await db.delete(bulkJobItems).where(eq(bulkJobItems.jobId, id));
  await db.delete(bulkJobs).where(eq(bulkJobs.id, id));
  
  return c.json({ deleted: id });
});


// ── Font & Patch Directory Routes ───────────────────────────────────────────

// 1. GET /api/fonts (list fonts, optionally filtered, joined with teams)
app.get("/api/fonts", async (c) => {
  const teamIdStr = c.req.query("team_id");
  const jerseyType = c.req.query("jersey_type");
  const db = drizzle(c.env.DB);
  
  let query = db.select({
    id: fonts.id,
    name: fonts.name,
    fileUrl: fonts.fileUrl,
    previewUrl: fonts.previewUrl,
    category: fonts.category,
    teamId: fonts.teamId,
    jerseyType: fonts.jerseyType,
    teamName: teams.name
  })
  .from(fonts)
  .leftJoin(teams, eq(fonts.teamId, teams.id));
  
  let conditions: any[] = [];
  if (teamIdStr) {
    conditions.push(
      or(
        eq(fonts.teamId, parseInt(teamIdStr)),
        isNull(fonts.teamId)
      )
    );
  }
  if (jerseyType && jerseyType !== "All") {
    conditions.push(eq(fonts.jerseyType, jerseyType));
  }
  
  let result: any[];
  if (conditions.length > 0) {
    result = await query.where(and(...conditions));
  } else {
    result = await query;
  }

  const baseUrl = new URL(c.req.url).origin;
  const r2PublicUrl = c.env.R2_PUBLIC_URL || "";

  return c.json(result.map(f => ({
    id: f.id,
    name: f.name,
    file_url: f.fileUrl ? (
      r2PublicUrl ? `${r2PublicUrl.replace(/\/$/, "")}/${f.fileUrl}` : `${baseUrl}/api/fonts/${f.id}/download`
    ) : "",
    preview_url: f.previewUrl,
    category: f.category,
    team_id: f.teamId,
    jersey_type: f.jerseyType,
    team_name: f.teamName
  })));
});

// 2. POST /api/fonts/upload (upload files to R2 and insert into DB)
app.post("/api/fonts/upload", async (c) => {
  const db = drizzle(c.env.DB);
  const formData = await c.req.parseBody();
  
  let category = (formData.category as string) || "NFL";
  let teamId = formData.team_id ? parseInt(formData.team_id as string) : null;
  let jerseyType = (formData.jersey_type as string) || null;
  
  let files: File[] = [];
  if (Array.isArray(formData.files)) {
    files = formData.files as File[];
  } else if (formData.files) {
    files = [formData.files as File];
  }
  
  const results: any[] = [];
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.split(".").pop()?.toLowerCase() || "ttf";
    const key = `fonts/${crypto.randomUUID()}.${ext}`;
    
    let contentType = "font/ttf";
    if (ext === "otf") {
      contentType = "font/otf";
    } else if (ext === "woff" || ext === "woff2") {
      contentType = `font/${ext}`;
    }
    
    await uploadToR2(key, arrayBuffer, contentType, c.env);
    
    const name = file.name.replace(/\.[^/.]+$/, "");
    
    const inserted = await db.insert(fonts).values({
      name: name,
      fileUrl: key,
      category: category,
      teamId: teamId && teamId > 0 ? teamId : null,
      jerseyType: jerseyType
    }).returning();
    
    results.push({
      id: inserted[0].id,
      name: name,
      file_url: key,
      team_id: teamId,
      jersey_type: jerseyType
    });
  }
  
  return c.json({ uploaded: results.length, fonts: results });
});

// 3. DELETE /api/fonts/:id (delete font from DB and R2)
app.delete("/api/fonts/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  
  const query = await db.select().from(fonts).where(eq(fonts.id, id)).limit(1);
  const font = query[0];
  if (font && font.fileUrl) {
    try {
      await deleteFromR2(font.fileUrl, c.env);
    } catch (err) {
      console.error("Failed to delete font from R2:", err);
    }
  }
  
  await db.delete(fonts).where(eq(fonts.id, id));
  return c.json({ deleted: id });
});

// 4. GET /api/fonts/:id/download (download font directly from R2 via worker to bypass CORS)
app.get("/api/fonts/:id/download", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  
  const query = await db.select().from(fonts).where(eq(fonts.id, id)).limit(1);
  const font = query[0];
  if (!font || !font.fileUrl) {
    return c.json({ error: "Font not found" }, 404);
  }
  
  const r2Object = await getFromR2(font.fileUrl, c.env);
  if (!r2Object) {
    return c.json({ error: "Font file not found in storage" }, 404);
  }
  
  return c.newResponse(r2Object.body, 200, {
    "Content-Type": r2Object.contentType,
    "Cache-Control": "public, max-age=31536000",
    "Access-Control-Allow-Origin": "*"
  });
});

// 1. GET /api/patches (list all patches)
app.get("/api/patches", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select().from(patches);
  return c.json(result);
});

// 2. POST /api/patches/upload (upload patch images to R2 and insert metadata)
app.post("/api/patches/upload", async (c) => {
  const db = drizzle(c.env.DB);
  const formData = await c.req.parseBody();
  
  let files: File[] = [];
  if (Array.isArray(formData.files)) {
    files = formData.files as File[];
  } else if (formData.files) {
    files = [formData.files as File];
  }
  
  const results: any[] = [];
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const key = `patches/${crypto.randomUUID()}.${ext}`;
    
    let contentType = "image/png";
    if (ext === "svg") {
      contentType = "image/svg+xml";
    } else if (ext === "webp") {
      contentType = "image/webp";
    } else if (ext === "jpg" || ext === "jpeg") {
      contentType = "image/jpeg";
    }
    
    await uploadToR2(key, arrayBuffer, contentType, c.env);
    
    const r2PublicUrl = c.env.R2_PUBLIC_URL || "";
    const baseUrl = new URL(c.req.url).origin;
    const finalUrl = r2PublicUrl 
      ? `${r2PublicUrl.replace(/\/$/, "")}/${key}`
      : `${baseUrl}/api/patches/download?key=${key}`;
      
    const name = file.name.replace(/\.[^/.]+$/, "");
    
    const inserted = await db.insert(patches).values({
      name: name,
      imageUrl: finalUrl,
      width: null,
      height: null
    }).returning();
    
    results.push({
      id: inserted[0].id,
      name: name,
      image_url: finalUrl
    });
  }
  
  return c.json({ uploaded: results.length, patches: results });
});

// 3. DELETE /api/patches/:id (delete patch from DB and R2)
app.delete("/api/patches/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  
  const query = await db.select().from(patches).where(eq(patches.id, id)).limit(1);
  const patch = query[0];
  if (patch && patch.imageUrl) {
    const keyMatch = patch.imageUrl.match(/patches\/[^?]+/);
    if (keyMatch) {
      try {
        await deleteFromR2(keyMatch[0], c.env);
      } catch (err) {
        console.error("Failed to delete patch from R2:", err);
      }
    }
  }
  
  await db.delete(patches).where(eq(patches.id, id));
  return c.json({ deleted: id });
});

// 4. GET /api/patches/download (download/serve patch file directly from R2)
app.get("/api/patches/download", async (c) => {
  const key = c.req.query("key");
  if (!key) {
    return c.json({ error: "Missing key parameter" }, 400);
  }
  
  const r2Object = await getFromR2(key, c.env);
  if (!r2Object) {
    return c.json({ error: "File not found" }, 404);
  }
  
  return c.newResponse(r2Object.body, 200, {
    "Content-Type": r2Object.contentType,
    "Cache-Control": "public, max-age=31536000",
    "Access-Control-Allow-Origin": "*"
  });
});

app.post("/api/oms/sync", async (c) => {
  const platform = c.req.query("platform");
  const result = await syncOrders(c.env, platform);
  return c.json(result);
});

// Webhook Receiver Helper for Astro Storefront
async function processAstroOrderWebhook(c: any) {
  const db = drizzle(c.env.DB);
  let body: any = null;
  try {
    body = await c.req.json();
  } catch (_) {}

  if (body && (body.order_id || body.id || body.customer_name || body.product_name)) {
    const storeId = body.store_id || body.storeId || "Vulius";
    const orderId = String(body.order_id || body.id || body.orderId || `VUL-${Date.now()}`);
    const orderName = String(body.order_name || body.orderName || orderId);
    const customerName = body.customer_name || body.customerName || "Customer";
    const customerAddress = body.customer_address || body.customerAddress || "No Address Provided";
    const customerEmail = body.customer_email || body.customerEmail || "";
    const productName = body.product_name || body.productName || "Vulius Custom Jersey";
    const productImage = body.product_image || body.productImage || "";
    const quantity = parseInt(body.quantity || "1", 10);
    const variant = body.variant || "";
    const variantValue = body.variant_value || body.variantValue || "";
    const revenue = parseFloat(body.revenue || "89.99");
    const cost = parseFloat(body.cost || "22.00");
    const shippingStatus = body.shipping_status || body.shippingStatus || "placed";
    const trackingNumber = body.tracking_number || body.trackingNumber || "";

    const inserted = await db.insert(orders).values({
      storeId,
      orderId,
      orderName,
      customerName,
      customerAddress,
      customerEmail,
      productName,
      productImage,
      quantity,
      variant,
      variantValue,
      revenue,
      cost,
      shippingStatus,
      trackingNumber,
      emailSent: false,
      trackingEmailSent: false,
      createdAt: body.created_at || new Date().toISOString(),
      syncedAt: new Date().toISOString()
    })
    .onConflictDoUpdate({
      target: [orders.storeId, orders.orderId, orders.productName, orders.variant],
      set: {
        customerName,
        customerAddress,
        customerEmail,
        quantity,
        revenue,
        cost,
        variantValue,
        syncedAt: new Date().toISOString()
      }
    })
    .returning();

    if (productName) {
      try {
        await db.insert(syncedProducts).values({
          name: productName,
          platformProductId: body.product_id || body.productId || `prod_${Date.now()}`,
          platform: "astro",
          imageUrl: productImage,
          price: revenue,
          sku: body.sku || body.product_slug || "AST-SKU",
          createdAt: new Date().toISOString()
        });
      } catch (_) {}
    }

    return c.json({ status: "ok", message: "Astro order received and stored.", order: mapOrderToSnakeCase(inserted[0]) });
  }

  c.executionCtx.waitUntil(syncOrders(c.env, "astro"));
  return c.json({ status: "ok", message: "Astro sync triggered in background." });
}

// Order Created Webhook Receivers
app.post("/api/oms/webhook/woocommerce", async (c) => {
  c.executionCtx.waitUntil(syncOrders(c.env, "woocommerce"));
  return c.json({ status: "ok", message: "WooCommerce sync triggered instantly." });
});

app.post("/api/oms/webhook/woocommerce/order-created", async (c) => {
  c.executionCtx.waitUntil(syncOrders(c.env, "woocommerce"));
  return c.json({ status: "ok", message: "WooCommerce sync triggered instantly." });
});

app.post("/api/oms/webhook/shopbase", async (c) => {
  c.executionCtx.waitUntil(syncOrders(c.env, "shopbase"));
  return c.json({ status: "ok", message: "ShopBase sync triggered instantly." });
});

app.post("/api/oms/webhook/shopbase/order-created", async (c) => {
  c.executionCtx.waitUntil(syncOrders(c.env, "shopbase"));
  return c.json({ status: "ok", message: "ShopBase sync triggered instantly." });
});

app.post("/api/oms/webhook/astro", async (c) => processAstroOrderWebhook(c));
app.post("/api/oms/webhook/astro/order-created", async (c) => processAstroOrderWebhook(c));

// ── Order Management Routes ──────────────────────────────────────────────────

// Helper function to map camelCase D1 orders to snake_case for Next.js frontend compatibility
function mapOrderToSnakeCase(o: any) {
  if (!o) return o;
  return {
    id: o.id,
    store_id: o.storeId,
    order_id: o.orderId,
    order_name: o.orderName,
    customer_name: o.customerName,
    customer_address: o.customerAddress,
    customer_email: o.customerEmail,
    product_name: o.productName,
    product_image: o.productImage,
    quantity: o.quantity,
    variant: o.variant,
    variant_value: o.variantValue,
    revenue: o.revenue,
    cost: o.cost,
    shipping_status: o.shippingStatus,
    tracking_number: o.trackingNumber,
    email_sent: o.emailSent,
    tracking_email_sent: o.trackingEmailSent,
    created_at: o.createdAt,
    synced_at: o.syncedAt
  };
}

// Helper function to map camelCase D1 tickets to snake_case for Next.js frontend compatibility
function mapTicketToSnakeCase(t: any) {
  if (!t) return t;
  return {
    id: t.id,
    customer_name: t.customerName,
    customer_email: t.customerEmail,
    subject: t.subject,
    message: t.message,
    status: t.status,
    replies: t.replies,
    recipient_email: t.recipientEmail,
    tags: t.tags,
    snoozed_until: t.snoozedUntil,
    created_at: t.createdAt
  };
}

// 1. Get orders list with search and filters
app.get("/api/oms/orders", async (c) => {
  const db = drizzle(c.env.DB);
  const platform = c.req.query("platform");
  const shippingStatus = c.req.query("shipping_status");
  const search = c.req.query("search");
  const searchField = c.req.query("search_field") || "all";
  const startDate = c.req.query("start_date");
  const endDate = c.req.query("end_date");

  const conditions = [];

  if (platform) {
    if (platform.toLowerCase() === "woo") {
      conditions.push(like(orders.storeId, "%WooCommerce%"));
    } else if (platform.toLowerCase() === "sb") {
      conditions.push(like(orders.storeId, "%ShopBase%"));
    } else {
      conditions.push(like(orders.storeId, `%${platform}%`));
    }
  }

  if (shippingStatus) {
    conditions.push(eq(orders.shippingStatus, shippingStatus.toLowerCase()));
  }

  if (search) {
    const searchFilter = `%${search}%`;
    const sf = searchField.toLowerCase();
    
    if (sf === "order_id") {
      conditions.push(like(orders.orderId, searchFilter));
    } else if (sf === "customer_name") {
      conditions.push(like(orders.customerName, searchFilter));
    } else if (sf === "customer_email") {
      conditions.push(like(orders.customerEmail, searchFilter));
    } else if (sf === "product_name") {
      conditions.push(like(orders.productName, searchFilter));
    } else {
      conditions.push(
        or(
          like(orders.customerName, searchFilter),
          like(orders.orderId, searchFilter),
          like(orders.customerEmail, searchFilter),
          like(orders.productName, searchFilter)
        )
      );
    }
  }

  if (startDate) {
    conditions.push(gte(orders.createdAt, startDate));
  }

  if (endDate) {
    try {
      const d = new Date(endDate);
      d.setDate(d.getDate() + 1);
      conditions.push(lt(orders.createdAt, d.toISOString().split("T")[0]!));
    } catch (_) {}
  }

  let q = db.select().from(orders);
  
  if (conditions.length > 0) {
    // @ts-ignore
    q = q.where(and(...conditions));
  }

  const results = await q.orderBy(desc(orders.createdAt));
  return c.json(results.map(mapOrderToSnakeCase));
});

// Create new order & link synced product
app.post("/api/oms/orders", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  const storeId = body.store_id || body.storeId || "Vulius";
  const orderId = body.order_id || body.orderId || `VUL-${Date.now()}`;
  const orderName = body.order_name || body.orderName || orderId;
  const customerName = body.customer_name || body.customerName || "Customer";
  const customerAddress = body.customer_address || body.customerAddress || "No Address Provided";
  const customerEmail = body.customer_email || body.customerEmail || "";
  const productName = body.product_name || body.productName || "Custom Jersey";
  const productImage = body.product_image || body.productImage || "";
  const quantity = parseInt(body.quantity || "1", 10);
  const variant = body.variant || "";
  const variantValue = body.variant_value || body.variantValue || "";
  const revenue = parseFloat(body.revenue || "0");
  const cost = parseFloat(body.cost || "0") || (revenue * 0.3);
  const shippingStatus = body.shipping_status || body.shippingStatus || "placed";
  const trackingNumber = body.tracking_number || body.trackingNumber || "";
  const createdAt = body.created_at || body.createdAt || new Date().toISOString();

  const newOrder = {
    storeId,
    orderId,
    orderName,
    customerName,
    customerAddress,
    customerEmail,
    productName,
    productImage,
    quantity,
    variant,
    variantValue,
    revenue,
    cost,
    shippingStatus,
    trackingNumber,
    emailSent: false,
    trackingEmailSent: false,
    createdAt,
    syncedAt: new Date().toISOString()
  };

  const inserted = await db.insert(orders).values(newOrder)
    .onConflictDoUpdate({
      target: [orders.storeId, orders.orderId, orders.productName, orders.variant],
      set: {
        customerName,
        customerAddress,
        customerEmail,
        quantity,
        revenue,
        cost,
        shippingStatus,
        trackingNumber,
        variantValue,
        syncedAt: new Date().toISOString()
      }
    })
    .returning();

  if (productName) {
    try {
      await db.insert(syncedProducts).values({
        name: productName,
        platformProductId: body.product_id || body.productId || `prod_${Date.now()}`,
        platform: "vulius",
        imageUrl: productImage,
        price: revenue,
        sku: body.product_slug || body.sku || "VUL-JERSEY",
        createdAt: new Date().toISOString()
      });
    } catch (_) {}
  }

  return c.json({ success: true, order: mapOrderToSnakeCase(inserted[0] || newOrder) });
});

// Image proxy endpoint to bypass CORS for excel exports
app.get("/api/oms/proxy-image", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.text("Missing url query parameter", 400);
  try {
    const res = await fetch(url);
    if (!res.ok) return c.text("Failed to fetch image", res.status);
    const contentType = res.headers.get("content-type") || "image/png";
    const body = await res.arrayBuffer();
    return c.body(body, 200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400"
    });
  } catch (err) {
    return c.text("Error proxying image", 500);
  }
});

// 2. Update order logistics details
app.put("/api/oms/orders/:order_id/update", async (c) => {
  const orderId = c.req.param("order_id");
  const body = await c.req.json();
  const db = drizzle(c.env.DB);

  const originalOrders = await db.select().from(orders).where(eq(orders.orderId, orderId));
  if (originalOrders.length === 0) {
    return c.json({ error: `No orders found with ID: ${orderId}` }, 404);
  }

  const trackingNumber = body.tracking_number;
  const shippingStatus = body.shipping_status;
  const emailSent = body.email_sent;
  const newOrderId = body.order_id;
  const customerName = body.customer_name;
  const customerAddress = body.customer_address;
  const customerEmail = body.customer_email;

  for (const order of originalOrders) {
    const oldTracking = order.trackingNumber;
    
    const updates: any = {};
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (shippingStatus !== undefined) updates.shippingStatus = shippingStatus.toLowerCase();
    if (emailSent !== undefined) updates.emailSent = Boolean(emailSent);
    if (customerName !== undefined) updates.customerName = customerName;
    if (customerAddress !== undefined) updates.customerAddress = customerAddress;
    if (customerEmail !== undefined) updates.customerEmail = customerEmail;
    if (body.variant !== undefined) updates.variant = body.variant;
    if (body.variant_value !== undefined) updates.variantValue = body.variant_value;

    // Send email logic if tracking number updated
    if (trackingNumber && trackingNumber !== oldTracking && !order.trackingEmailSent) {
      try {
        const storeIdLower = (order.storeId || "").toLowerCase();
        let fromEmail = "contact@vulius.com";
        let fromName = "Vulius Support";
        const subject = `Great news! Your order #${order.orderId} has been shipped`;
        
        let bodyHtml = "";
        if (storeIdLower.includes("vulius")) {
          bodyHtml = `<p>Your order #${order.orderId} from Vulius has been shipped! Tracking number: <b>${trackingNumber}</b></p>`;
        } else {
          fromEmail = "contact@wairaiders.com";
          fromName = "WaiRaiders Support";
          bodyHtml = `<p>Your order #${order.orderId} from WaiRaiders has been shipped! Tracking number: <b>${trackingNumber}</b></p>`;
        }
        
        if (order.customerEmail) {
          c.executionCtx.waitUntil(
            sendOutboundEmail(order.customerEmail, subject, bodyHtml, fromEmail, fromName, c.env)
          );
        }
        updates.trackingEmailSent = true;
      } catch (err) {
        console.error("Error sending tracking email:", err);
      }
    }

    await db.update(orders).set(updates).where(eq(orders.id, order.id));
  }

  if (newOrderId !== undefined && newOrderId !== orderId) {
    await db.update(orders).set({ orderId: newOrderId }).where(eq(orders.orderId, orderId));
  }

  return c.json({ status: "ok", message: `Successfully updated details for order ${orderId}.` });
});

// 3. Delete order
app.delete("/api/oms/orders/:order_id", async (c) => {
  const orderId = c.req.param("order_id");
  const db = drizzle(c.env.DB);
  await db.delete(orders).where(eq(orders.orderId, orderId));
  return c.json({ status: "ok", message: `Successfully deleted order ${orderId}.` });
});

// 4. Create resend order
app.post("/api/oms/orders/:order_id/resend", async (c) => {
  const orderId = c.req.param("order_id");
  const db = drizzle(c.env.DB);

  const baseOrderId = orderId.replace(/\s+RS\s*\(\d+\)$/, "").trim();

  const originalItems = await db.select().from(orders).where(eq(orders.orderId, orderId));
  if (originalItems.length === 0) {
    return c.json({ error: `No orders found to resend with ID: ${orderId}` }, 404);
  }

  const existingOrders = await db.select().from(orders).where(like(orders.orderId, `${baseOrderId}%`));

  let maxResend = 0;
  for (const o of existingOrders) {
    const oid = o.orderId || "";
    if (oid === baseOrderId) continue;
    const match = oid.match(/RS\s*\((\d+)\)$/);
    if (match && match[1]) {
      const val = parseInt(match[1]);
      if (val > maxResend) {
        maxResend = val;
      }
    }
  }

  const nextResend = maxResend + 1;
  const newOrderId = `${baseOrderId} RS (${nextResend})`;

  for (const item of originalItems) {
    await db.insert(orders).values({
      storeId: item.storeId,
      orderId: newOrderId,
      orderName: newOrderId.replace("#", "").trim(),
      customerName: item.customerName,
      customerAddress: item.customerAddress,
      customerEmail: item.customerEmail,
      productName: item.productName,
      productImage: item.productImage,
      quantity: item.quantity,
      variant: item.variant,
      variantValue: item.variantValue,
      revenue: item.revenue,
      cost: item.cost,
      shippingStatus: "placed",
      trackingNumber: "",
      emailSent: false,
      createdAt: new Date().toISOString(),
      syncedAt: new Date().toISOString()
    });
  }

  return c.json({ status: "ok", new_order_id: newOrderId });
});

// ── Financials & Profit & Loss (P&L) Reporting ──────────────────────────────

// 1. Get P&L Financial Report for a Year
app.get("/api/oms/financials/report", async (c) => {
  try {
    const yearParam = c.req.query("year");
    const rateParam = c.req.query("exchange_rate");
    const currentYear = new Date().getFullYear();
    const year = yearParam ? parseInt(yearParam, 10) : currentYear;
    const exchangeRate = rateParam ? parseFloat(rateParam) : undefined;

    const report = await generatePLReport(c.env.DB, year, exchangeRate);
    return c.json(report);
  } catch (err: any) {
    console.error("Error generating P&L report:", err);
    return c.json({ error: err.message || "Failed to generate P&L report" }, 500);
  }
});

// 2. Get Financial Transactions (List & Filter)
app.get("/api/oms/financials/transactions", async (c) => {
  try {
    const type = c.req.query("type");
    const category = c.req.query("category");
    const year = c.req.query("year") ? parseInt(c.req.query("year")!, 10) : undefined;
    const month = c.req.query("month") ? parseInt(c.req.query("month")!, 10) : undefined;
    const debtStatus = c.req.query("debt_status");
    const search = c.req.query("search");
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : 100;
    const offset = c.req.query("offset") ? parseInt(c.req.query("offset")!, 10) : 0;

    const transactions = await getFinancialTransactions(c.env.DB, {
      type,
      category,
      year,
      month,
      debtStatus,
      search,
      limit,
      offset
    });
    return c.json(transactions);
  } catch (err: any) {
    console.error("Error fetching financial transactions:", err);
    return c.json({ error: err.message || "Failed to fetch transactions" }, 500);
  }
});

// 3. Create Financial Transaction (Cost, Revenue, Debt)
app.post("/api/oms/financials/transactions", async (c) => {
  try {
    const body = await c.req.json();
    const result = await createFinancialTransaction(c.env.DB, {
      type: body.type,
      category: body.category,
      amount: parseFloat(body.amount || 0),
      inputCurrency: body.input_currency || body.inputCurrency || "VND",
      exchangeRate: body.exchange_rate || body.exchangeRate ? parseFloat(body.exchange_rate || body.exchangeRate) : undefined,
      transactionDate: body.transaction_date || body.transactionDate,
      note: body.note,
      event: body.event,
      imageProofUrl: body.image_proof_url || body.imageProofUrl,
      isRecurring: Boolean(body.is_recurring ?? body.isRecurring),
      repeatFrequency: body.repeat_frequency || body.repeatFrequency || "none",
      repeatUntil: body.repeat_until || body.repeatUntil,
      isExcludedFromReport: Boolean(body.is_excluded_from_report ?? body.isExcludedFromReport),
      debtStatus: body.debt_status || body.debtStatus,
      debtCounterparty: body.debt_counterparty || body.debtCounterparty,
      debtDueDate: body.debt_due_date || body.debtDueDate
    });
    return c.json({ status: "ok", transaction: result });
  } catch (err: any) {
    console.error("Error creating financial transaction:", err);
    return c.json({ error: err.message || "Failed to create transaction" }, 500);
  }
});

// 4. Update Financial Transaction
app.put("/api/oms/financials/transactions/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    const body = await c.req.json();
    const result = await updateFinancialTransaction(c.env.DB, id, {
      type: body.type,
      category: body.category,
      amount: body.amount !== undefined ? parseFloat(body.amount) : undefined,
      inputCurrency: body.input_currency || body.inputCurrency,
      exchangeRate: body.exchange_rate || body.exchangeRate ? parseFloat(body.exchange_rate || body.exchangeRate) : undefined,
      transactionDate: body.transaction_date || body.transactionDate,
      note: body.note,
      event: body.event,
      imageProofUrl: body.image_proof_url || body.imageProofUrl,
      isRecurring: body.is_recurring !== undefined ? Boolean(body.is_recurring) : (body.isRecurring !== undefined ? Boolean(body.isRecurring) : undefined),
      repeatFrequency: body.repeat_frequency || body.repeatFrequency,
      repeatUntil: body.repeat_until || body.repeatUntil,
      isExcludedFromReport: body.is_excluded_from_report !== undefined ? Boolean(body.is_excluded_from_report) : (body.isExcludedFromReport !== undefined ? Boolean(body.isExcludedFromReport) : undefined),
      debtStatus: body.debt_status || body.debtStatus,
      debtCounterparty: body.debt_counterparty || body.debtCounterparty,
      debtDueDate: body.debt_due_date || body.debtDueDate
    });
    return c.json({ status: "ok", transaction: result });
  } catch (err: any) {
    console.error("Error updating transaction:", err);
    return c.json({ error: err.message || "Failed to update transaction" }, 500);
  }
});

// 5. Delete Financial Transaction
app.delete("/api/oms/financials/transactions/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    const result = await deleteFinancialTransaction(c.env.DB, id);
    return c.json(result);
  } catch (err: any) {
    console.error("Error deleting transaction:", err);
    return c.json({ error: err.message || "Failed to delete transaction" }, 500);
  }
});

// 6. Upload Receipt / Image Proof to R2
app.post("/api/oms/financials/upload-proof", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.split(".").pop() || "png";
    const key = `receipts/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const contentType = file.type || "image/png";
    const url = await uploadToR2(c.env, key, arrayBuffer, contentType);
    return c.json({ status: "ok", url, key });
  } catch (err: any) {
    console.error("Error uploading receipt proof:", err);
    return c.json({ error: err.message || "Failed to upload receipt proof" }, 500);
  }
});

// 7. Get & Update Financial Settings
app.get("/api/oms/financials/settings", async (c) => {
  try {
    await initFinancialTables(c.env.DB);
    const db = drizzle(c.env.DB);
    const settings = await db.select().from(financialSettings).limit(1);
    return c.json(settings[0] || { defaultExchangeRate: 26000.0, companyName: "Just One Tee Group" });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to get settings" }, 500);
  }
});

app.put("/api/oms/financials/settings", async (c) => {
  try {
    await initFinancialTables(c.env.DB);
    const db = drizzle(c.env.DB);
    const body = await c.req.json();
    const defaultExchangeRate = body.default_exchange_rate || body.defaultExchangeRate || 26000.0;
    const companyName = body.company_name || body.companyName || "Just One Tee Group";

    await db
      .insert(financialSettings)
      .values({
        id: 1,
        defaultExchangeRate: parseFloat(defaultExchangeRate),
        companyName,
        updatedAt: new Date().toISOString()
      })
      .onConflictDoUpdate({
        target: financialSettings.id,
        set: {
          defaultExchangeRate: parseFloat(defaultExchangeRate),
          companyName,
          updatedAt: new Date().toISOString()
        }
      });

    return c.json({ status: "ok", defaultExchangeRate, companyName });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update settings" }, 500);
  }
});

// 8. Debt Summary Tracker
app.get("/api/oms/financials/debts", async (c) => {
  try {
    const summary = await getDebtSummary(c.env.DB);
    return c.json(summary);
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to get debt summary" }, 500);
  }
});

// 9. Categories List
app.get("/api/oms/financials/categories", async (c) => {
  return c.json({ categories: DEFAULT_CATEGORIES });
});

// ── WeChat Logistics & PDF Tracking Extraction ──────────────────────────────

// 1. Upload WeChat PDF Shipping Labels & Extract / Auto-Match
app.post("/api/oms/wechat/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return c.json({ error: "No PDF files provided." }, 400);
    }

    const db = drizzle(c.env.DB);
    const allDbOrders = await db
      .select({
        id: orders.id,
        orderId: orders.orderId,
        orderName: orders.orderName,
        customerName: orders.customerName,
        customerEmail: orders.customerEmail,
        customerAddress: orders.customerAddress,
        productName: orders.productName,
        quantity: orders.quantity,
        variant: orders.variant,
        trackingNumber: orders.trackingNumber,
        shippingStatus: orders.shippingStatus,
        createdAt: orders.createdAt,
      })
      .from(orders);

    const results = [];
    for (const fileItem of files) {
      if (typeof fileItem === "object" && "arrayBuffer" in fileItem) {
        const file = fileItem as File;
        const filename = file.name || "label.pdf";
        const buffer = await file.arrayBuffer();
        const extractedList = await extractFromPdfBuffer(buffer, filename);
        for (const extracted of extractedList) {
          const match = matchLabelWithOrders(extracted, allDbOrders);
          results.push(match);
        }
      }
    }

    return c.json(results);
  } catch (err: any) {
    console.error("Error in /api/oms/wechat/upload:", err);
    return c.json({ error: "Failed to process WeChat PDF labels", detail: err?.message || String(err) }, 500);
  }
});

// 2. Scan WeChat Folder Fallback
app.post("/api/oms/wechat/scan", async (c) => {
  return c.json(
    {
      error: "Local desktop folder scan is only available in local agent mode. Please use the Drag & Drop PDF uploader to upload your WeChat PDF labels directly."
    },
    400
  );
});

// 3. Synchronize Matched Tracking Numbers & Dispatch Shipping Announcement Emails
app.post("/api/oms/wechat/sync", async (c) => {
  try {
    const body = await c.req.json();
    const items: Array<{ order_id: string | number; tracking_number: string }> = Array.isArray(body)
      ? body
      : [body];

    if (!items || items.length === 0) {
      return c.json({ error: "No matches provided to sync." }, 400);
    }

    const db = drizzle(c.env.DB);
    let updatedOrdersCount = 0;
    const notifiedEmails: string[] = [];

    for (const item of items) {
      if (!item.order_id || !item.tracking_number) continue;

      let matchedOrders: any[] = [];
      const numericId = typeof item.order_id === "number" ? item.order_id : parseInt(String(item.order_id), 10);

      if (!isNaN(numericId)) {
        // Try finding by internal database ID
        matchedOrders = await db.select().from(orders).where(eq(orders.id, numericId));
      }

      if (matchedOrders.length === 0) {
        // Try finding by orderId string
        matchedOrders = await db.select().from(orders).where(eq(orders.orderId, String(item.order_id)));
      }

      if (matchedOrders.length === 0) continue;

      const trackingNum = item.tracking_number.trim();
      const firstOrder = matchedOrders[0];

      // If the matched order has an orderId, update all line items sharing that orderId
      if (firstOrder.orderId) {
        matchedOrders = await db.select().from(orders).where(eq(orders.orderId, firstOrder.orderId));
      }

      // Update all matching order records in D1
      for (const ord of matchedOrders) {
        await db
          .update(orders)
          .set({
            trackingNumber: trackingNum,
            shippingStatus: "in transit",
            trackingEmailSent: true,
            emailSent: true,
          })
          .where(eq(orders.id, ord.id));
      }

      updatedOrdersCount++;

      // Dispatch Shipping Announcement Email to customer
      if (firstOrder.customerEmail && !notifiedEmails.includes(firstOrder.customerEmail.toLowerCase())) {
        try {
          const storeIdLower = (firstOrder.storeId || "").toLowerCase();
          let fromEmail = "contact@vulius.com";
          let fromName = "Vulius Support";
          let brandName = "Vulius";

          if (!storeIdLower.includes("vulius")) {
            fromEmail = "contact@wairaiders.com";
            fromName = "WaiRaiders Support";
            brandName = "WaiRaiders";
          }

          const orderNumDisplay = firstOrder.orderId || firstOrder.id;
          const subject = `Great news! Your order #${orderNumDisplay} has been shipped 🚀`;
          const track17Url = `https://www.17track.net/en/track?nums=${encodeURIComponent(trackingNum)}`;

          const bodyHtml = `
            <p>Dear ${firstOrder.customerName || "Valued Customer"},</p>
            <p>Great news! Your order <strong>#${orderNumDisplay}</strong> from <strong>${brandName}</strong> has been shipped and is now on its way.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Carrier Tracking Number</p>
              <p style="margin: 0; font-size: 18px; font-weight: bold; font-family: 'Courier New', Courier, monospace; color: #0f172a;">${trackingNum}</p>
            </div>
            <p>You can track the live delivery progress of your package on 17Track:</p>
            <p style="margin: 16px 0;">
              <a href="${track17Url}" target="_blank" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Track Package on 17Track &rarr;</a>
            </p>
            <p style="margin-top: 24px; font-size: 13px; color: #64748b;">If you have any questions or need assistance, simply reply directly to this email.</p>
          `;

          c.executionCtx.waitUntil(
            sendOutboundEmail(firstOrder.customerEmail, subject, bodyHtml, fromEmail, fromName, c.env)
          );

          notifiedEmails.push(firstOrder.customerEmail.toLowerCase());
        } catch (mailErr) {
          console.error(`Failed to dispatch shipping announcement email for order ${firstOrder.orderId}:`, mailErr);
        }
      }
    }

    return c.json({
      success: true,
      count: updatedOrdersCount,
      message: `Successfully synchronized ${updatedOrdersCount} order(s) to "in transit" and dispatched shipping announcement emails.`
    });
  } catch (err: any) {
    console.error("Error in /api/oms/wechat/sync:", err);
    return c.json({ error: "Failed to sync WeChat tracking numbers", detail: err?.message || String(err) }, 500);
  }
});

// ── Store Connection Routes ──────────────────────────────────────────────────

// 1. List connected stores
app.get("/api/stores", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select().from(stores);
  return c.json(result.map(s => ({
    id: s.id,
    name: s.name,
    platform: s.platform,
    url: s.url,
    webhook_url: s.webhookUrl || (s.platform?.toLowerCase() === "astro" ? "https://api-worker.justoneteeteam.workers.dev/api/oms/webhook/astro" : null),
    is_active: s.isActive,
    apiKey: s.apiKey ? `${s.apiKey.slice(0, 3)}••••••` : "••••••",
    apiSecret: "••••••",
    last_synced_at: s.lastSyncedAt,
    created_at: s.createdAt
  })));
});

// 2. Create a new store connection
app.post("/api/stores", async (c) => {
  const db = drizzle(c.env.DB);
  let body: any = {};
  try {
    body = await c.req.json();
  } catch (e) {
    try {
      body = await c.req.parseBody();
    } catch (e2) {}
  }
  
  const platform = (body.platform || "woocommerce").toLowerCase();
  const webhookUrl = body.webhook_url || body.webhookUrl || (platform === "astro" ? "https://api-worker.justoneteeteam.workers.dev/api/oms/webhook/astro" : null);
  const apiKey = body.api_key || (platform === "astro" ? `astro_${Date.now()}` : "");
  const apiSecret = body.api_secret || (platform === "astro" ? `astro_sec_${Date.now()}` : "");

  const result = await db.insert(stores).values({
    name: body.name,
    platform: platform,
    url: (body.url || "").replace(/\/$/, ""),
    apiKey: apiKey,
    apiSecret: apiSecret,
    webhookUrl: webhookUrl,
    isActive: true,
    createdAt: new Date().toISOString()
  }).returning();

  const s = result[0];
  return c.json({
    id: s?.id,
    name: s?.name,
    platform: s?.platform,
    webhook_url: s?.webhookUrl
  });
});

// 3. Update store credentials
app.put("/api/stores/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  const updates: any = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.url !== undefined) updates.url = body.url.replace(/\/$/, "");
  if (body.api_key !== undefined) updates.apiKey = body.api_key;
  if (body.api_secret !== undefined) updates.apiSecret = body.api_secret;
  if (body.webhook_url !== undefined) updates.webhookUrl = body.webhook_url;
  if (body.webhookUrl !== undefined) updates.webhookUrl = body.webhookUrl;

  await db.update(stores)
    .set(updates)
    .where(eq(stores.id, id));

  return c.json({ updated: id });
});

// 4. Delete store connection
app.delete("/api/stores/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  await db.delete(stores).where(eq(stores.id, id));
  return c.json({ deleted: id });
});

// 5. Test unsaved store credentials
app.post("/api/stores/test-credentials", async (c) => {
  const body = await c.req.json();
  const plat = body.platform.toLowerCase();
  
  if (!body.url || !body.api_key || !body.api_secret) {
    return c.json({ error: "Missing required parameters" }, 400);
  }
  
  return c.json({
    status: "ok",
    platform: plat,
    message: `Connection to ${body.platform} at ${body.url} verified successfully.`
  });
});

// 6. Test connection to a store's API
app.post("/api/stores/:id/test", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const result = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
  
  if (result.length === 0) {
    return c.json({ error: "Store not found" }, 404);
  }
  
  const store = result[0]!;
  return c.json({
    status: "ok",
    platform: store.platform,
    message: `Connection to ${store.name} (${store.platform}) successful`
  });
});

// 7. Trigger product sync for a store
app.post("/api/stores/:id/sync", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const result = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
  
  if (result.length === 0) {
    return c.json({ error: "Store not found" }, 404);
  }
  
  const store = result[0]!;
  
  // Trigger order sync immediately
  await syncOrders(c.env);
  
  await db.update(stores)
    .set({
      lastSyncedAt: new Date().toISOString(),
      isActive: true
    })
    .where(eq(stores.id, id));
    
  return c.json({
    status: "ok",
    message: `Sync triggered for ${store.name}`,
    synced_at: new Date().toISOString()
  });
});

app.post("/api/oms/settings/email", async (c) => {
  const payload = await c.req.json();
  await c.env.FONTS_CACHE_KV.put("email_settings", JSON.stringify(payload));
  return c.json({ status: "ok" });
});

// ── OMS Ticket & Customer Routes ──────────────────────────────────────────────

// Helper to send outbound emails via Cloudflare API
async function sendOutboundEmail(
  toEmail: string, 
  subject: string, 
  bodyText: string, 
  fromEmail: string, 
  fromName: string, 
  env: any
): Promise<boolean> {
  let accountId = env.CLOUDFLARE_ACCOUNT_ID;
  let apiToken = env.CLOUDFLARE_API_TOKEN;

  try {
    const raw = await env.FONTS_CACHE_KV.get("email_settings");
    if (raw) {
      const settings = JSON.parse(raw);
      if (settings.cloudflare_account_id) accountId = settings.cloudflare_account_id;
      if (settings.cloudflare_api_token) apiToken = settings.cloudflare_api_token;
    }
  } catch (err) {
    console.error("Error reading email settings from KV in sendOutboundEmail:", err);
  }

  if (!accountId || !apiToken) {
    console.error("Cloudflare sending credentials missing.");
    return false;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #f97316; margin: 0; font-size: 20px; font-weight: bold;">JOT Support Logistics</h2>
      </div>
      <div style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-line;">
        ${bodyText}
      </div>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; text-align: center; color: #94a3b8; font-size: 12px;">
        This email was sent automatically from the JOT Logistics Dashboard.
      </div>
    </div>
  `;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: toEmail,
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        subject: subject,
        text: bodyText,
        html: htmlBody
      })
    });
    
    if (res.ok) {
      const data = await res.json() as any;
      if (data.success) {
        console.log(`Email successfully sent to ${toEmail}`);
        return true;
      }
    }
    console.error("Cloudflare Email API failed:", await res.text());
    return false;
  } catch (e) {
    console.error("Error sending email:", e);
    return false;
  }
}

// 1. Get tickets
app.get("/api/oms/tickets", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  return c.json(result.map(mapTicketToSnakeCase));
});

// 2. Get customer profile
app.get("/api/oms/customers/:email", async (c) => {
  const email = c.req.param("email").trim().toLowerCase();
  const db = drizzle(c.env.DB);

  const customerOrders = await db.select().from(orders).where(eq(orders.customerEmail, email)).orderBy(desc(orders.createdAt));
  const customerTickets = await db.select().from(tickets).where(eq(tickets.customerEmail, email)).orderBy(desc(tickets.createdAt));

  const totalSpent = customerOrders.reduce((sum, o) => sum + (o.revenue || 0), 0);

  return c.json({
    email: email,
    name: customerOrders[0]?.customerName || "Customer",
    address: customerOrders[0]?.customerAddress || "",
    platform: customerOrders[0]?.storeId || "",
    total_spent: Math.round(totalSpent * 100) / 100,
    orders: customerOrders.map(mapOrderToSnakeCase),
    tickets: customerTickets.map(mapTicketToSnakeCase)
  });
});

// 3. Update ticket (PATCH)
app.patch("/api/oms/tickets/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  const updates: any = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.snoozed_until !== undefined) updates.snoozedUntil = body.snoozed_until;

  await db.update(tickets)
    .set(updates)
    .where(eq(tickets.id, id));

  return c.json({ status: "ok" });
});

// 3.5. Create new ticket manually (Freshdesk style)
app.post("/api/oms/tickets/new", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const customerEmail = (body.customer_email || "").trim().toLowerCase();
  const customerName = (body.customer_name || "").trim();
  const recipientEmail = (body.recipient_email || "").trim().toLowerCase(); // Chosen store support email
  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();

  if (!customerEmail || !customerName || !recipientEmail || !subject || !message) {
    return c.json({ error: "Missing required fields: customer_email, customer_name, recipient_email, subject, message" }, 400);
  }

  // Fetch store identity name from db to use in outbound "from" header
  let fromName = "Support";
  try {
    const sendersList = await db.select()
      .from(emailSenderIdentities)
      .where(eq(emailSenderIdentities.fromEmail, recipientEmail))
      .limit(1);
    const firstSender = sendersList[0];
    if (firstSender) {
      fromName = firstSender.fromName;
    }
  } catch (e) {
    console.error("Error looking up sender identity name:", e);
  }

  // Send initial email to the customer
  const sent = await sendOutboundEmail(customerEmail, subject, message, recipientEmail, fromName, c.env);
  if (!sent) {
    return c.json({ error: "Failed to dispatch email. Check Cloudflare account settings in configuration dashboard." }, 500);
  }

  const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) + " " + new Date().toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" });
  const creationNote = `[Support Agent | ${nowTime} via System] Created ticket manually and sent initial email.`;

  // Create new ticket row
  const result = await db.insert(tickets).values({
    customerName,
    customerEmail,
    subject,
    message: `[Manually Created Support Ticket]\n\n${message}`,
    status: "open",
    replies: JSON.stringify([creationNote]),
    recipientEmail,
    tags: "manual",
    createdAt: new Date().toISOString()
  }).returning();

  const newTicket = result[0];

  // Notify via Telegram channel
  const escapedSnippet = message.slice(0, 300).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const telegramMessage = `➕ <b>[New Manual Ticket #${newTicket.id}]</b>\n` +
    `<b>To Customer:</b> ${customerName} (${customerEmail})\n` +
    `<b>Sent From:</b> ${fromName} (${recipientEmail})\n` +
    `<b>Subject:</b> ${subject}\n\n` +
    `<blockquote>${escapedSnippet}</blockquote>\n\n` +
    `👉 <a href="https://jot-layer-raid-web.pages.dev/oms/tickets">Open Support Dashboard</a>`;
  
  c.executionCtx.waitUntil(notifyTelegram(telegramMessage, c.env));

  return c.json({ status: "ok", ticket: newTicket });
});

// 4. Reply to ticket
app.post("/api/oms/tickets/:id/reply", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  const activeTickets = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  const ticket = activeTickets[0];
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const status = body.status || "pending";
  const replyMsg = body.message || "";
  const fromEmail = body.from_email || "contact@vulius.com";

  let repliesList: string[] = [];
  if (ticket.replies) {
    try {
      repliesList = JSON.parse(ticket.replies);
    } catch (e) {
      repliesList = [];
    }
  }

  if (replyMsg.trim()) {
    const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) + " " + new Date().toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" });
    const formattedReply = `[Support Agent | ${nowTime} via ${fromEmail}] ${replyMsg}`;
    repliesList.push(formattedReply);

    // Send real email asynchronously via Cloudflare REST API
    const subjectLine = ticket.subject ? `Re: ${ticket.subject}` : "Update regarding your support ticket";
    c.executionCtx.waitUntil(
      sendOutboundEmail(ticket.customerEmail, subjectLine, replyMsg, fromEmail, "Vulius Support", c.env)
    );
  }

  await db.update(tickets)
    .set({
      status: status,
      replies: JSON.stringify(repliesList)
    })
    .where(eq(tickets.id, id));

  // Mark all orders matching customer email as emailSent = true
  await db.update(orders)
    .set({ emailSent: true })
    .where(eq(orders.customerEmail, ticket.customerEmail));

  return c.json({ status: "ok", message: `Reply successfully sent to ${ticket.customerEmail} and status updated to ${status}.` });
});

// ── Inbound Support Email Webhook Route ──────────────────────────────────────

function checkIsSpam(sender: string, subject: string, bodyText: string, hasOrders: boolean): boolean {
  if (hasOrders) return false;
  
  const text = (subject + " " + bodyText).toLowerCase();
  const spamKeywords = [
    "trustpilot", "seo audit", "marketing services", "boost your rankings", 
    "increase your sales", "digital marketing", "cooperation", "partnership proposal", 
    "we can help your brand", "guest post", "sponsored post", "link building", 
    "improve your website", "came across your business", "researching companies", 
    "schedule a call", "book a demo"
  ];
  
  return spamKeywords.some(kw => text.includes(kw));
}

async function notifyTelegram(message: string, env: any) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
  } catch (e) {
    console.error("Failed to dispatch Telegram alert:", e);
  }
}

app.post("/api/oms/webhook/email/inbound", async (c) => {
  const db = drizzle(c.env.DB);
  const secret = c.req.query("secret");
  const expectedSecret = c.env.INBOUND_EMAIL_SECRET || "JOT_INGESTION_SECRET";
  
  if (secret !== expectedSecret) {
    return c.json({ error: "Unauthorized: Invalid ingestion secret." }, 401);
  }

  const payload = await c.req.json();
  const sender = payload.sender?.trim().toLowerCase();
  const senderName = payload.sender_name || (sender ? sender.split("@")[0] : "Customer");
  const recipient = payload.recipient;
  const subject = payload.subject || "Support Inquiry";
  const bodyText = payload.body_text || "";

  if (!sender || !bodyText) {
    return c.json({ error: "Invalid payload: Sender and body_text are required." }, 400);
  }

  const existingTickets = await db.select()
    .from(tickets)
    .where(
      and(
        eq(tickets.customerEmail, sender),
        or(eq(tickets.status, "open"), eq(tickets.status, "pending"))
      )
    )
    .orderBy(desc(tickets.createdAt))
    .limit(1);

  const existingTicket = existingTickets[0];

  if (existingTicket) {
    let repliesList: string[] = [];
    if (existingTicket.replies) {
      try {
        repliesList = JSON.parse(existingTicket.replies);
      } catch (e) {
        repliesList = [];
      }
    }

    const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) + " " + new Date().toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" });
    const continuationMsg = `[Customer Reply | ${nowTime}] ${bodyText}`;
    repliesList.push(continuationMsg);

    await db.update(tickets)
      .set({
        replies: JSON.stringify(repliesList),
        status: "open",
        recipientEmail: existingTicket.recipientEmail || recipient
      })
      .where(eq(tickets.id, existingTicket.id));

    const escapedSnippet = bodyText.slice(0, 300).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const telegramMessage = `💬 <b>[Ticket #${existingTicket.id} Update - Customer Reply]</b>\n` +
      `<b>From:</b> ${senderName} (${sender})\n` +
      `<b>Subject:</b> ${subject}\n\n` +
      `<blockquote>${escapedSnippet}</blockquote>\n\n` +
      `👉 <a href="https://jot-layer-raid-web.pages.dev/oms/tickets">Open Support Dashboard</a>`;
    c.executionCtx.waitUntil(notifyTelegram(telegramMessage, c.env));

    // ── AI Draft Generation for Customer Reply on Existing Ticket ──
    if (!checkIsSpam(sender, subject, bodyText, true) && isShippingInquiry(subject, bodyText)) {
      c.executionCtx.waitUntil(
        handleAiDraftReply(existingTicket.id, sender, senderName, bodyText, subject, c.env)
      );
    }

    return c.json({
      status: "success",
      message: `Appended message to active support ticket ID ${existingTicket.id}.`,
      ticket_id: existingTicket.id
    });
  } else {
    const customerOrders = await db.select()
      .from(orders)
      .where(eq(orders.customerEmail, sender))
      .limit(1);
    
    const hasOrders = customerOrders.length > 0;
    const isSpam = checkIsSpam(sender, subject, bodyText, hasOrders);

    const result = await db.insert(tickets).values({
      customerName: senderName,
      customerEmail: sender,
      subject: subject,
      message: bodyText,
      status: isSpam ? "spam" : "open",
      replies: "[]",
      recipientEmail: recipient,
      tags: isSpam ? "spam" : "",
      createdAt: new Date().toISOString()
    }).returning();

    const newTicket = result[0]!;

    const escapedSnippet = bodyText.slice(0, 300).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const telegramMessage = `📥 <b>[New Support Ticket #${newTicket.id}]</b>\n` +
      `<b>From:</b> ${senderName} (${sender})\n` +
      `<b>Subject:</b> ${subject}\n\n` +
      `<blockquote>${escapedSnippet}</blockquote>\n\n` +
      `👉 <a href="https://jot-layer-raid-web.pages.dev/oms/tickets">Open Support Dashboard</a>`;
    c.executionCtx.waitUntil(notifyTelegram(telegramMessage, c.env));

    // ── AI Draft Generation for New Inbound Ticket ──
    if (!isSpam && isShippingInquiry(subject, bodyText)) {
      c.executionCtx.waitUntil(
        handleAiDraftReply(newTicket.id, sender, senderName, bodyText, subject, c.env)
      );
    }

    return c.json({
      status: "success",
      message: `Created new support ticket ID ${newTicket.id} from customer inbound email.`,
      ticket_id: newTicket.id
    });
  }
});

// ── Email Sender & Marketing Routes ──────────────────────────────────────────

// 1. List email senders
app.get("/api/marketing/senders", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select().from(emailSenderIdentities);
  return c.json(result.map(s => ({
    id: s.id,
    store_id: s.storeId,
    provider: s.provider,
    from_name: s.fromName,
    from_email: s.fromEmail,
    reply_to_email: s.replyToEmail,
    domain: s.domain,
    status: s.status,
    created_at: s.createdAt
  })));
});

// 2. Create or update email sender
app.post("/api/marketing/senders", async (c) => {
  const db = drizzle(c.env.DB);
  const payload = await c.req.json();
  
  const senderId = payload.id;
  const storeId = payload.store_id;
  const provider = payload.provider;
  const fromName = payload.from_name;
  const fromEmail = payload.from_email;
  const replyToEmail = payload.reply_to_email;
  const domain = payload.domain;
  const providerConfigRef = payload.provider_config_ref; // API key reference

  if (!storeId || !provider || !fromEmail || !domain) {
    return c.json({ error: "Missing required sender identity parameters." }, 400);
  }

  if (senderId) {
    await db.update(emailSenderIdentities)
      .set({
        storeId,
        provider,
        fromName,
        fromEmail,
        replyToEmail,
        domain,
        status: "active",
        providerConfigRef,
      })
      .where(eq(emailSenderIdentities.id, senderId));
  } else {
    await db.insert(emailSenderIdentities).values({
      storeId,
      provider,
      fromName,
      fromEmail,
      replyToEmail,
      domain,
      status: "active",
      providerConfigRef,
      createdAt: new Date().toISOString()
    });
  }

  return c.json({ status: "ok", message: "Sender identity configuration saved." });
});

// 3. Delete email sender
app.delete("/api/marketing/senders/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  await db.delete(emailSenderIdentities).where(eq(emailSenderIdentities.id, id));
  return c.json({ status: "ok", message: "Sender configuration removed." });
});

// ── Outbound Email Marketing Routes (Contacts, Templates, Campaigns) ─────────

// 4. Scan Single Email for Deliverability & Spam Traps
app.post("/api/marketing/scan-email", async (c) => {
  const body = await c.req.json();
  const email = body.email || "";
  const scan = await scanEmail(email);
  return c.json({
    email,
    is_valid: scan.isValid,
    reason: scan.reason || null
  });
});

// 5. List Marketing Contacts (supports pagination & store filtering)
app.get("/api/marketing/contacts", async (c) => {
  try {
    await initMarketingTables(c.env.DB);
    const db = drizzle(c.env.DB);

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const storeId = c.req.query("store_id");
    const offset = (page - 1) * limit;

    let query = db.select().from(marketingContacts);
    if (storeId && storeId !== "all") {
      query = query.where(eq(marketingContacts.storeId, storeId)) as any;
    }

    const allContacts = await query;
    const total = allContacts.length;
    const validCount = allContacts.filter(c => c.isValid).length;
    const invalidCount = total - validCount;

    const paginated = allContacts.slice(offset, offset + limit).map(c => ({
      id: c.id,
      store_id: c.storeId,
      email: c.email,
      first_name: c.firstName,
      last_name: c.lastName,
      consent_status: c.consentStatus,
      consent_source: c.consentSource,
      is_valid: Boolean(c.isValid),
      validation_note: c.validationNote,
      created_at: c.createdAt
    }));

    if (c.req.query("page") || c.req.query("limit")) {
      return c.json({
        contacts: paginated,
        total,
        valid_count: validCount,
        invalid_count: invalidCount,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      });
    }

    return c.json(paginated);
  } catch (err: any) {
    console.error("Error in GET /api/marketing/contacts:", err);
    return c.json({ error: err?.message || String(err), contacts: [], total: 0 }, 500);
  }
});

// 6. Bulk Sync / Import Marketing Contacts (with built-in email validity scanner)
app.post("/api/marketing/contacts/sync", async (c) => {
  try {
    const body = await c.req.json();
    const contactsList = body.contacts || [];
    const storeId = body.store_id || "WaiRaiders Store";

    if (!Array.isArray(contactsList) || contactsList.length === 0) {
      return c.json({ error: "Missing or empty contacts list" }, 400);
    }

    const result = await syncMarketingContacts(c.env.DB, contactsList, storeId);
    return c.json(result);
  } catch (err: any) {
    console.error("Error in POST /api/marketing/contacts/sync:", err);
    return c.json({ error: err?.message || String(err), created: 0, updated: 0, invalid: 0, scan_results: [] }, 500);
  }
});

// 7. Delete Marketing Contact
app.delete("/api/marketing/contacts/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const db = drizzle(c.env.DB);
  await db.delete(marketingContacts).where(eq(marketingContacts.id, id));
  return c.json({ status: "ok", message: "Contact removed" });
});

// 8. List Email Templates
app.get("/api/marketing/templates", async (c) => {
  await initMarketingTables(c.env.DB);
  const db = drizzle(c.env.DB);
  let result = await db.select().from(emailTemplates);
  
  // Auto-seed default WaiRaiders templates if none exist
  if (result.length === 0) {
    const defaultTemplates = [
      {
        name: "🏈 WaiRaiders Custom Jersey Showcase & League Hub",
        subject: "Customize Your Ultimate Game Jersey | Wairaiders Special",
        storeId: "WaiRaiders Store",
        bodyHtml: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Customize Your Ultimate Game Jersey | Wairaiders</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F6F8; font-family: sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F4F6F8; padding: 20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0;">
          <tr>
            <td style="background-color: #004F2A; padding: 18px 24px; text-align: center;">
              <span style="font-size: 22px; font-weight: 900; color: #FFFFFF;">wairaiders</span>
            </td>
          </tr>
          <tr>
            <td style="background: #006A38; padding: 32px 20px; text-align: center; color: #FFFFFF;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; text-transform: uppercase;">DESIGN YOUR ULTIMATE GAME DAY JERSEY</h1>
              <p style="margin: 8px 0 20px 0; font-size: 14px; opacity: 0.9;">Custom Name & Number &bull; Moisture Wicking &bull; Only $84.00</p>
              <div style="background: #FFFFFF; border-radius: 8px; padding: 16px; max-width: 320px; margin: 0 auto; border: 2px solid #FFB800;">
                <img src="https://img.btdmp.com/10205/10205680/products/gexdembvgxCdamjygmCtgnrrgexdambqgaxdknjygxBtsobtguAdqnzzgexdooi.jpeg" alt="Custom Jersey" style="width: 100%; max-height: 240px; object-fit: contain; display: block; margin-bottom: 12px;" />
                <a href="https://www.wairaiders.com/custom-nfl-jersey/" target="_blank" style="display: block; background: #CC0000; color: #FFFFFF; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-weight: 800; font-size: 13px; text-transform: uppercase;">CUSTOMIZE YOURS NOW &rarr;</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 20px; text-align: center; background: #FFFFFF;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; text-transform: uppercase; color: #0F172A;">Featured Team Jerseys</h2>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="48%" valign="top" style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center;">
                    <img src="https://img.btdmp.com/10205/10205680/products/gexdembvgxCdamjygmCtgnrrgexdambqgaxdknjygxBtsobtguAdqnzzgexdooi.jpeg" alt="Chiefs Jersey" style="width: 100%; max-height: 160px; object-fit: contain; margin-bottom: 8px;" />
                    <div style="font-weight: 800; font-size: 13px; color: #0F172A;">Kansas City Chiefs Custom</div>
                    <div style="font-size: 14px; font-weight: 900; color: #006A38; margin: 4px 0 8px 0;">$84.00</div>
                    <a href="https://www.wairaiders.com/custom-kansas-city-chiefs-jersey/" target="_blank" style="display: inline-block; background: #006A38; color: #FFFFFF; padding: 6px 12px; border-radius: 4px; font-size: 11px; text-decoration: none; font-weight: 700;">Customize &rarr;</a>
                  </td>
                  <td width="4%">&nbsp;</td>
                  <td width="48%" valign="top" style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center;">
                    <img src="https://img.thesitebase.net/10205/10205680/products/1708326833357.jpg" alt="Cowboys Jersey" style="width: 100%; max-height: 160px; object-fit: contain; margin-bottom: 8px;" />
                    <div style="font-weight: 800; font-size: 13px; color: #0F172A;">Dallas Cowboys Custom</div>
                    <div style="font-size: 14px; font-weight: 900; color: #006A38; margin: 4px 0 8px 0;">$84.00</div>
                    <a href="https://www.wairaiders.com/custom-cowboys-jersey/" target="_blank" style="display: inline-block; background: #006A38; color: #FFFFFF; padding: 6px 12px; border-radius: 4px; font-size: 11px; text-decoration: none; font-weight: 700;">Customize &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #004F2A; padding: 20px; text-align: center; color: #FFFFFF; font-size: 11px;">
              &copy; 2026 Wairaiders Pro Athletics &bull; <a href="https://www.wairaiders.com/" target="_blank" style="color: #FFB800;">wairaiders.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
      },
      {
        name: "🚀 WaiRaiders Shipping & Live Tracking Announcement",
        subject: "Great news! Your custom jersey has shipped 🚀 | WaiRaiders",
        storeId: "WaiRaiders Store",
        bodyHtml: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#F4F6F8;"><div style="max-width:600px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;"><h2>Your Order is on the Way!</h2><p>Your custom jersey has been crafted and is currently in transit with live carrier tracking.</p></div></body></html>`
      },
      {
        name: "👀 WaiRaiders Abandoned Cart Recovery (10% OFF)",
        subject: "Did you leave your custom jersey behind? Take 10% OFF!",
        storeId: "WaiRaiders Store",
        bodyHtml: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#F4F6F8;"><div style="max-width:600px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;"><h2>Complete Your Order</h2><p>Use code <strong>FINISH10</strong> for 10% off!</p></div></body></html>`
      }
    ];

    for (const dt of defaultTemplates) {
      await db.insert(emailTemplates).values({
        name: dt.name,
        subject: dt.subject,
        storeId: dt.storeId,
        bodyHtml: dt.bodyHtml,
        createdAt: new Date().toISOString()
      });
    }

    result = await db.select().from(emailTemplates);
  }

  return c.json(result.map(t => ({
    id: t.id,
    store_id: t.storeId,
    name: t.name,
    subject: t.subject,
    body_html: t.bodyHtml,
    created_at: t.createdAt
  })));
});

// 9. Create or Update Email Template
app.post("/api/marketing/templates", async (c) => {
  await initMarketingTables(c.env.DB);
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  if (!body.name || !body.subject || !body.body_html) {
    return c.json({ error: "Missing required template fields (name, subject, body_html)" }, 400);
  }

  if (body.id) {
    await db.update(emailTemplates).set({
      name: body.name,
      subject: body.subject,
      bodyHtml: body.body_html,
      storeId: body.store_id || "WaiRaiders Store"
    }).where(eq(emailTemplates.id, body.id));
    return c.json({ status: "ok", id: body.id, message: "Template updated" });
  } else {
    const res = await db.insert(emailTemplates).values({
      name: body.name,
      subject: body.subject,
      bodyHtml: body.body_html,
      storeId: body.store_id || "WaiRaiders Store",
      createdAt: new Date().toISOString()
    }).returning();
    return c.json({ status: "ok", id: res[0]?.id, message: "Template created" });
  }
});

// 10. Delete Email Template
app.delete("/api/marketing/templates/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const db = drizzle(c.env.DB);
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  return c.json({ status: "ok", message: "Template removed" });
});

// 11. List Marketing Campaigns
app.get("/api/marketing/campaigns", async (c) => {
  await initMarketingTables(c.env.DB);
  const db = drizzle(c.env.DB);
  const result = await db.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.id));
  const senders = await db.select().from(emailSenderIdentities);

  const senderMap = new Map(senders.map(s => [s.id, s]));

  return c.json(result.map(cmp => {
    const sender = cmp.senderIdentityId ? senderMap.get(cmp.senderIdentityId) : null;
    return {
      id: cmp.id,
      name: cmp.name,
      subject: cmp.subject,
      body_html: cmp.bodyHtml,
      store_id: cmp.storeId,
      sender_identity_id: cmp.senderIdentityId,
      sender_name: sender?.fromName || null,
      sender_email: sender?.fromEmail || null,
      status: cmp.status,
      sent_count: cmp.sentCount,
      total_contacts: cmp.totalContacts,
      daily_limit: cmp.dailyLimit || 20,
      scheduled_at: cmp.scheduledAt,
      created_at: cmp.createdAt
    };
  }));
});

// 12. Create or Update Marketing Campaign
app.post("/api/marketing/campaigns", async (c) => {
  await initMarketingTables(c.env.DB);
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  if (!body.name || !body.subject || !body.body_html) {
    return c.json({ error: "Missing required campaign fields (name, subject, body_html)" }, 400);
  }

  const senderId = body.sender_identity_id ? parseInt(body.sender_identity_id, 10) : null;
  const dailyLimit = body.daily_limit ? parseInt(body.daily_limit, 10) : 20;

  if (body.id) {
    await db.update(marketingCampaigns).set({
      name: body.name,
      subject: body.subject,
      bodyHtml: body.body_html,
      storeId: body.store_id || "WaiRaiders Store",
      senderIdentityId: senderId,
      dailyLimit,
      scheduledAt: body.scheduled_at || null
    }).where(eq(marketingCampaigns.id, body.id));
    return c.json({ status: "ok", id: body.id, message: "Campaign updated" });
  } else {
    const res = await db.insert(marketingCampaigns).values({
      name: body.name,
      subject: body.subject,
      bodyHtml: body.body_html,
      storeId: body.store_id || "WaiRaiders Store",
      senderIdentityId: senderId,
      status: body.scheduled_at ? "scheduled" : "draft",
      sentCount: 0,
      totalContacts: 0,
      dailyLimit,
      scheduledAt: body.scheduled_at || null,
      createdAt: new Date().toISOString()
    }).returning();
    return c.json({ status: "ok", id: res[0]?.id, message: "Campaign created" });
  }
});

// 13. Trigger Campaign Send (Drip Batch)
app.post("/api/marketing/campaigns/:id/send", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  try {
    const result = await sendCampaignDripBatch(c.env, id);
    return c.json({
      message: `Dispatched ${result.sent} emails (${result.failed} failed, ${result.suppressed} suppressed). Remaining in queue: ${result.remaining}`,
      ...result
    });
  } catch (err: any) {
    console.error(`Error sending campaign ${id}:`, err);
    return c.json({ error: err.message || "Failed to trigger campaign send" }, 500);
  }
});

// 14. Pause or Resume Campaign Drip
app.post("/api/marketing/campaigns/:id/pause", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await initMarketingTables(c.env.DB);
  const db = drizzle(c.env.DB);

  const campaign = (await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id)).limit(1))[0];
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const nextStatus = campaign.status === "sending" ? "paused" : "sending";
  await db.update(marketingCampaigns).set({ status: nextStatus }).where(eq(marketingCampaigns.id, id));

  return c.json({ status: nextStatus, message: `Campaign status changed to ${nextStatus}` });
});

// 15. Get Campaign Stats & Audit Trail
app.get("/api/marketing/campaigns/:id/stats", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await initMarketingTables(c.env.DB);
  const db = drizzle(c.env.DB);

  const campaign = (await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id)).limit(1))[0];
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  const sends = await db.select().from(campaignSends).where(eq(campaignSends.campaignId, id)).orderBy(desc(campaignSends.id)).limit(100);

  const sentCount = sends.filter(s => s.status === "sent").length;
  const failedCount = sends.filter(s => s.status === "failed").length;
  const suppressedCount = sends.filter(s => s.status === "suppressed").length;

  return c.json({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    daily_limit: campaign.dailyLimit || 20,
    total_contacts: campaign.totalContacts,
    sent: campaign.sentCount || sentCount,
    failed: failedCount,
    suppressed: suppressedCount,
    remaining: Math.max(0, (campaign.totalContacts || 0) - (campaign.sentCount || sentCount)),
    recent_sends: sends.slice(0, 20)
  });
});

// 16. Delete Marketing Campaign
app.delete("/api/marketing/campaigns/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const db = drizzle(c.env.DB);
  await db.delete(campaignSends).where(eq(campaignSends.campaignId, id));
  await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
  return c.json({ status: "ok", message: "Campaign deleted" });
});

// ── Database & Roster Endpoints (Teams, Players, CSV Import) ───────────────────

// 1. List teams with player counts
app.get("/api/database/teams", async (c) => {
  const db = drizzle(c.env.DB);
  
  const allTeams = await db.select().from(teams);
  const allPlayers = await db.select().from(players);
  
  const playerCountMap: Record<number, number> = {};
  allPlayers.forEach(p => {
    if (p.teamId) {
      playerCountMap[p.teamId] = (playerCountMap[p.teamId] || 0) + 1;
    }
  });

  return c.json(allTeams.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    league_id: t.leagueId,
    player_count: playerCountMap[t.id] || 0
  })));
});

// 2. List players for a specific team
app.get("/api/database/teams/:id/players", async (c) => {
  const teamId = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const result = await db.select().from(players).where(eq(players.teamId, teamId));
  
  return c.json(result.map(p => ({
    id: p.id,
    name: p.name,
    display_name: p.displayName,
    number: p.number,
    type: p.type,
    group: p.group,
    is_active: p.isActive
  })));
});

// 3. Update player
app.put("/api/database/players/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  
  const updates: any = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.display_name !== undefined) updates.displayName = body.display_name;
  if (body.number !== undefined) updates.number = body.number;
  if (body.type !== undefined) updates.type = body.type;
  if (body.group !== undefined) updates.group = body.group;
  if (body.is_active !== undefined) updates.isActive = body.is_active;

  await db.update(players)
    .set(updates)
    .where(eq(players.id, id));

  const updatedPlayer = await db.select().from(players).where(eq(players.id, id)).limit(1);
  const p = updatedPlayer[0];
  if (!p) {
    return c.json({ error: "Player not found" }, 404);
  }
  
  return c.json({
    status: "ok",
    player: {
      id: p.id,
      name: p.name,
      display_name: p.displayName,
      number: p.number,
      type: p.type,
      group: p.group,
      is_active: p.isActive
    }
  });
});

// 4. Delete player
app.delete("/api/database/players/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  await db.delete(players).where(eq(players.id, id));
  return c.json({ status: "ok", deleted: true });
});

// 5. Import players & teams
app.post("/api/database/import", async (c) => {
  const db = drizzle(c.env.DB);
  const payload = await c.req.json();
  const leagueSlug = (payload.league || "NFL").toLowerCase();

  let leagueId = 1;
  try {
    const existingLeagues = await db.select().from(leagues).where(eq(leagues.slug, leagueSlug)).limit(1);
    if (existingLeagues.length > 0) {
      leagueId = existingLeagues[0].id;
    } else {
      const newLeague = await db.insert(leagues).values({
        name: payload.league || "NFL",
        slug: leagueSlug
      }).returning();
      leagueId = newLeague[0].id;
    }
  } catch (e) {
    console.error("League selection failed (defaulting to 1):", e);
  }

  const stats = { teams_created: 0, teams_updated: 0, players_created: 0, players_updated: 0 };

  for (const teamData of payload.teams) {
    const teamName = teamData.name;
    const slug = teamName.toLowerCase().replace(/\s+/g, "-");
    
    let teamQuery = await db.select()
      .from(teams)
      .where(
        or(
          eq(teams.name, teamName),
          eq(teams.slug, slug)
        )
      )
      .limit(1);

    if (teamQuery.length === 0) {
      const allTeamsList = await db.select().from(teams);
      const matchedTeam = allTeamsList.find(t => {
        const n1 = t.name.toLowerCase();
        const n2 = teamName.toLowerCase();
        if (n1.includes(n2) || n2.includes(n1)) return true;
        const w1 = n1.split(/\s+/).pop();
        const w2 = n2.split(/\s+/).pop();
        if (w1 && w2 && (w1 === w2 || w1 === w2 + "s" || w2 === w1 + "s")) return true;
        return false;
      });
      if (matchedTeam) {
        teamQuery = [matchedTeam];
      }
    }

    let teamId: number;
    if (teamQuery.length === 0) {
      const newTeam = await db.insert(teams).values({
        name: teamName,
        slug: slug,
        leagueId: leagueId
      }).returning();
      teamId = newTeam[0].id;
      stats.teams_created++;
    } else {
      teamId = teamQuery[0].id;
      stats.teams_updated++;
    }

    for (const p of teamData.players) {
      const displayName = p.display_name || p.name.toUpperCase();
      
      const existingPlayer = await db.select()
        .from(players)
        .where(
          and(
            eq(players.teamId, teamId),
            eq(players.name, p.name),
            eq(players.number, p.number)
          )
        )
        .limit(1);

      if (existingPlayer.length > 0) {
        await db.update(players)
          .set({
            name: p.name,
            displayName: displayName,
            type: p.type || "Current",
            group: p.group || "Football"
          })
          .where(eq(players.id, existingPlayer[0].id));
        stats.players_updated++;
      } else {
        await db.insert(players).values({
          teamId: teamId,
          name: p.name,
          displayName: displayName,
          number: p.number,
          type: p.type || "Current",
          group: p.group || "Football",
          isActive: true
        });
        stats.players_created++;
      }
    }
  }

  return c.json({ status: "ok", stats });
});

// ── OMS Email Settings Routes (stored in KV) ─────────────────────────────────

const DEFAULT_EMAIL_SETTINGS = {
  sender_email: "customer@justonetee.org",
  keywords: "shipping status, tracking, track, status, where is my order",
  template_subject: "Instant AI Update regarding your order {order_id}",
  template_body: "Hi {customer_name},\n\n[Instant AI Update] This is an automated update regarding your order {order_id}.\nYour logistics shipping status is currently: {shipping_status}.\nTracking Number: {tracking_number}.\n\nYou can track your package directly on 17track here:\nhttps://www.17track.net/en/track?nums={tracking_number}\n\nThis response was triggered instantly by the JOT AI CRM rules engine.",
  auto_reply_enabled: true,
  ai_auto_reply_enabled: true,
  cloudflare_account_id: "",
  cloudflare_api_token: ""
};

app.get("/api/oms/settings/email", async (c) => {
  try {
    const raw = await c.env.FONTS_CACHE_KV.get("email_settings");
    if (raw) {
      return c.json(JSON.parse(raw));
    }
  } catch (err) {
    console.error("Error reading email settings from KV:", err);
  }
  return c.json(DEFAULT_EMAIL_SETTINGS);
});

app.post("/api/oms/settings/email", async (c) => {
  const payload = await c.req.json();
  await c.env.FONTS_CACHE_KV.put("email_settings", JSON.stringify(payload));
  return c.json({ status: "ok" });
});

// ── AI Email Compose Endpoint (On-demand AI Drafting) ─────────────────────────
app.post("/api/oms/ai/compose-reply", async (c) => {
  const body = await c.req.json();
  const customerEmail = body.customer_email || body.email;
  const customerName = body.customer_name || body.name;
  const message = body.message || body.ticket_message || "";
  const subject = body.subject || "";

  if (!customerEmail) {
    return c.json({ error: "customer_email is required" }, 400);
  }

  const result = await composeShippingReply(c.env, customerEmail, customerName, message, subject);
  return c.json(result);
});


// ── Cloudflare Queue Consumer Handler ──────────────────────────────────────────

async function uploadMediaToWordPress(
  storeUrl: string,
  apiKey: string,
  apiSecret: string,
  imageBuffer: ArrayBuffer,
  filename: string
): Promise<string> {
  const cleanUrl = storeUrl.trim().replace(/\/$/, "");
  const authStr = btoa(`${apiKey}:${apiSecret}`);
  
  const response = await fetch(`${cleanUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authStr}`,
      "Content-Disposition": `attachment; filename=${filename}`,
      "Content-Type": "image/png"
    },
    body: imageBuffer
  });
  
  if (response.status !== 201) {
    throw new Error(`WordPress media library upload failed (Status ${response.status}): ${await response.text()}`);
  }
  
  const data = await response.json() as any;
  return data.source_url;
}

async function createWooCommerceProduct(
  storeUrl: string,
  apiKey: string,
  apiSecret: string,
  title: string,
  price: string,
  descriptionHtml: string,
  imageUrl: string,
  sizes: string[]
): Promise<number> {
  const cleanUrl = storeUrl.trim().replace(/\/$/, "");
  const authStr = btoa(`${apiKey}:${apiSecret}`);
  
  const attributes = [];
  if (sizes.length > 0) {
    attributes.push({
      "name": "Size",
      "position": 0,
      "visible": true,
      "variation": true,
      "options": sizes.map(s => s.replace("Men ", "").replace("Women ", "").replace("Youth ", ""))
    });
  }

  const payload = {
    "name": title,
    "type": sizes.length > 0 ? "variable" : "simple",
    "regular_price": sizes.length === 0 ? price : "",
    "description": descriptionHtml,
    "short_description": "Premium tailored jersey mockup product.",
    "attributes": attributes,
    "images": imageUrl ? [{"src": imageUrl}] : []
  };

  const response = await fetch(`${cleanUrl}/wp-json/wc/v3/products`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authStr}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (response.status !== 201) {
    throw new Error(`WooCommerce product creation failed (Status ${response.status}): ${await response.text()}`);
  }

  const productData = await response.json() as any;
  const productId = productData.id;

  if (sizes.length > 0 && productId) {
    for (const size of sizes) {
      const cleanSize = size.replace("Men ", "").replace("Women ", "").replace("Youth ", "");
      const variationPayload = {
        "regular_price": price,
        "attributes": [{"name": "Size", "option": cleanSize}],
        "image": imageUrl ? {"src": imageUrl} : undefined
      };
      
      const vResponse = await fetch(`${cleanUrl}/wp-json/wc/v3/products/${productId}/variations`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authStr}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(variationPayload)
      });
      
      if (vResponse.status !== 201) {
        console.error(`Failed to create variation '${cleanSize}' (Status ${vResponse.status}): ${await vResponse.text()}`);
      }
    }
  }

  return productId;
}

async function createAstroProduct(
  storeUrl: string,
  apiKey: string,
  apiSecret: string,
  payload: {
    title: string;
    slug: string;
    price: number;
    sku?: string;
    description?: string;
    short_description?: string;
    category_slug?: string;
    category_name?: string;
    is_custom?: boolean;
    team_id?: string;
    images?: string[];
  }
): Promise<string> {
  const cleanUrl = storeUrl.trim().replace(/\/$/, "");
  
  const response = await fetch(`${cleanUrl}/api/products/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-astro-api-key": apiKey,
      "x-astro-api-secret": apiSecret
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Astro product creation failed (Status ${response.status}): ${await response.text()}`);
  }

  const data = await response.json() as any;
  if (!data.success) {
    throw new Error(`Astro API error: ${data.error || "Unknown error"}`);
  }

  return data.product_id;
}

async function queueHandler(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) {
  // Consumer logic will process the bulk rendering tasks
  const db = drizzle(env.DB);
  
  for (const msg of batch.messages) {
    const { jobId } = msg.body;
    
    // Set status to running
    await db.update(bulkJobs)
      .set({ status: "running" })
      .where(eq(bulkJobs.id, jobId));

    const jobQuery = await db.select().from(bulkJobs).where(eq(bulkJobs.id, jobId)).limit(1);
    const job = jobQuery[0];
    if (!job) continue;

    const items = await db.select().from(bulkJobItems).where(eq(bulkJobItems.jobId, jobId));
    
    // Fetch store details outside items loop
    const storeTargets = job.storeTargets ? JSON.parse(job.storeTargets) : [];
    const storeTarget = storeTargets[0];
    let store: any = null;
    if (storeTarget) {
      const storeQuery = await db.select().from(stores).where(eq(stores.id, storeTarget.store_id)).limit(1);
      store = storeQuery[0];
    }

    const seoTemplate = job.seoTemplate ? JSON.parse(job.seoTemplate) : {};
    const titlePattern = seoTemplate.title_pattern || "{player_name} - {team_name} Jersey";
    const descriptionPattern = seoTemplate.description_pattern || "";
    const category = seoTemplate.category_pattern || "Jerseys";
    const sizes = seoTemplate.sizes || [];

    let completed = 0;
    let failed = 0;

    const batchStatements: any[] = [];

    for (const item of items) {
      try {
        // Fetch template
        const templateQuery = await db.select().from(mockupTemplates).where(eq(mockupTemplates.id, item.mockupTemplateId)).limit(1);
        const template = templateQuery[0];
        if (!template) throw new Error("Template not found");

        const canvasJson = template.canvasJson ? JSON.parse(template.canvasJson) : null;
        if (!canvasJson) throw new Error("Template canvas JSON is empty");

        // Fetch player
        const playerQuery = await db.select().from(players).where(eq(players.id, item.playerId)).limit(1);
        const player = playerQuery[0];
        if (!player) throw new Error("Player not found");

        const teamQuery = await db.select().from(teams).where(eq(teams.id, player.teamId)).limit(1);
        const team = teamQuery[0];
        const teamName = team ? team.name : "Team";

        // Render PNG bytes using Satori + resvg
        const pngBytes = await generateJersey(canvasJson, player.displayName, player.number, env);

        // Upload output file to R2
        const key = `jobs/${jobId}/render_${item.id}_${item.gender.toLowerCase()}.png`;
        await uploadToR2(key, pngBytes.buffer, "image/png", env);

        const finalUrl = env.R2_PUBLIC_URL 
          ? `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`
          : `https://storage.googleapis.com/${key}`; // Fallback

        let storeProductIds: Record<string, any> = {};
        let productTitle = `${player.name} Jersey`;
        let productDescription = `Premium custom jersey mockup product.`;

        // If target store is connected and WooCommerce/WordPress API is available
        if (store && store.platform === "woocommerce" && store.apiKey && store.apiSecret) {
          try {
            // A. Upload image to WordPress Media Library
            const filename = `${player.name.toLowerCase().replace(/ /g, "_")}_${item.gender.toLowerCase()}_${item.id}.png`;
            const wpImageUrl = await uploadMediaToWordPress(
              store.url,
              store.apiKey,
              store.apiSecret,
              pngBytes.buffer,
              filename
            );

            // B. Resolve Dynamic SEO Fields
            productTitle = titlePattern
              .replace(/{player_name}/g, player.name)
              .replace(/{team_name}/g, teamName)
              .replace(/{player_number}/g, String(player.number));

            productDescription = descriptionPattern
              .replace(/{player_name}/g, player.name)
              .replace(/{team_name}/g, teamName)
              .replace(/{player_number}/g, String(player.number));

            // C. Filter sizes for this item's gender
            const itemSizes = sizes.filter((s: string) => s.toLowerCase().includes(item.gender.toLowerCase()));
            const finalSizes = itemSizes.length > 0 ? itemSizes : sizes;

            // D. Create WooCommerce Product
            const woocommerceProductId = await createWooCommerceProduct(
              store.url,
              store.apiKey,
              store.apiSecret,
              productTitle,
              "29.99", // standard regular price
              productDescription,
              wpImageUrl || finalUrl,
              finalSizes
            );

            storeProductIds[String(store.id)] = woocommerceProductId;
          } catch (wpErr: any) {
            console.error(`Store upload failed for item ${item.id}:`, wpErr);
            throw new Error(`Store push failed: ${wpErr.message}`);
          }
        } else if (store && store.platform === "astro" && store.apiKey && store.apiSecret) {
          try {
            // A. Format dynamic titles
            productTitle = titlePattern
              .replace(/{player_name}/g, player.name)
              .replace(/{team_name}/g, teamName)
              .replace(/{player_number}/g, String(player.number));

            productDescription = descriptionPattern
              .replace(/{player_name}/g, player.name)
              .replace(/{team_name}/g, teamName)
              .replace(/{player_number}/g, String(player.number));

            // B. Construct safe URL slug
            const baseSlug = `${teamName}-${player.name}-${item.gender}`
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "");

            // C. Create Astro Product
            const astroProductId = await createAstroProduct(
              store.url,
              store.apiKey,
              store.apiSecret,
              {
                title: productTitle,
                slug: baseSlug,
                price: 29.99,
                sku: `JRSY-${jobId}-${item.id}`,
                description: productDescription,
                short_description: `Premium customizable ${player.name} jersey.`,
                category_slug: `${teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-custom-jersey`,
                category_name: `${teamName} Custom Jerseys`,
                is_custom: true,
                team_id: teamName.toLowerCase().replace(/[^a-z0-9]+/g, ""),
                images: [finalUrl]
              }
            );

            storeProductIds[String(store.id)] = astroProductId;
          } catch (astroErr: any) {
            console.error(`Store upload failed for Astro item ${item.id}:`, astroErr);
            throw new Error(`Store push failed: ${astroErr.message}`);
          }
        }

        // Accumulate item status update in statement batch
        batchStatements.push(
          db.update(bulkJobItems)
            .set({
              status: "done",
              generatedImageUrl: finalUrl,
              productTitle: productTitle,
              productDescription: productDescription,
              productCategory: category,
              storeProductIds: JSON.stringify(storeProductIds)
            })
            .where(eq(bulkJobItems.id, item.id))
        );

        completed++;
      } catch (e: any) {
        console.error(`Error rendering item ${item.id}:`, e);
        
        batchStatements.push(
          db.update(bulkJobItems)
            .set({
              status: "failed",
              errorMessage: e.message || "Rendering failed"
            })
            .where(eq(bulkJobItems.id, item.id))
        );
        
        failed++;
      }

      // If batch accumulated 100 statements, execute them in one database call
      if (batchStatements.length >= 100) {
        batchStatements.push(
          db.update(bulkJobs)
            .set({
              completedItems: completed,
              failedItems: failed
            })
            .where(eq(bulkJobs.id, jobId))
        );
        await db.batch(batchStatements as any);
        batchStatements.length = 0; // Reset batch array
      }
    }

    // Execute any remaining statement updates
    if (batchStatements.length > 0) {
      batchStatements.push(
        db.update(bulkJobs)
          .set({
            completedItems: completed,
            failedItems: failed
          })
          .where(eq(bulkJobs.id, jobId))
        );
      await db.batch(batchStatements as any);
    }

    // Set job status to completed/failed
    await db.update(bulkJobs)
      .set({
        status: (failed === 0) ? "completed" : "failed",
        completedAt: new Date().toISOString()
      })
      .where(eq(bulkJobs.id, jobId));
  }
}

// ── Pinterest AI Studio Routes ──────────────────────────────────────────────

// ── Pinterest Niche Library Routes ──────────────────────────────────────────

// List Niches (with summary counts)
app.get("/api/pinterest/niches", cacheResponse({ ttl: 60, tags: ["pinterest"] }), async (c) => {
  const db = drizzle(c.env.DB);
  const status = c.req.query("status");
  const niches = status
    ? await db.select().from(pinterestNiches).where(eq(pinterestNiches.status, status)).orderBy(desc(pinterestNiches.id))
    : await db.select().from(pinterestNiches).orderBy(desc(pinterestNiches.id));

  const enhancedNiches = await Promise.all(
    niches.map(async (niche) => {
      const themes = await db.select().from(pinterestThemes).where(eq(pinterestThemes.nicheId, niche.id));
      const styles = await db.select().from(pinterestPrompts).where(eq(pinterestPrompts.nicheId, niche.id));
      const contentTypes = await db.select().from(pinterestContentTypes).where(eq(pinterestContentTypes.nicheId, niche.id));
      const recipes = await db.select().from(pinterestRecipes).where(eq(pinterestRecipes.nicheId, niche.id));
      return {
        ...niche,
        counts: {
          themes: themes.length,
          styles: styles.length,
          contentTypes: contentTypes.length,
          recipes: recipes.length
        }
      };
    })
  );
  return c.json(enhancedNiches);
});

// Generate AI Niche Library Draft via DeepSeek
app.post("/api/pinterest/niches/generate", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.niche || typeof body.niche !== "string" || !body.niche.trim()) {
      return c.json({ error: "Niche topic name is required" }, 400);
    }

    const draft = await generateNicheLibrary({
      niche: body.niche.trim(),
      audience: body.audience?.trim(),
      language: body.language?.trim() || "English",
      market: body.market?.trim() || "United States"
    }, c.env);

    const validation = validateNicheLibrary(draft);

    // Save draft to KV with 24-hour TTL
    if (c.env.FONTS_CACHE_KV) {
      await c.env.FONTS_CACHE_KV.put(
        `pinterest:niche-draft:${draft.draftId}`,
        JSON.stringify({ draft, validation }),
        { expirationTtl: 86400 }
      );
    }

    return c.json({
      ok: true,
      draftId: draft.draftId,
      draft,
      validation
    }, 201);
  } catch (err: any) {
    console.error("Generate niche library error:", err);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// Get Draft from KV
app.get("/api/pinterest/niches/draft/:draftId", async (c) => {
  const draftId = c.req.param("draftId");
  const raw = await c.env.FONTS_CACHE_KV?.get(`pinterest:niche-draft:${draftId}`);
  if (!raw) {
    return c.json({ error: "Draft not found or expired (drafts expire after 24 hours)" }, 404);
  }
  try {
    const parsed = JSON.parse(raw);
    return c.json(parsed);
  } catch (e: any) {
    return c.json({ error: "Failed to parse draft payload" }, 500);
  }
});

// Update Draft in KV
app.put("/api/pinterest/niches/draft/:draftId", async (c) => {
  const draftId = c.req.param("draftId");
  const key = `pinterest:niche-draft:${draftId}`;
  const existingRaw = await c.env.FONTS_CACHE_KV?.get(key);
  if (!existingRaw) {
    return c.json({ error: "Draft not found or expired" }, 404);
  }
  try {
    const body = await c.req.json();
    const updatedDraft = body.draft || body;
    updatedDraft.draftId = draftId;
    const validation = validateNicheLibrary(updatedDraft);
    if (c.env.FONTS_CACHE_KV) {
      await c.env.FONTS_CACHE_KV.put(
        key,
        JSON.stringify({ draft: updatedDraft, validation }),
        { expirationTtl: 86400 }
      );
    }
    return c.json({ ok: true, draft: updatedDraft, validation });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Approve Draft and Persist to D1 Database
app.post("/api/pinterest/niches/draft/:draftId/approve", async (c) => {
  const draftId = c.req.param("draftId");
  const key = `pinterest:niche-draft:${draftId}`;
  const raw = await c.env.FONTS_CACHE_KV?.get(key);
  if (!raw) {
    return c.json({ error: "Draft not found or expired" }, 404);
  }
  try {
    const { draft } = JSON.parse(raw);
    const result = await saveApprovedNiche(draft, c.env);
    await c.env.FONTS_CACHE_KV?.delete(key);
    await invalidateCache(c, ["pinterest"]);
    return c.json({
      ok: true,
      message: "Niche library approved and saved to database successfully",
      ...result
    }, 201);
  } catch (e: any) {
    console.error("Approve niche error:", e);
    return c.json({ ok: false, error: e.message }, 500);
  }
});

// Delete Draft from KV
app.delete("/api/pinterest/niches/draft/:draftId", async (c) => {
  const draftId = c.req.param("draftId");
  await c.env.FONTS_CACHE_KV?.delete(`pinterest:niche-draft:${draftId}`);
  return c.json({ ok: true, deleted: draftId });
});

// Get Niche Details by ID (Full content tree)
app.get("/api/pinterest/niches/:id", cacheResponse({ ttl: 120, tags: ["pinterest"] }), async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

  const db = drizzle(c.env.DB);
  const [niche] = await db.select().from(pinterestNiches).where(eq(pinterestNiches.id, id)).limit(1);
  if (!niche) return c.json({ error: "Niche not found" }, 404);

  const contentTypes = await db.select().from(pinterestContentTypes).where(eq(pinterestContentTypes.nicheId, id));
  const styles = await db.select().from(pinterestPrompts).where(eq(pinterestPrompts.nicheId, id));
  const rawThemes = await db.select().from(pinterestThemes).where(eq(pinterestThemes.nicheId, id));
  const recipes = await db.select().from(pinterestRecipes).where(eq(pinterestRecipes.nicheId, id));

  const themes = await Promise.all(
    rawThemes.map(async (t) => {
      const junction = await db.select().from(pinterestThemeStyles).where(eq(pinterestThemeStyles.themeId, t.id));
      const compatibleStyleIds = junction.map((j) => j.styleId);
      const compatibleStyles = styles.filter((s) => compatibleStyleIds.includes(s.id));
      return {
        ...t,
        compatibleStyles,
        compatibleStyleNames: compatibleStyles.map((s) => s.name)
      };
    })
  );

  return c.json({
    ...niche,
    contentTypes,
    themes,
    styles,
    recipes
  });
});

// Update Niche by ID
app.put("/api/pinterest/niches/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const updates: any = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.targetAudience !== undefined) updates.targetAudience = body.targetAudience;
  if (body.language !== undefined) updates.language = body.language;
  if (body.market !== undefined) updates.market = body.market;
  if (body.status !== undefined) updates.status = body.status;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  await db.update(pinterestNiches).set(updates).where(eq(pinterestNiches.id, id));
  await invalidateCache(c, ["pinterest"]);
  const [updated] = await db.select().from(pinterestNiches).where(eq(pinterestNiches.id, id)).limit(1);
  if (!updated) return c.json({ error: "Niche not found" }, 404);
  return c.json(updated);
});

// Delete Niche by ID
app.delete("/api/pinterest/niches/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

  const db = drizzle(c.env.DB);
  const nicheThemes = await db.select({ id: pinterestThemes.id }).from(pinterestThemes).where(eq(pinterestThemes.nicheId, id));
  for (const t of nicheThemes) {
    await db.delete(pinterestThemeStyles).where(eq(pinterestThemeStyles.themeId, t.id));
  }
  await db.update(pinterestThemes).set({ nicheId: null }).where(eq(pinterestThemes.nicheId, id));
  await db.update(pinterestPrompts).set({ nicheId: null }).where(eq(pinterestPrompts.nicheId, id));
  await db.delete(pinterestRecipes).where(eq(pinterestRecipes.nicheId, id));
  await db.delete(pinterestContentTypes).where(eq(pinterestContentTypes.nicheId, id));
  await db.delete(pinterestNiches).where(eq(pinterestNiches.id, id));
  await invalidateCache(c, ["pinterest"]);
  return c.json({ ok: true, deleted: id });
});

// Regenerate Niche Draft from existing record
app.post("/api/pinterest/niches/:id/regenerate", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid niche ID" }, 400);

  const db = drizzle(c.env.DB);
  const [niche] = await db.select().from(pinterestNiches).where(eq(pinterestNiches.id, id)).limit(1);
  if (!niche) return c.json({ error: "Niche not found" }, 404);

  try {
    const draft = await generateNicheLibrary({
      niche: niche.name,
      audience: niche.targetAudience || undefined,
      language: niche.language || "English",
      market: niche.market || "United States"
    }, c.env);

    const validation = validateNicheLibrary(draft);
    if (c.env.FONTS_CACHE_KV) {
      await c.env.FONTS_CACHE_KV.put(
        `pinterest:niche-draft:${draft.draftId}`,
        JSON.stringify({ draft, validation }),
        { expirationTtl: 86400 }
      );
    }
    return c.json({
      ok: true,
      draftId: draft.draftId,
      draft,
      validation
    }, 201);
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// Get Niche Content Types
app.get("/api/pinterest/niches/:id/content-types", cacheResponse({ ttl: 120, tags: ["pinterest"] }), async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const result = await db.select().from(pinterestContentTypes).where(eq(pinterestContentTypes.nicheId, id));
  return c.json(result);
});

// Get Niche Themes (with compatible styles)
app.get("/api/pinterest/niches/:id/themes", cacheResponse({ ttl: 120, tags: ["pinterest"] }), async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const themes = await db.select().from(pinterestThemes).where(eq(pinterestThemes.nicheId, id));
  const styles = await db.select().from(pinterestPrompts).where(eq(pinterestPrompts.nicheId, id));
  const result = await Promise.all(
    themes.map(async (t) => {
      const junction = await db.select().from(pinterestThemeStyles).where(eq(pinterestThemeStyles.themeId, t.id));
      const styleIds = junction.map((j) => j.styleId);
      const compatibleStyles = styles.filter((s) => styleIds.includes(s.id));
      return {
        ...t,
        compatibleStyles,
        compatibleStyleNames: compatibleStyles.map((s) => s.name)
      };
    })
  );
  return c.json(result);
});

// Get Niche Styles
app.get("/api/pinterest/niches/:id/styles", cacheResponse({ ttl: 120, tags: ["pinterest"] }), async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const result = await db.select().from(pinterestPrompts).where(eq(pinterestPrompts.nicheId, id));
  return c.json(result);
});

// Get Niche Recipes
app.get("/api/pinterest/niches/:id/recipes", cacheResponse({ ttl: 120, tags: ["pinterest"] }), async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const recipes = await db.select().from(pinterestRecipes).where(eq(pinterestRecipes.nicheId, id));
  const contentTypes = await db.select().from(pinterestContentTypes).where(eq(pinterestContentTypes.nicheId, id));
  const ctMap = new Map(contentTypes.map((ct) => [ct.id, ct.name]));
  const result = recipes.map((r) => ({
    ...r,
    contentTypeName: r.contentTypeId ? ctMap.get(r.contentTypeId) || null : null
  }));
  return c.json(result);
});

// ── Pinterest Stats & Trends ────────────────────────────────────────────────
// Pinterest Stats
app.get("/api/pinterest/stats", async (c) => {
  const db = drizzle(c.env.DB);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const allHistory = await db.select().from(pinterestHistory);
  const todayJobs = allHistory.filter(h => h.createdAt && h.createdAt >= todayStart);
  const monthJobs = allHistory.filter(h => h.createdAt && h.createdAt >= monthStart);
  const pendingTrends = await db.select().from(pinterestTrends).where(eq(pinterestTrends.status, "pending"));

  return c.json({
    todayJobs: todayJobs.length,
    completedImages: todayJobs.filter(h => h.status === "completed").length,
    failedJobs: todayJobs.filter(h => h.status === "failed").length,
    pendingJobs: pendingTrends.length,
    monthlyTotal: monthJobs.filter(h => h.status === "completed").length
  });
});

// Pinterest Trends CRUD
app.get("/api/pinterest/trends", async (c) => {
  const db = drizzle(c.env.DB);
  const search = c.req.query("search");
  const theme = c.req.query("theme");
  const status = c.req.query("status");
  const style = c.req.query("style");

  let result = await db.select().from(pinterestTrends).orderBy(desc(pinterestTrends.id));

  if (search) result = result.filter(t => t.keyword.toLowerCase().includes(search.toLowerCase()));
  if (theme) result = result.filter(t => t.theme === theme);
  if (status && status !== "all") result = result.filter(t => t.status === status);
  if (style) result = result.filter(t => t.style === style);

  return c.json(result);
});

app.post("/api/pinterest/trends", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const result = await db.insert(pinterestTrends).values({
    keyword: body.keyword,
    theme: body.theme || null,
    style: body.style || null,
    product: body.product || null,
    imageUrl: body.imageUrl || null,
    status: "pending",
    createdAt: new Date().toISOString()
  }).returning();
  return c.json(result[0], 201);
});

app.post("/api/pinterest/trends/import", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const trends = body.trends || [];
  let imported = 0;
  for (const t of trends) {
    await db.insert(pinterestTrends).values({
      keyword: t.keyword,
      theme: t.theme || null,
      style: t.style || null,
      product: t.product || null,
      imageUrl: t.imageUrl || t.image_url || null,
      status: "pending",
      createdAt: new Date().toISOString()
    });
    imported++;
  }
  return c.json({ imported });
});

app.put("/api/pinterest/trends/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const updates: any = {};
  if (body.keyword !== undefined) updates.keyword = body.keyword;
  if (body.theme !== undefined) updates.theme = body.theme;
  if (body.style !== undefined) updates.style = body.style;
  if (body.product !== undefined) updates.product = body.product;
  if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
  if (body.status !== undefined) updates.status = body.status;
  await db.update(pinterestTrends).set(updates).where(eq(pinterestTrends.id, id));
  const updated = await db.select().from(pinterestTrends).where(eq(pinterestTrends.id, id)).limit(1);
  return c.json(updated[0]);
});

app.delete("/api/pinterest/trends/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  await db.delete(pinterestTrends).where(eq(pinterestTrends.id, id));
  return c.json({ deleted: id });
});

// Pinterest Image Generation
app.post("/api/pinterest/generate", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();

  if (!body.keyword || !body.referenceImageUrl) {
    return c.json({ error: "keyword and referenceImageUrl are required" }, 400);
  }

  try {
    const result = await generatePinterestCreative({
      keyword: body.keyword,
      theme: body.theme || "General",
      style: body.style || "Modern",
      product: body.product || "Interior",
      referenceImageUrl: body.referenceImageUrl,
      model: body.model || "qwen",
      negativePrompt: body.negativePrompt
    }, c.env);

    // Save to history
    await db.insert(pinterestHistory).values({
      trendId: body.trendId || null,
      keyword: body.keyword,
      theme: body.theme || "General",
      style: body.style || "Modern",
      product: body.product || "Interior",
      promptUsed: result.promptUsed,
      negativePrompt: result.negativePrompt,
      fileName: result.fileName,
      seoTitle: result.seo.title,
      seoDescription: result.seo.description,
      seoTags: JSON.stringify(result.seo.tags),
      seoAltText: result.seo.altText,
      modelUsed: result.modelUsed,
      generationTimeMs: result.generationTimeMs,
      referenceImageUrl: body.referenceImageUrl,
      generatedImageUrl: result.r2Url,
      status: "completed",
      createdAt: new Date().toISOString()
    });

    // Update trend status if linked
    if (body.trendId) {
      await db.update(pinterestTrends)
        .set({ status: "completed" })
        .where(eq(pinterestTrends.id, body.trendId));
    }

    // Save job metadata to KV
    const jobId = Date.now().toString(36);
    await c.env.FONTS_CACHE_KV.put(`pinterest:job:${jobId}`, JSON.stringify({
      jobId,
      status: "completed",
      keyword: body.keyword,
      theme: body.theme,
      r2Url: result.r2Url,
      title: result.seo.title,
      description: result.seo.description,
      tags: result.seo.tags,
      altText: result.seo.altText,
      createdAt: new Date().toISOString()
    }), { expirationTtl: 86400 * 7 });

    // Convert image to base64 for JSON response
    let binary = "";
    for (let i = 0; i < result.imageBuffer.length; i++) {
      binary += String.fromCharCode(result.imageBuffer[i]!);
    }
    const imageBase64 = btoa(binary);

    return c.json({
      success: true,
      metadata: {
        title: result.seo.title,
        description: result.seo.description,
        tags: result.seo.tags,
        altText: result.seo.altText
      },
      r2Url: result.r2Url,
      fileName: result.fileName,
      modelUsed: result.modelUsed,
      generationTimeMs: result.generationTimeMs,
      promptUsed: result.promptUsed,
      image: imageBase64
    });
  } catch (err: any) {
    console.error("Pinterest generation error:", err);

    // Save failed attempt to history
    await db.insert(pinterestHistory).values({
      trendId: body.trendId || null,
      keyword: body.keyword,
      theme: body.theme || "General",
      style: body.style || "Modern",
      product: body.product || "Interior",
      referenceImageUrl: body.referenceImageUrl,
      status: "failed",
      createdAt: new Date().toISOString()
    });

    if (body.trendId) {
      await db.update(pinterestTrends)
        .set({ status: "failed" })
        .where(eq(pinterestTrends.id, body.trendId));
    }

    return c.json({ success: false, error: err.message || "Generation failed" }, 500);
  }
});

// Pinterest Prompts CRUD
app.get("/api/pinterest/prompts", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select().from(pinterestPrompts).orderBy(desc(pinterestPrompts.id));
  return c.json(result);
});

app.post("/api/pinterest/prompts", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const result = await db.insert(pinterestPrompts).values({
    name: body.name,
    styleDescription: body.styleDescription || null,
    positivePrompt: body.positivePrompt || null,
    negativePrompt: body.negativePrompt || null,
    colorPalette: body.colorPalette || null,
    lightingStyle: body.lightingStyle || null,
    cameraStyle: body.cameraStyle || null,
    createdAt: new Date().toISOString()
  }).returning();
  return c.json(result[0], 201);
});

app.put("/api/pinterest/prompts/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const updates: any = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.styleDescription !== undefined) updates.styleDescription = body.styleDescription;
  if (body.positivePrompt !== undefined) updates.positivePrompt = body.positivePrompt;
  if (body.negativePrompt !== undefined) updates.negativePrompt = body.negativePrompt;
  if (body.colorPalette !== undefined) updates.colorPalette = body.colorPalette;
  if (body.lightingStyle !== undefined) updates.lightingStyle = body.lightingStyle;
  if (body.cameraStyle !== undefined) updates.cameraStyle = body.cameraStyle;
  await db.update(pinterestPrompts).set(updates).where(eq(pinterestPrompts.id, id));
  const updated = await db.select().from(pinterestPrompts).where(eq(pinterestPrompts.id, id)).limit(1);
  return c.json(updated[0]);
});

app.delete("/api/pinterest/prompts/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  await db.delete(pinterestPrompts).where(eq(pinterestPrompts.id, id));
  return c.json({ deleted: id });
});

// Pinterest Themes CRUD
app.get("/api/pinterest/themes", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select().from(pinterestThemes).orderBy(desc(pinterestThemes.id));
  return c.json(result);
});

app.post("/api/pinterest/themes", async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const result = await db.insert(pinterestThemes).values({
    name: body.name,
    season: body.season || null,
    decorElements: body.decorElements || null,
    colorPalette: body.colorPalette || null,
    mood: body.mood || null,
    recommendedStyles: body.recommendedStyles || null,
    createdAt: new Date().toISOString()
  }).returning();
  return c.json(result[0], 201);
});

app.put("/api/pinterest/themes/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  const updates: any = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.season !== undefined) updates.season = body.season;
  if (body.decorElements !== undefined) updates.decorElements = body.decorElements;
  if (body.colorPalette !== undefined) updates.colorPalette = body.colorPalette;
  if (body.mood !== undefined) updates.mood = body.mood;
  if (body.recommendedStyles !== undefined) updates.recommendedStyles = body.recommendedStyles;
  await db.update(pinterestThemes).set(updates).where(eq(pinterestThemes.id, id));
  const updated = await db.select().from(pinterestThemes).where(eq(pinterestThemes.id, id)).limit(1);
  return c.json(updated[0]);
});

app.delete("/api/pinterest/themes/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  await db.delete(pinterestThemes).where(eq(pinterestThemes.id, id));
  return c.json({ deleted: id });
});

// Pinterest History
app.get("/api/pinterest/history", async (c) => {
  const db = drizzle(c.env.DB);
  const search = c.req.query("search");
  const model = c.req.query("model");
  const from = c.req.query("from");
  const to = c.req.query("to");

  let result = await db.select().from(pinterestHistory).orderBy(desc(pinterestHistory.id));

  if (search) result = result.filter(h => h.keyword.toLowerCase().includes(search.toLowerCase()));
  if (model) result = result.filter(h => h.modelUsed === model);
  if (from) result = result.filter(h => h.createdAt && h.createdAt >= from);
  if (to) result = result.filter(h => h.createdAt && h.createdAt <= to + "T23:59:59Z");

  return c.json(result.map(h => ({
    ...h,
    seoTags: h.seoTags ? JSON.parse(h.seoTags) : []
  })));
});

app.get("/api/pinterest/history/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const result = await db.select().from(pinterestHistory).where(eq(pinterestHistory.id, id)).limit(1);
  if (result.length === 0) return c.json({ error: "Not found" }, 404);
  const h = result[0]!;
  return c.json({ ...h, seoTags: h.seoTags ? JSON.parse(h.seoTags) : [] });
});

app.delete("/api/pinterest/history/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  await db.delete(pinterestHistory).where(eq(pinterestHistory.id, id));
  return c.json({ deleted: id });
});

app.post("/api/pinterest/history/:id/regenerate", async (c) => {
  const id = parseInt(c.req.param("id"));
  const db = drizzle(c.env.DB);
  const existing = await db.select().from(pinterestHistory).where(eq(pinterestHistory.id, id)).limit(1);
  if (existing.length === 0) return c.json({ error: "Not found" }, 404);
  const h = existing[0]!;
  return c.json({
    keyword: h.keyword,
    theme: h.theme,
    style: h.style,
    product: h.product,
    referenceImageUrl: h.referenceImageUrl,
    model: h.modelUsed?.includes("dall-e") ? "openai" : "qwen"
  });
});

// Pinterest Image Proxy Route (serves R2 stored images with CORS headers)
app.get("/api/pinterest/test-r2", async (c) => {
  try {
    await c.env.BUCKET.put("test.txt", "hello r2 working");
    const list = await c.env.BUCKET.list();
    return c.json({ ok: true, keys: list.objects.map(o => o.key) });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get("/api/pinterest/images/*", async (c) => {
  const url = new URL(c.req.url);
  let path = url.pathname.replace(/^\/api\/pinterest\/images\//, "");
  path = decodeURIComponent(path);

  let obj = await c.env.BUCKET.get(path);
  if (!obj && !path.startsWith("pinterest/generated/")) {
    obj = await c.env.BUCKET.get(`pinterest/generated/${path}`);
  }

  if (!obj) {
    return c.text(`Image Not Found in R2: ${path}`, 404);
  }

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "image/png");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
});

// Pinterest CSV Export
app.get("/api/pinterest/export/csv", async (c) => {
  const db = drizzle(c.env.DB);
  const from = c.req.query("from");
  const to = c.req.query("to");

  let result = await db.select().from(pinterestHistory)
    .orderBy(desc(pinterestHistory.id));

  // Filter out failed/incomplete test rows with no image URL
  result = result.filter(h => h.generatedImageUrl && h.generatedImageUrl.trim() !== "");
  if (from) result = result.filter(h => h.createdAt && h.createdAt >= from);
  if (to) result = result.filter(h => h.createdAt && h.createdAt <= to + "T23:59:59Z");

  // Build CSV with R2 Image Link as first column
  const csvHeaders = ["r2_image_link", "file_name", "keyword", "theme", "style", "pin_title", "pin_description", "tags", "alt_text", "model", "generated_at"];
  const escapeCSV = (val: string) => {
    if (!val) return "";
    if (val.includes('"') || val.includes(',') || val.includes('\n')) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  };

  let csv = csvHeaders.join(",") + "\n";
  for (const h of result) {
    let tags = "";
    if (h.seoTags) {
      try {
        tags = Array.isArray(h.seoTags) ? (h.seoTags as any).join(", ") : JSON.parse(h.seoTags).join(", ");
      } catch (e) {
        tags = String(h.seoTags);
      }
    }

    const row = [
      escapeCSV(h.generatedImageUrl || ""),
      escapeCSV(h.fileName || ""),
      escapeCSV(h.keyword),
      escapeCSV(h.theme || ""),
      escapeCSV(h.style || ""),
      escapeCSV(h.seoTitle || ""),
      escapeCSV(h.seoDescription || ""),
      escapeCSV(tags),
      escapeCSV(h.seoAltText || ""),
      escapeCSV(h.modelUsed || ""),
      escapeCSV(h.createdAt || "")
    ];
    csv += row.join(",") + "\n";
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `pinterest-trends-${dd}-${mm}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Access-Control-Allow-Origin": "*"
    }
  });
});

// Official Pinterest Bulk Upload Format CSV (for Pinterest Business Bulk Create Pins)
app.get("/api/pinterest/export/pinterest-csv", async (c) => {
  const db = drizzle(c.env.DB);
  const from = c.req.query("from");
  const to = c.req.query("to");
  const destinationLink = c.req.query("link") || c.req.query("url") || "";

  let result = await db.select().from(pinterestHistory)
    .orderBy(desc(pinterestHistory.id));

  // Filter out failed/incomplete test rows with no image URL
  result = result.filter(h => h.generatedImageUrl && h.generatedImageUrl.trim() !== "");
  if (from) result = result.filter(h => h.createdAt && h.createdAt >= from);
  if (to) result = result.filter(h => h.createdAt && h.createdAt <= to + "T23:59:59Z");

  // Official Pinterest Bulk Upload Header Format:
  // Title,Media URL,Pinterest board,Description,Link,Publish date,Alt text,Keywords
  const csvHeaders = ["Title", "Media URL", "Pinterest board", "Description", "Link", "Publish date", "Alt text", "Keywords"];
  const escapeCSV = (val: string) => {
    if (!val) return "";
    if (val.includes('"') || val.includes(',') || val.includes('\n')) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  };

  let csv = csvHeaders.join(",") + "\n";
  for (const h of result) {
    let tags = "";
    if (h.seoTags) {
      try {
        tags = Array.isArray(h.seoTags) ? (h.seoTags as any).join(", ") : JSON.parse(h.seoTags).join(", ");
      } catch (e) {
        tags = String(h.seoTags);
      }
    }

    const boardName = h.theme ? `${h.keyword} (${h.theme})` : h.keyword;
    const title = (h.seoTitle || h.keyword || "").substring(0, 100);
    const description = (h.seoDescription || "").substring(0, 500);

    const row = [
      escapeCSV(title),
      escapeCSV(h.generatedImageUrl || ""),
      escapeCSV(boardName),
      escapeCSV(description),
      escapeCSV(destinationLink), // Destination Link (populated from Step 5 input)
      escapeCSV(""), // Publish date (optional)
      escapeCSV(h.seoAltText || ""),
      escapeCSV(tags)
    ];
    csv += row.join(",") + "\n";
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `pinterest-bulk-upload-${dd}-${mm}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Access-Control-Allow-Origin": "*"
    }
  });
});

// Official Pinterest Bulk Upload TXT (Tab-Delimited TSV) Format
app.get("/api/pinterest/export/pinterest-txt", async (c) => {
  const db = drizzle(c.env.DB);
  const from = c.req.query("from");
  const to = c.req.query("to");
  const destinationLink = c.req.query("link") || c.req.query("url") || "";

  let result = await db.select().from(pinterestHistory)
    .orderBy(desc(pinterestHistory.id));

  // Filter out incomplete/failed test rows with no image URL
  result = result.filter(h => h.generatedImageUrl && h.generatedImageUrl.trim() !== "");
  if (from) result = result.filter(h => h.createdAt && h.createdAt >= from);
  if (to) result = result.filter(h => h.createdAt && h.createdAt <= to + "T23:59:59Z");

  // Official Pinterest Bulk Upload Header Format (Tab-separated):
  // Title	Media URL	Pinterest board	Description	Link	Publish date	Alt text	Keywords
  const headers = ["Title", "Media URL", "Pinterest board", "Description", "Link", "Publish date", "Alt text", "Keywords"];
  const cleanTSV = (val: string) => {
    if (!val) return "";
    return val.replace(/[\t\r\n]+/g, " ").trim();
  };

  let txt = headers.join("\t") + "\n";
  for (const h of result) {
    let tags = "";
    if (h.seoTags) {
      try {
        tags = Array.isArray(h.seoTags) ? (h.seoTags as any).join(", ") : JSON.parse(h.seoTags).join(", ");
      } catch (e) {
        tags = String(h.seoTags);
      }
    }

    const boardName = h.theme ? `${h.keyword} (${h.theme})` : h.keyword;
    const title = (h.seoTitle || h.keyword || "").substring(0, 100);
    const description = (h.seoDescription || "").substring(0, 500);

    const row = [
      cleanTSV(title),
      cleanTSV(h.generatedImageUrl || ""),
      cleanTSV(boardName),
      cleanTSV(description),
      cleanTSV(destinationLink),
      cleanTSV(""), // Publish date
      cleanTSV(h.seoAltText || ""),
      cleanTSV(tags)
    ];
    txt += row.join("\t") + "\n";
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `pinterest-bulk-upload-${dd}-${mm}.txt`;

  return new Response(txt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Access-Control-Allow-Origin": "*"
    }
  });
});

// Pinterest Auto-Publishing RSS 2.0 XML Engine (supports multi-account/niche feeds)
app.get("/api/pinterest/rss", async (c) => {
  return handleRSSRequest(c);
});

app.get("/api/pinterest/rss/:channelId", async (c) => {
  return handleRSSRequest(c);
});

async function handleRSSRequest(c: any) {
  try {
    const db = drizzle(c.env.DB);
    const channelId = c.req.param("channelId") || c.req.query("channel") || "default";
    const claimedDomain = c.req.query("domain") || "https://vulius.com";
    const limitStr = c.req.query("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 200; // max 200 items per Pinterest feed limits
    const themeFilter = c.req.query("theme");
    const keywordFilter = c.req.query("keyword");

    let query = db.select().from(pinterestHistory)
      .orderBy(desc(pinterestHistory.id));

    let result = await query;

    // Filter out incomplete/failed test rows
    result = result.filter(h => h.generatedImageUrl && String(h.generatedImageUrl).trim() !== "");

    // Multi-Account Channel Filter: Filter by accountChannelId if channelId matches or is provided
    if (channelId && channelId !== "default" && channelId !== "all" && channelId !== "main") {
      const channelMatch = result.filter(h => h.accountChannelId && String(h.accountChannelId).toLowerCase() === channelId.toLowerCase());
      if (channelMatch.length > 0) {
        result = channelMatch;
      }
    }

    if (themeFilter) {
      result = result.filter(h => h.theme && String(h.theme).toLowerCase() === themeFilter.toLowerCase());
    }

    if (keywordFilter) {
      result = result.filter(h => h.keyword && String(h.keyword).toLowerCase().includes(keywordFilter.toLowerCase()));
    }

    // Slice to Pinterest limit (max 200)
    result = result.slice(0, Math.min(limit, 200));

    const xml = buildPinterestRSSFeed({
      channelTitle: `Pinterest AI Studio — Feed (${channelId})`,
      channelLink: claimedDomain,
      channelDescription: `Automated Pinterest RSS Feed for ${claimedDomain}`,
      claimedDomain,
      items: result
    });

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (err: any) {
    console.error("RSS Error:", err);
    return c.text(`RSS Generation Error: ${err.message}`, 500);
  }
}

// Multi-Account Channels CRUD
app.get("/api/pinterest/channels", async (c) => {
  const channels = await getActiveChannels(c.env);
  return c.json(channels);
});

app.post("/api/pinterest/channels", async (c) => {
  const body = await c.req.json();
  const channels = await getActiveChannels(c.env);

  const newChannel = {
    id: body.id || `account-${Date.now()}`,
    name: body.name || body.accountName || "New Account",
    niche: body.niche || "Home Decor",
    nicheId: body.nicheId || null,
    claimedDomain: body.claimedDomain || "https://vulius.com",
    dailyPinLimit: body.dailyPinLimit || 10,
    keywords: Array.isArray(body.keywords) ? body.keywords : (body.keywords ? body.keywords.split(",").map((k: string) => k.trim()) : ["pinterest ideas"]),
    themes: body.themes || ["General"],
    styles: body.styles || ["Modern Scandinavian"],
    model: body.model || "flux"
  };

  const updated = [newChannel, ...channels.filter((ch: any) => ch.id !== newChannel.id)];
  if (c.env.FONTS_CACHE_KV) {
    await c.env.FONTS_CACHE_KV.put("pinterest:channels", JSON.stringify(updated));
  }

  return c.json({ saved: true, channel: newChannel }, 201);
});

app.delete("/api/pinterest/channels/:id", async (c) => {
  const id = c.req.param("id");
  const result = await deleteChannel(c.env, id);
  return c.json(result);
});

// Dedicated Recipe / Autopilot Channel Deletion (Cancels Active Jobs + Cleans KV)
app.delete("/api/pinterest/autopilot/:channelId", async (c) => {
  const channelId = c.req.param("channelId");
  const result = await deleteChannel(c.env, channelId);
  return c.json(result);
});

// Multi-Account Auto-Pilot Trigger Endpoint (Enqueues into unified PINTEREST_QUEUE)
app.post("/api/pinterest/autopilot/run", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const channels = body.channels || await getActiveChannels(c.env);
    const jobs = await runAutoPilotBatch(c.env, channels);
    return c.json({
      ok: true,
      message: `Enqueued ${jobs.length} autopilot channel jobs to queue`,
      jobsCount: jobs.length,
      jobs
    });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Unified Pinterest Queue Management Routes ───────────────────────────────

// 1. GET /api/pinterest/queue/active — List all currently running Pinterest jobs
app.get("/api/pinterest/queue/active", async (c) => {
  const jobs = await getActiveQueueJobs(c.env);
  return c.json({ ok: true, count: jobs.length, jobs });
});

// 2. POST /api/pinterest/queue/:jobId/cancel — Cancel any running job
app.post("/api/pinterest/queue/:jobId/cancel", async (c) => {
  const jobId = c.req.param("jobId");
  const result = await cancelJob(c.env, jobId);
  return c.json(result);
});

// 2B. DELETE /api/pinterest/queue/:jobId — Delete job from KV and wipe generated pins/images
app.delete("/api/pinterest/queue/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const result = await deleteQueueJob(c.env, jobId);
  return c.json(result);
});

// 3. GET /api/pinterest/queue/history — View recent queue runs & statuses
app.get("/api/pinterest/queue/history", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const history = await getQueueHistory(c.env, limit);
  return c.json({ ok: true, count: history.length, jobs: history });
});

// Pinterest Settings (KV-based)
app.get("/api/pinterest/settings", async (c) => {
  const raw = await c.env.FONTS_CACHE_KV?.get("pinterest:settings");
  const settings = raw ? JSON.parse(raw) : {
    defaultModel: "qwen",
    defaultSize: "1000x1500",
    defaultFormat: "png",
    autoRetry: 1,
    seoModel: "deepseek"
  };
  return c.json(settings);
});

app.post("/api/pinterest/settings", async (c) => {
  const body = await c.req.json();
  if (c.env.FONTS_CACHE_KV) {
    await c.env.FONTS_CACHE_KV.put("pinterest:settings", JSON.stringify(body));
  }
  return c.json({ saved: true });
});

// Pinterest Batch Generation (Enqueues items into unified PINTEREST_QUEUE)
app.post("/api/pinterest/batch", async (c) => {
  const body = await c.req.json();
  const jobId = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

  let combinations: Array<{ keyword: string; theme: string; style: string; product: string; imageUrl: string }> = [];

  const keywords: string[] = body.keywords?.length ? body.keywords : (body.keyword ? [body.keyword] : []);
  const themes: string[] = body.themes?.length ? body.themes : ["General"];
  const styles: string[] = body.styles?.length ? body.styles : ["Modern"];
  const product = body.product || body.niche || "Creative Decor";

  if (body.combinations && Array.isArray(body.combinations) && body.combinations.length > 0) {
    combinations = body.combinations.map((item: any) => ({
      keyword: item.keyword || item.topic || "Pinterest Trend",
      theme: item.theme || "General",
      style: item.style || "Modern",
      product: item.product || product,
      imageUrl: item.imageUrl || ""
    }));
  } else if (body.imageUrls && Array.isArray(body.imageUrls) && body.imageUrls.length > 0) {
    // Multi-select combination mode: Images x Keywords x Themes x Styles
    const validUrls = body.imageUrls.filter((u: string) => u && u.trim());
    for (const url of validUrls) {
      for (const kw of (keywords.length ? keywords : ["Pinterest Trend"])) {
        for (const th of themes) {
          for (const st of styles) {
            combinations.push({
              keyword: kw,
              theme: th,
              style: st,
              product: product,
              imageUrl: url.trim()
            });
          }
        }
      }
    }
  } else if (keywords.length > 0) {
    // Keywords x Themes x Styles without reference images
    for (const kw of keywords) {
      for (const th of themes) {
        for (const st of styles) {
          combinations.push({
            keyword: kw,
            theme: th,
            style: st,
            product: product,
            imageUrl: ""
          });
        }
      }
    }
  } else {
    // Fallback single-trend mode
    combinations = body.trends || [];
  }

  // Cap if maxPins is specified
  if (body.maxPins && body.maxPins > 0 && combinations.length > body.maxPins) {
    combinations = combinations.slice(0, body.maxPins);
  }

  const totalJobs = combinations.length * (body.variants || 1);

  const jobMetadata = {
    jobId,
    type: "batch",
    status: totalJobs > 0 ? "running" : "completed",
    channelId: body.accountChannelId || body.channelId || null,
    channelName: body.channelName || body.accountChannelId || (body.accountChannelId ? `Account (${body.accountChannelId})` : "Ad-Hoc Batch"),
    niche: product,
    nicheId: body.nicheId || null,
    keywords: keywords.length ? keywords : combinations.map(c => c.keyword),
    themes,
    styles,
    total: totalJobs,
    completed: 0,
    failed: 0,
    generateImages: body.generateImages !== false,
    generateSeo: body.generateSeo !== false,
    variants: body.variants || 1,
    model: body.model || "flux",
    createdAt: new Date().toISOString(),
    finishedAt: totalJobs === 0 ? new Date().toISOString() : undefined
  };

  // Save batch job metadata to KV under unified key & legacy key
  if (c.env.FONTS_CACHE_KV) {
    await c.env.FONTS_CACHE_KV.put(`pinterest:job:${jobId}`, JSON.stringify(jobMetadata), { expirationTtl: 86400 * 7 });
    await c.env.FONTS_CACHE_KV.put(`pinterest:batch:${jobId}`, JSON.stringify(jobMetadata), { expirationTtl: 86400 * 7 });
  }

  // Enqueue each combination item to PINTEREST_QUEUE
  if (c.env.PINTEREST_QUEUE && totalJobs > 0) {
    for (const combo of combinations) {
      for (let v = 0; v < (body.variants || 1); v++) {
        await c.env.PINTEREST_QUEUE.send({
          jobId,
          type: "batch",
          channelId: body.accountChannelId || null,
          nicheId: body.nicheId || null,
          trend: combo,
          generateImages: body.generateImages !== false,
          generateSeo: body.generateSeo !== false,
          model: body.model || "flux"
        });
      }
    }
  }

  // If repeatDaily is requested, register recurring schedule in KV
  if (body.repeatDaily && c.env.FONTS_CACHE_KV) {
    try {
      const rawBatches = await c.env.FONTS_CACHE_KV.get("pinterest:recurring-batches");
      const recurringList = rawBatches ? JSON.parse(rawBatches) : [];
      const newRecurring = {
        id: `batch-sched-${Date.now().toString(36)}`,
        name: `${product} (${body.maxPins || totalJobs || 5} pins/day)`,
        niche: product,
        nicheId: body.nicheId || null,
        imageUrls: body.imageUrls || [],
        keywords,
        themes,
        styles,
        product,
        maxPins: body.maxPins || totalJobs || 5,
        variants: body.variants || 1,
        model: body.model || "flux",
        publishToRss: !!body.publishToRss,
        accountChannelId: body.accountChannelId || null,
        generateImages: body.generateImages !== false,
        generateSeo: body.generateSeo !== false,
        enabled: true,
        createdAt: new Date().toISOString(),
        lastRunAt: new Date().toISOString()
      };
      recurringList.push(newRecurring);
      await c.env.FONTS_CACHE_KV.put("pinterest:recurring-batches", JSON.stringify(recurringList));
    } catch (err) {
      console.error("Error saving recurring batch to KV:", err);
    }
  }

  return c.json({ jobId, total: totalJobs, repeatDaily: !!body.repeatDaily }, 201);
});

app.get("/api/pinterest/batch/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  let raw = await c.env.FONTS_CACHE_KV?.get(`pinterest:job:${jobId}`);
  if (!raw) {
    raw = await c.env.FONTS_CACHE_KV?.get(`pinterest:batch:${jobId}`);
  }
  if (!raw) return c.json({ error: "Batch job not found" }, 404);
  return c.json(JSON.parse(raw));
});

// ── Unified Pinterest Queue Consumer Handler ────────────────────────────────

async function pinterestQueueHandler(batch: MessageBatch<any>, env: Env) {
  const db = drizzle(env.DB);

  for (const msg of batch.messages) {
    const { jobId, trend, variant, generateImages, generateSeo, model, channelId, nicheId } = msg.body;

    try {
      // Read current job status from KV (unified or legacy key)
      let jobKey = `pinterest:job:${jobId}`;
      let raw = await env.FONTS_CACHE_KV?.get(jobKey);
      if (!raw) {
        jobKey = `pinterest:batch:${jobId}`;
        raw = await env.FONTS_CACHE_KV?.get(jobKey);
      }

      if (!raw) {
        msg.ack();
        continue;
      }

      const job = JSON.parse(raw);

      // CANCELLATION CHECK: If job was cancelled by user, skip immediately!
      if (job.status === "cancelled") {
        msg.ack();
        continue;
      }

      if (generateImages) {
        const result = await generatePinterestCreative({
          keyword: trend.keyword,
          theme: trend.theme || "General",
          style: trend.style || "Modern",
          product: trend.product || "Interior",
          referenceImageUrl: trend.imageUrl || "",
          model: model || "flux"
        }, env);

        // Save to history with R2 URL
        await db.insert(pinterestHistory).values({
          jobId: jobId || null,
          nicheId: nicheId || null,
          accountChannelId: channelId || null,
          keyword: trend.keyword,
          theme: trend.theme || "General",
          style: trend.style || "Modern",
          product: trend.product || "Interior",
          promptUsed: result.promptUsed,
          negativePrompt: result.negativePrompt,
          fileName: generateFileName(trend.keyword, trend.theme || "general", variant),
          seoTitle: result.seo.title,
          seoDescription: result.seo.description,
          seoTags: JSON.stringify(result.seo.tags),
          seoAltText: result.seo.altText,
          modelUsed: result.modelUsed,
          generationTimeMs: result.generationTimeMs,
          referenceImageUrl: trend.imageUrl || null,
          generatedImageUrl: result.r2Url,
          status: "completed",
          createdAt: new Date().toISOString()
        });
      } else if (generateSeo) {
        // SEO-only generation
        const seo = await generatePinterestSEO(
          trend.keyword,
          trend.theme || "General",
          trend.style || "Modern",
          trend.product || "Interior",
          env
        );

        await db.insert(pinterestHistory).values({
          jobId: jobId || null,
          nicheId: nicheId || null,
          accountChannelId: channelId || null,
          keyword: trend.keyword,
          theme: trend.theme || "General",
          style: trend.style || "Modern",
          product: trend.product || "Interior",
          fileName: generateFileName(trend.keyword, trend.theme || "general", variant),
          seoTitle: seo.title,
          seoDescription: seo.description,
          seoTags: JSON.stringify(seo.tags),
          seoAltText: seo.altText,
          modelUsed: "deepseek-seo-only",
          status: "completed",
          createdAt: new Date().toISOString()
        });
      }

      // Update progress in KV
      job.completed = (job.completed || 0) + 1;
      if (job.completed + (job.failed || 0) >= job.total) {
        job.status = "completed";
        job.finishedAt = new Date().toISOString();
      }

      if (env.FONTS_CACHE_KV) {
        await env.FONTS_CACHE_KV.put(jobKey, JSON.stringify(job), { expirationTtl: 86400 * 7 });
        if (jobKey.startsWith("pinterest:job:")) {
          await env.FONTS_CACHE_KV.put(`pinterest:batch:${jobId}`, JSON.stringify(job), { expirationTtl: 86400 * 7 });
        }
      }

    } catch (err: any) {
      console.error(`Pinterest queue item failed:`, err);
      try {
        let jobKey = `pinterest:job:${jobId}`;
        let raw = await env.FONTS_CACHE_KV?.get(jobKey);
        if (!raw) {
          jobKey = `pinterest:batch:${jobId}`;
          raw = await env.FONTS_CACHE_KV?.get(jobKey);
        }

        if (raw) {
          const job = JSON.parse(raw);
          job.failed = (job.failed || 0) + 1;
          if ((job.completed || 0) + job.failed >= job.total) {
            job.status = "completed";
            job.finishedAt = new Date().toISOString();
          }
          if (env.FONTS_CACHE_KV) {
            await env.FONTS_CACHE_KV.put(jobKey, JSON.stringify(job), { expirationTtl: 86400 * 7 });
          }
        }
      } catch (kvErr) {
        console.error("Error updating failed KV job status:", kvErr);
      }
    }

    msg.ack();
  }
}

// Export default worker hooks
export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) {
    // Route to the correct handler based on queue name
    if (batch.queue === "pinterest-jobs") {
      await pinterestQueueHandler(batch, env);
    } else {
      await queueHandler(batch, env, ctx);
    }
  },
  async scheduled(event: any, env: Env, ctx: any) {
    ctx.waitUntil(syncOrders(env));
    ctx.waitUntil(runAutoPilotBatch(env));
    ctx.waitUntil(runRecurringBatches(env));
    ctx.waitUntil(runDailyMarketingDrip(env));
  }
};
