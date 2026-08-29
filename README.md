# JOTLayerRaid (v2.0 Serverless)

> **AI-Powered Jersey Mockup Studio, Multi-Store Product Publisher & Automated Pinterest Content Engine**

Built entirely on **Cloudflare Serverless Edge Architecture** (Cloudflare Pages + Cloudflare Workers + D1 SQLite + R2 + KV + Cloudflare Queues).

---

## 🌟 Key Features

1. **AI Layer Decomposition**: Upload sports jerseys; isolate nameplate and number into transparent, repositionable RGBA layers via **Qwen-Image-Layered**.
2. **Interactive Canvas Layout Editor**: Place, rotate, resize text and sponsor patches on live canvas with athletic block fonts via **Fabric.js**.
3. **Serverless Satori Compositor**: High-throughput variant generation using **Satori + resvg-wasm** image rasterization inside Workers (no heavy Python/Pillow dependencies).
4. **Multi-Store Product Publishing**: Automated publishing to **WooCommerce** (`https://vulius.com`), **ShopBase**, and headless **Astro Site** (`/api/oms/webhook/astro`).
5. **WeChat PDF Logistics & Auto-Fulfillment**:
   - **Multi-Page Batch Parsing**: Direct WebAssembly/pure-JS PDF parsing on Cloudflare Workers edge via **`unpdf`**.
   - **Intelligent Tracking & Recipient Extraction**: Identifies Yanwen international barcodes and 22-digit USPS tracking numbers paired with customer name matching.
   - **Two-Pass Matching & Email Announcer**: Categorizes into High Confidence, Duplicate Warnings, and Unmatched Slips, sets order status to `"in transit"`, and dispatches shipping emails with 1-click live 17Track tracking links.
6. **Pinterest Studio & AI Niche Architecture**:
   - **DeepSeek Niche Content Synthesis**: Generate structured 5+ Themes, 15–25 Styles, 6–8 Content Types, 6–10 Recipes, and SEO direction from a single niche input.
   - **KV Draft Staging & Safety**: 24h temporary preview/editing in KV before committing to production D1 database.
   - **Cartesian Matrix Batch Generator**: Multi-dimensional generation across URLs × Keywords × Content Types × Themes × Styles × Recipes.
   - **Multi-Account Autopilot**: Niche-bound channel distribution with guaranteed 0 duplicate creatives across accounts.
   - **Dynamic Media RSS 2.0 XML Feeds**: Live feeds with niche/theme filters for Pinterest Business auto-publishing.
7. **Customer CRM & Deliverability**:
   - Cloudflare `EMAIL` binding for transactional & deliverability emails.
   - Inbound email webhook parser, support ticket threading, and auto-reply templates.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Frontend** | **Next.js 16** (App Router, Edge Runtime) | Dashboard, Fabric.js interactive canvas, hosted on **Cloudflare Pages** |
| **UI System** | **Shadcn UI** + **Radix Primitives** | Minimalist, light-theme design with custom CSS tokens |
| **Backend API** | **Hono** (TypeScript) | Ultra-fast REST router running on **Cloudflare Workers** |
| **AI Engine** | **DeepSeek Chat** + **Workers AI** + **Qwen** | Niche library generation, SEO text synthesis, image generation |
| **Compositing** | **Satori + resvg-wasm** | Serverless SVG rendering & WebAssembly PNG rasterization |
| **Database** | **Cloudflare D1** (SQLite) + **Drizzle ORM** | 22 relational tables managing catalog, OMS, CRM, and Pinterest libraries |
| **Job Queues** | **Cloudflare Queues** | Horizontal background processing (`bulk-jersey-jobs`, `pinterest-jobs`) |
| **Storage & Caching** | **Cloudflare R2** & **KV** | R2 bucket for images/fonts; KV namespace for fonts & 24h niche drafts |
| **Email Gateway** | **Cloudflare Send Email** | Serverless transactional emails via `EMAIL` binding |

---

## ☁️ Live Environments

| Service | Type | Production URL |
|:---|:---|:---|
| **Frontend Web** | Cloudflare Pages | [https://jot-layer-raid-web.pages.dev](https://jot-layer-raid-web.pages.dev) |
| **Backend API** | Cloudflare Worker | [https://api-worker.justoneteeteam.workers.dev](https://api-worker.justoneteeteam.workers.dev) |
| **R2 Asset Storage** | Cloudflare R2 | `pub-3981afcf4d1b47279c20739515baec8f.r2.dev` |

---

## 🚀 Pinterest Niche-First Workflow

```
NICHE                  e.g. "ChatGPT Education for Marketers"
  │
  ├── CONTENT TYPES    e.g. Prompt Card, Infographic, Step-by-Step, Workflow Diagram
  │
  ├── THEMES           e.g. Marketing Prompt Mastery, AI Marketing Workflows
  │
  ├── STYLES           e.g. Modern SaaS, Dark AI, Editorial Education, Minimal Tech
  │
  └── RECIPES          e.g. Vertical 2:3, prompt container box, 3 takeaway bullets
```

```mermaid
flowchart LR
    A["👤 User Input: Niche"] --> B["🤖 DeepSeek Chat"]
    B --> C["📋 KV Draft (24h TTL)"]
    C --> D["👁️ Preview & JSON Editor"]
    D -->|Approve| E["💾 D1 Database"]
    E --> F["📦 Batch Matrix Generator"]
    F --> G["🖼️ Image Generation (FLUX/Qwen)"]
    G --> H["☁️ Cloudflare R2"]
    H --> I["📡 Dynamic RSS XML Feeds"]
    I --> J["📌 Pinterest Auto-Publishing"]
```

---

## 💻 Local Development Setup

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Wrangler CLI** ≥ 3.114

### Quick Start

```bash
# 1. Clone repo
git clone https://github.com/your-org/JOTLayerRaid.git
cd JOTLayerRaid

# 2. Install workspace dependencies
pnpm install

# 3. Start local development (Turbo)
pnpm dev
```

### Build & Deploy Commands

```bash
# Type check all packages
pnpm check-types

# Build Next.js frontend
pnpm --filter web build

# Build Next.js for Cloudflare Pages (Edge output)
pnpm --filter web run pages:build

# Deploy Frontend to Cloudflare Pages
pnpm --filter web exec wrangler pages deploy .vercel/output/static --project-name=jot-layer-raid-web

# Deploy Backend Worker
pnpm --filter api-worker exec wrangler deploy

# Execute D1 database queries/migrations
pnpm --filter api-worker exec wrangler d1 execute jotlayerraid-db --remote --command="SELECT COUNT(*) FROM pinterest_niches;"
```

---

## 📁 Repository Structure

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

---

## 📄 License

Private — JOT All rights reserved.
