# PROJECT.md — JOTLayerRaid

> **Status**: 🚀 Live in Production (Cloudflare Serverless Architecture v2.0)
> **Last Updated**: 2026-08-27
> **Owner**: JOT (justoneteeteam@gmail.com)

---

## 🌌 Vision & Core Capabilities

**JOTLayerRaid** is an enterprise-grade AI jersey mockup generator, multi-store product publisher, and automated Pinterest creative studio built on an ultra-fast Cloudflare serverless edge architecture:

1. **AI Layer Separation**: Upload raw jersey mockups; decompose nameplate and number into transparent, repositionable RGBA layers via **Qwen-Image-Layered**.
2. **Interactive Canvas Editor**: Customize layouts, custom athletic block fonts, and sponsor/patch coordinates via **Fabric.js**.
3. **High-Performance Bulk Compositing**: Generate thousands of customized player variants using serverless **Satori + resvg-wasm** image rasterization directly inside Cloudflare Workers.
4. **Multi-Storefront Publishing**:
   * **WooCommerce** (`https://vulius.com`): Automated media uploads, variable sizing, and taxonomy mapping.
   * **ShopBase** (`https://mystore.onshopbase.com`): Admin REST API order sync, fulfillment tracking, and catalog management.
   * **Astro Headless Site** (`https://vulius.com`): REST product publisher & inbound order webhook (`/api/oms/webhook/astro`).
5. **WeChat PDF Logistics & Auto-Fulfillment**:
   * **Multi-Page Batch PDF Parsing**: Pure-JS / WebAssembly extraction via **`unpdf`** directly on Cloudflare Workers edge.
   * **Smart Barcode & Recipient Parser**: Automatically detects international Yanwen barcodes (`UL...YP`) and 22-digit USPS tracking codes, paired with recipient name normalization.
   * **Two-Pass Order Matcher**: Categorizes into High Confidence, Duplicate Warnings, and Unmatched Slips against active D1 database orders.
   * **Instant Shipping Announcements**: Synchronizes tracking to all order line items, sets status to `"in transit"`, and dispatches branded customer emails with 1-click live 17Track tracking buttons.
6. **Pinterest Studio & AI Niche Architecture**:
   * **AI Niche Generation (DeepSeek Chat)**: Single-input (`"ChatGPT Education for Marketers"`) generates full structured libraries: 5+ Themes, 15-25 Styles, 6-8 Content Types, 6-10 Recipes, and SEO direction.
   * **Safety Staging**: DeepSeek generates content configurations saved into KV drafts (24h TTL) for interactive preview/editing before one-click approval into D1 database.
   * **Cartesian Batch Matrix Generator**: Multi-dimensional generation across URLs × Keywords × Content Types × Themes × Styles × Recipes.
   * **Multi-Account Autopilot**: Niche-bound channel allocations with guaranteed zero content duplication across accounts.
   * **Dynamic Media RSS 2.0 Feeds**: Feed URLs with niche and theme filters for Pinterest Business auto-publishing.
7. **Customer CRM, Outbound Email Marketing & Campaign Composer**:
   * **Visual Outbound Campaign Composer**: 4-mode content engine supporting **Saved D1 Templates**, **Direct Local `.html` File Attachments**, **Visual Builder** (Sports Promo, Minimalist, Bold Alert), and **Raw HTML Editor**.
   * **Audience Segmentation & Live Reach Engine**: Dynamic segmentation across global subscribers, store-specific lists (WaiRaiders Store, Vulius Store), and MX-verified contacts with live metrics (total, valid deliverable, auto-excluded invalid/bounced, sample recipients preview).
   * **Real-Time Responsive Device Preview**: Real-time iframe/HTML render with 🖥️ Desktop (600px) and 📱 Mobile (375px) device viewport toggles.
   * **Production Fluid Hybrid Email Architecture**: Multi-client compatible responsive templates (`wairaiders-jersey-showcase-template.html`) with real CDN jersey photography, MSO ghost tables, touch-friendly 48px CTAs, and anti-collapsing preheaders.
   * **Cloudflare Email Deliverability & Warmup**: Send Email binding (`EMAIL`) with daily send throttle (10/d, 20/d, 50/d, 200/d) for domain warmup and suppression tracking.
8. **Roster Synchronization**:
   * Scrapes Yahoo Sports weekly to detect roster changes, pending admin approvals.
9. **Supplier Order Logistics**:
   * Client-side ExcelJS spreadsheet generator with backend CORS-proxy and automated shipping status sync.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose / Notes |
