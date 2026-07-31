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
  pinterestHistory
} from "./db/schema";
import { uploadToR2, getFromR2, deleteFromR2 } from "./services/r2-storage";
import { generateJersey } from "./services/image-engine";
import { generatePinterestCreative, generatePinterestSEO, generateFileName } from "./services/pinterest-ai";
import { buildPinterestRSSFeed } from "./services/rss-service";
import { runAutoPilotBatch, DEFAULT_CHANNELS } from "./services/autopilot";
import bcrypt from "bcryptjs";
import { sign } from "hono/jwt";
import { syncOrders } from "./services/oms-sync";

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for frontend and other origins
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"]
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

    const existing = await db.select()
      .from(orders)
      .where(and(eq(orders.orderId, orderId), eq(orders.productName, productName)))
      .limit(1);

    if (existing.length === 0) {
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
      }).returning();

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
    } else {
      return c.json({ status: "ok", message: "Astro order already exists.", order_id: orderId });
    }
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

  const inserted = await db.insert(orders).values(newOrder).returning();

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
  const body = await c.req.json();
  
  const result = await db.insert(stores).values({
    name: body.name,
    platform: body.platform.toLowerCase(),
    url: body.url.replace(/\/$/, ""),
    apiKey: body.api_key,
    apiSecret: body.api_secret,
    isActive: true,
    createdAt: new Date().toISOString()
  }).returning();

  return c.json({
    id: result[0].id,
    name: result[0].name,
    platform: result[0].platform
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

    const newTicket = result[0];

    const escapedSnippet = bodyText.slice(0, 300).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const telegramMessage = `📥 <b>[New Support Ticket #${newTicket.id}]</b>\n` +
      `<b>From:</b> ${senderName} (${sender})\n` +
      `<b>Subject:</b> ${subject}\n\n` +
      `<blockquote>${escapedSnippet}</blockquote>\n\n` +
      `👉 <a href="https://jot-layer-raid-web.pages.dev/oms/tickets">Open Support Dashboard</a>`;
    c.executionCtx.waitUntil(notifyTelegram(telegramMessage, c.env));

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

// Multi-Account Auto-Pilot Trigger Endpoint
app.post("/api/pinterest/autopilot/run", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const channels = body.channels || DEFAULT_CHANNELS;
    const results = await runAutoPilotBatch(c.env, channels);
    return c.json({ ok: true, generatedCount: results.length, items: results });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// Pinterest Settings (KV-based)
app.get("/api/pinterest/settings", async (c) => {
  const raw = await c.env.FONTS_CACHE_KV.get("pinterest:settings");
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
  await c.env.FONTS_CACHE_KV.put("pinterest:settings", JSON.stringify(body));
  return c.json({ saved: true });
});

// Pinterest Batch Generation (supports direct trends or multi-select combinations matrix)
app.post("/api/pinterest/batch", async (c) => {
  const body = await c.req.json();
  const jobId = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

  let combinations: Array<{ keyword: string; theme: string; style: string; product: string; imageUrl: string }> = [];

  if (body.imageUrls && Array.isArray(body.imageUrls) && body.imageUrls.length > 0) {
    // Multi-select combination mode: Images x Keywords x Themes x Styles
    const keywords: string[] = body.keywords?.length ? body.keywords : ["Pinterest Trend"];
    const themes: string[] = body.themes?.length ? body.themes : ["General"];
    const styles: string[] = body.styles?.length ? body.styles : ["Modern"];
    const product = body.product || "Creative Decor";

    for (const url of body.imageUrls) {
      if (!url || !url.trim()) continue;
      for (const kw of keywords) {
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
  } else {
    // Single-trend mode
    combinations = body.trends || [];
  }

  const totalJobs = combinations.length * (body.variants || 1);

  // Save batch job metadata to KV
  await c.env.FONTS_CACHE_KV.put(`pinterest:batch:${jobId}`, JSON.stringify({
    jobId,
    status: "running",
    total: totalJobs,
    completed: 0,
    failed: 0,
    generateImages: body.generateImages !== false,
    generateSeo: body.generateSeo !== false,
    variants: body.variants || 1,
    createdAt: new Date().toISOString()
  }), { expirationTtl: 86400 * 7 });

  // Enqueue each combination item
  for (const combo of combinations) {
    for (let v = 0; v < (body.variants || 1); v++) {
      await c.env.PINTEREST_QUEUE.send({
        jobId,
        trend: combo,
        variant: v + 1,
        generateImages: body.generateImages !== false,
        generateSeo: body.generateSeo !== false,
        model: body.model || "qwen"
      });
    }
  }

  return c.json({ jobId, total: totalJobs }, 201);
});

app.get("/api/pinterest/batch/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const raw = await c.env.FONTS_CACHE_KV.get(`pinterest:batch:${jobId}`);
  if (!raw) return c.json({ error: "Batch job not found" }, 404);
  return c.json(JSON.parse(raw));
});

// ── Queue Handler (supports both jersey bulk + pinterest batch) ──────────────

async function pinterestQueueHandler(batch: MessageBatch<any>, env: Env) {
  const db = drizzle(env.DB);

  for (const msg of batch.messages) {
    const { jobId, trend, variant, generateImages, generateSeo, model } = msg.body;

    try {
      // Read current job status
      const raw = await env.FONTS_CACHE_KV.get(`pinterest:batch:${jobId}`);
      if (!raw) { msg.ack(); continue; }
      const job = JSON.parse(raw);

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

      // Update batch progress
      job.completed++;
      if (job.completed + job.failed >= job.total) {
        job.status = "completed";
      }
      await env.FONTS_CACHE_KV.put(`pinterest:batch:${jobId}`, JSON.stringify(job), { expirationTtl: 86400 * 7 });

    } catch (err: any) {
      console.error(`Pinterest batch item failed:`, err);
      try {
        const raw = await env.FONTS_CACHE_KV.get(`pinterest:batch:${jobId}`);
        if (raw) {
          const job = JSON.parse(raw);
          job.failed++;
          if (job.completed + job.failed >= job.total) {
            job.status = "completed";
          }
          await env.FONTS_CACHE_KV.put(`pinterest:batch:${jobId}`, JSON.stringify(job), { expirationTtl: 86400 * 7 });
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
  }
};
