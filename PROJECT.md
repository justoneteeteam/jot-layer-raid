# PROJECT.md — JOTLayerRaid

> **Status**: Active / Connected to Railway
> **Last Updated**: 2026-05-29
> **Owner**: JOT (justoneteeteam@gmail.com)

---

## 🌌 Vision

**JOTLayerRaid** is an AI-powered jersey mockup generator and multi-store product publisher. It enables rapid high-volume customized sports jersey dropshipping workflows:
1. **Upload** a raw jersey mockup image.
2. **Decompose** the nameplate and number layers into transparent, repositionable RGBA image layers via state-of-the-art **Qwen-Image-Layered** AI model.
3. **Customize** layout configurations, custom block fonts, and sponsor/patch positions via an interactive **Fabric.js** editor.
4. **Bulk Generate** thousands of individual player name/number variants using a high-performance **Pillow** image overlay engine.
5. **Publish** products automatically to WooCommerce and ShopBase stores with custom sizing tables, pricing structures, and dynamic SEO metadata.
6. **Roster Scrape** roster rosters weekly from Yahoo Sports to keep player databases up to date with automated admin approvals.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose / Notes |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15 (App Router) | React dashboard, Fabric.js interactive canvas, real-time bulk job progress tracking. |
| **UI Theme** | Shadcn UI & Radix | Clean, light-theme minimalist design system. |
| **Backend** | FastAPI (Python 3.12) | REST API endpoints, WebSocket servers, image processing. |
| **AI Processing** | Qwen-Image-Layered | Alibaba's diffusion model for decomposing raw mockups into layered RGBA elements. |
| **Image Compositing** | Pillow (PIL) | Super-fast flat text and patch overlay rendering engine for bulk job outputs. |
| **Database** | PostgreSQL / Supabase | Relational tables for teams, players, mockup templates, store configurations, and bulk jobs. |
| **Job Queue** | Celery + Redis | Asynchronous workers for bulk image generation, R2 uploads, and store publishing. |
| **Scheduler** | Celery Beat | Triggers weekly Yahoo Sports roster scraping jobs on Mondays. |
| **File Storage** | Cloudflare R2 | Storage bucket for blank mockup layers, custom block fonts, branding patches, and generated product variants. |

---

## ☁️ Railway Deployment & Live Environments

The project is linked to the active Railway environment:
* **Project ID**: `a4f5dd05-f7a2-426d-a2e2-29cf27830749`
* **Project Name**: `inspiring-endurance`

### Connected Resources

| Service / Resource | Type | Live URL / Connection |
| :--- | :--- | :--- |
| **`jot-layer-raid`** | FastAPI Backend Service | [https://jot-layer-raid-production.up.railway.app](https://jot-layer-raid-production.up.railway.app) |
| **`web`** | Next.js Web App Service | [https://product.justonetee.org](https://product.justonetee.org) |
| **`Postgres`** | PostgreSQL Database | `https://postgres-production-e204.up.railway.app` |
| **`Redis`** | Redis Broker & Cache | Internal Redis Volume |

---

## 📁 Key File Map

```
jot-layer-raid/
├── apps/
│   ├── web/                          # Next.js 15
│   │   ├── app/
│   │   │   ├── (dashboard)/          # Dashboard landing, database, bulk configuration
│   │   │   └── (editor)/mockups/...  # Fabric.js jersey mockup editor & layout builder
│   │   └── package.json
│   │
│   └── api/                          # FastAPI
│       ├── main.py                   # App entrypoint
│       ├── config.py                 # Env/Pydantic configurations
│       ├── routers/                  # API routers (mockups, bulk, database, stores, OMS)
│       └── services/                 # core logic (image_engine, r2_storage, auth)
│
├── Dockerfile.api                    # FastAPI production build file
├── Dockerfile.web                    # Next.js production build file
├── package.json                      # Monorepo packages root
└── pnpm-workspace.yaml               # Monorepo workspace config
```