| :--- | :--- | :--- |
| **Frontend** | Next.js 16 (Edge Runtime) | React dashboard, Fabric.js interactive canvas, hosted on **Cloudflare Pages** (`https://jot-layer-raid-web.pages.dev`). |
| **UI Theme** | Shadcn UI & Radix | Clean, light-theme minimalist design system with CSS custom properties. |
| **Backend** | Hono (TypeScript) | Light, ultra-fast backend framework running on **Cloudflare Workers** (`https://api-worker.justoneteeteam.workers.dev`). |
| **AI Processing** | Qwen-Image-Layered, DeepSeek Chat, Workers AI | Layer separation, niche content library synthesis, and SEO copywriting. |
| **Image Compositing** | Satori + resvg-wasm | Serverless SVG rendering and WebAssembly PNG rasterization engine. |
| **Database** | Cloudflare D1 (SQLite) | 22 relational tables with Drizzle ORM managing teams, players, templates, syncs, CRM tickets, and Pinterest niche libraries. |
| **Job Queues** | Cloudflare Queues | Serverless message queuing (`bulk-jersey-jobs` & `pinterest-jobs`) to scale out bulk layout and pin rendering horizontally. |
| **Cache & Drafts** | Cloudflare KV | Namespace cache (`FONTS_CACHE_KV`) for font assets, batch job progress, and 24h AI niche drafts. |
| **Email Gateway** | Cloudflare Send Email | Serverless transactional & deliverability emails via `EMAIL` binding. |
| **Scheduler** | Cloudflare Cron Triggers | Triggers daily midnight order sync (WooCommerce, ShopBase, Astro), autopilot generation, and image verification (`0 0 * * *`). |
| **Notifications** | Telegram Bot API | Instant alerts for newly synced orders and customer support ticket events. |
| **File Storage** | Cloudflare R2 | Storage bucket (`BUCKET`) for base layers, custom block fonts, sponsor patches, and generated designs. |

---

## ☁️ Cloudflare Deployment & Live Environments

