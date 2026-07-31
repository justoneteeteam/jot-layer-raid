# PROJECT.md — JOTLayerRaid

> **Status**: Active / Connected to Cloudflare Serverless
> **Last Updated**: 2026-07-15 4:45 PM
> **Owner**: JOT (justoneteeteam@gmail.com)

---

## 🌌 Vision

**JOTLayerRaid** is an AI-powered jersey mockup generator and multi-store product publisher. It enables rapid high-volume customized sports jersey dropshipping workflows:
1. **Upload** a raw jersey mockup image.
2. **Decompose** the nameplate and number layers into transparent, repositionable RGBA image layers via state-of-the-art **Qwen-Image-Layered** AI model.
3. **Customize** layout configurations, custom block fonts, and sponsor/patch positions via an interactive **Fabric.js** editor.
4. **Bulk Generate** thousands of individual player name/number variants using a high-performance **Satori + resvg-wasm** layout engine.
5. **Publish** products automatically to WooCommerce and ShopBase stores with custom sizing tables, pricing structures, and dynamic SEO metadata.
6. **Roster Scrape** roster rosters weekly from Yahoo Sports to keep player databases up to date with automated admin approvals.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose / Notes |
| :--- | :--- | :--- |
| **Frontend** | Next.js 16 (Edge Runtime) | React dashboard, Fabric.js interactive canvas, hosted on **Cloudflare Pages** (`https://jot-layer-raid-web.pages.dev`). |
| **UI Theme** | Shadcn UI & Radix | Clean, light-theme minimalist design system. |
| **Backend** | Hono (TypeScript) | Light, ultra-fast backend framework running on **Cloudflare Workers** (`https://api-worker.justoneteeteam.workers.dev`). |
| **AI Processing** | Qwen-Image-Layered | Alibaba's model for decomposing raw mockups into layered RGBA elements. |
| **Image Compositing** | Satori + resvg-wasm | Serverless SVG rendering and WebAssembly PNG rasterization engine replacing heavy Python Pillow/Cairo libs. |
| **Database** | Cloudflare D1 (SQLite) | Relational SQL database with Drizzle ORM managing teams, players, templates, syncs, and user sessions. |
| **Job Queue** | Cloudflare Queues | Serverless message queuing (`bulk-jersey-jobs`) to scale out bulk layout rendering horizontally. |
| **Cache (Fonts)** | Cloudflare KV | Namespace cache (`FONTS_CACHE_KV`) preventing R2 disk read overhead during font rendering. |
| **Scheduler** | Cloudflare Cron Triggers | Triggers weekly WooCommerce, ShopBase, and Astro order syncs. |
| **Notifications** | Telegram Bot API | Instant alerts for newly synced orders and customer support ticket events. |
| **File Storage** | Cloudflare R2 | Storage bucket (`BUCKET`) for base layers, custom block fonts, sponsor patches, and generated jersey designs. |

---

## ☁️ Cloudflare Deployment & Live Environments

The project is deployed on Cloudflare:
* **API Domain**: `https://api-worker.justoneteeteam.workers.dev`
* **Web Domain**: `https://jot-layer-raid-web.pages.dev`

### Connected Resources

| Service / Resource | Type | Live URL / Connection |
| :--- | :--- | :--- |
| **`api-worker`** | Worker (Hono Router) | `api-worker.justoneteeteam.workers.dev` |
| **`web`** | Pages (Next.js Edge) | `jot-layer-raid-web.pages.dev` |
| **`D1 Database`** | jotlayerraid-db | `d4e061cb-72cc-49f6-9562-092a3cd4a27b` |
| **`KV Namespace`** | FONTS_CACHE_KV | `f9d69ed778704bbea0b77e36ca454f8a` |
| **`R2 Bucket`** | BUCKET | `jot-layer-raid-bucket` |
| **`Queues`** | BULK_QUEUE | `bulk-jersey-jobs` |

---

## 📁 Key File Map

```
jot-layer-raid/
├── apps/
│   ├── web/                          # Next.js 16 (Cloudflare Pages)
│   │   ├── app/
│   │   │   ├── (dashboard)/          # Dashboard landing, database, bulk configuration
│   │   │   └── (editor)/mockups/...  # Fabric.js jersey mockup editor & layout builder
│   │   ├── wrangler.jsonc            # Pages project config
│   │   └── package.json
│   │
│   └── api-worker/                   # Hono (Cloudflare Workers)
│       ├── src/
│       │   ├── index.ts              # API entrypoint (GET/POST routes + Queue consumer + Cron handler)
│       │   ├── db/
│       │   │   └── schema.ts         # Drizzle SQLite Schema mappings
│       │   ├── services/             # Core logic (image-engine, r2-storage, oms-sync)
│       │   └── types.ts              # Worker environment bindings types
│       ├── drizzle/                  # Schema Migrations
│       ├── wrangler.jsonc            # Worker project bindings & Cron triggers
│       └── package.json
│
├── package.json                      # Monorepo packages root
├── pnpm-workspace.yaml               # Monorepo workspace config
└── turbo.json                        # Turborepo task runner
```