* **API Domain**: [`https://api-worker.justoneteeteam.workers.dev`](https://api-worker.justoneteeteam.workers.dev)
* **Web Domain**: [`https://jot-layer-raid-web.pages.dev`](https://jot-layer-raid-web.pages.dev)

### Connected Resources

| Service / Resource | Type | Live Resource ID / Target |
| :--- | :--- | :--- |
| **`api-worker`** | Worker (Hono Router) | `https://api-worker.justoneteeteam.workers.dev` |
| **`web`** | Pages (Next.js Edge) | `https://jot-layer-raid-web.pages.dev` |
| **`D1 Database`** | jotlayerraid-db | `d4e061cb-72cc-49f6-9562-092a3cd4a27b` (22 Tables) |
| **`KV Namespace`** | FONTS_CACHE_KV | `f9d69ed778704bbea0b77e36ca454f8a` |
| **`R2 Bucket`** | BUCKET | `jot-layer-raid-bucket` (Public: `pub-3981afcf4d1b47279c20739515baec8f.r2.dev`) |
| **`Queues`** | BULK_QUEUE / PINTEREST_QUEUE | `bulk-jersey-jobs` / `pinterest-jobs` |
| **`Email Binding`** | Send Email | Cloudflare `EMAIL` binding |
| **`Telegram Bot`** | Alert Channel | Bot: `8882930959` / Channel: `-1003926357837` |
| **`Target Stores`** | Multi-Store Connections | WooCommerce (`https://vulius.com`), ShopBase, Astro Site (`/api/oms/webhook/astro`) |

---

## 🗄️ Database Tables (22 Tables in D1)

1. **`users`**: User accounts & roles (`admin`, etc.)
2. **`leagues`**: Sports leagues (NFL, MLB, NBA, NHL, NCAA)
3. **`teams`**: Team master records with slug, colors, and league IDs
4. **`players`**: Roster records with numbers, positions, and active status
5. **`mockup_templates`**: Jersey template metadata and canvas layout JSON
6. **`fonts`**: TTF/OTF font file records and categories
7. **`patches`**: Sponsor patches and shoulder badge assets
8. **`bulk_jobs`**: Master bulk generation jobs with status and counts
9. **`bulk_job_items`**: Individual variant renders in queue
10. **`stores`**: Connected storefront configurations
11. **`synced_products`**: Multi-store published SKU mappings
12. **`orders`**: Synchronized customer orders across WooCommerce, ShopBase, and Astro
13. **`tickets`**: Customer CRM tickets with threading and status
14. **`roster_changes`**: Pending roster approvals from Yahoo Sports scraper
15. **`email_sender_identities`**: Verified sender domains and email addresses
16. **`email_suppressions`**: Email suppression list (bounces, unsubscribes)
17. **`email_logs`**: Outbound delivery logs with message IDs and status
18. **`pinterest_niches`**: Niche market configuration, audience, language, and raw AI payloads
19. **`pinterest_content_types`**: Presentation formats (Prompt Card, Infographic, Workflow Diagram, etc.)
20. **`pinterest_themes`**: Niche-specific topic angles with descriptions and recommended styles
21. **`pinterest_prompts`**: Aesthetic visual styles with positive/negative prompts and palettes
22. **`pinterest_recipes`**: Construction rules linking Content Types to visual prompt blueprints
23. **`pinterest_theme_styles`**: Junction table mapping many-to-many theme-style compatibilities
24. **`pinterest_history`**: Rendered pins catalog with niche, content type, recipe, SEO metadata, and R2 URLs
25. **`pinterest_trends`**: Trend analysis queue

---

## 📁 Monorepo File Map

```
jot-layer-raid/
├── apps/
│   ├── web/                                  # Next.js 16 Edge (Cloudflare Pages)
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── pinterest/
│   │   │   │   │   ├── niches/               # Niche Library Manager list
│   │   │   │   │   │   ├── create/           # 3-step AI Niche Creation Wizard
│   │   │   │   │   │   └── [id]/             # Niche Detail Viewer (Edge Runtime)
│   │   │   │   │   ├── batch/                # Niche-first Cartesian Batch Generator
│   │   │   │   │   ├── autopilot/            # Multi-account autopilot with niche selector
│   │   │   │   │   ├── rss/                  # Dynamic niche & theme Media RSS feeds
│   │   │   │   │   ├── generate/             # Single pin AI generator
│   │   │   │   │   ├── history/              # Generated pins gallery
│   │   │   │   │   ├── themes/               # Standalone themes manager
│   │   │   │   │   ├── prompts/              # Standalone styles manager
│   │   │   │   │   └── settings/             # API keys and Pinterest configs
│   │   │   │   ├── oms/                      # Order management, sync & customers
│   │   │   │   ├── marketing/                # Email campaigns & deliverability
│   │   │   │   ├── database/                 # Teams, players & font libraries
│   │   │   │   └── mockups/                  # Mockup template catalog
│   │   │   └── (editor)/mockups/[id]/edit/   # Fabric.js interactive canvas editor (Edge Runtime)
│   │   ├── wrangler.jsonc                    # Pages project config
│   │   └── package.json
│   │
│   └── api-worker/                           # Hono (Cloudflare Workers)
│       ├── src/
│       │   ├── index.ts                      # API router (Niches, OMS, Mockups, Queue handler, Cron)
│       │   ├── db/
│       │   │   └── schema.ts                 # Drizzle SQLite ORM schema (22 tables)
│       │   ├── services/
│       │   │   ├── niche-generator.ts        # DeepSeek AI Niche Library synthesis & validation
│       │   │   ├── pinterest-ai.ts           # Creative rendering, Flux/Qwen/OpenAI, SEO copywriting
│       │   │   ├── autopilot.ts              # Zero-duplication multi-account channel engine
│       │   │   ├── rss-service.ts            # Media RSS 2.0 XML builder with niche/theme filters
│       │   │   ├── image-engine.ts           # Satori + resvg-wasm layer rasterizer
│       │   │   ├── r2-storage.ts             # Cloudflare R2 bucket upload/delete
│       │   │   ├── oms-sync.ts               # WooCommerce, ShopBase & Astro sync
│       │   │   ├── wechat-service.ts         # Multi-page PDF text extraction & order matcher (unpdf)
│       │   │   └── email-service.ts          # Cloudflare EMAIL binding delivery
│       │   └── types.ts                      # TypeScript Worker bindings interface
│       ├── drizzle/                          # Drizzle SQL migrations
│       ├── wrangler.jsonc                    # Worker bindings, D1, KV, Queues, Crons
│       └── package.json
│
├── package.json                              # Monorepo root
├── pnpm-workspace.yaml                       # PNPM workspace
├── PROJECT.md                                # System architecture & project documentation
├── STATE.md                                  # Operational module status tracker
├── README.md                                 # User & developer guide
└── turbo.json                                # Turborepo configuration
```
