# STATE.md — JOTLayerRaid

> **Current Phase**: Cloudflare Serverless Architecture (v2.0)
> **Milestone**: v2.0 — Live Serverless Production
> **Last Updated**: 2026-08-27

---

## 🚀 Module Status Tracker

| Feature / Module | Status | Notes |
| :--- | :--- | :--- |
| **Monorepo Workspace** | ✅ Operational | Turborepo workspace with `apps/web` (Pages) and `apps/api-worker` (Workers). |
| **Interactive Canvas Editor**| ✅ Edge Compliant | Next.js 16 Edge runtime deployed to Cloudflare Pages (`(editor)/mockups/[id]/edit`). |
| **Satori Layout Engine** | ✅ Operational | Satori + resvg-wasm overlay renderer running in Cloudflare Worker. |
| **D1 Database Schema** | ✅ Migrated | 22 tables fully migrated and active in D1 (`jotlayerraid-db`). |
| **Cloud Store Integrations** | ✅ Operational | Multi-storefront engine supporting **WooCommerce** (`https://vulius.com`), **ShopBase**, and **Astro Site** (REST publishing & inbound webhook `/api/oms/webhook/astro`). |
| **WeChat PDF Logistics Hub** | ✅ Live in Prod | Multi-page Yanwen/USPS PDF parsing (`unpdf`), auto-matching with D1 orders, status sync to `"in transit"`, and automated shipping announcement email dispatch. |
| **Email Policy & Logistics** | ✅ Operational | Order confirmation emails disabled upon creation/sync; only live carrier tracking announcement emails are dispatched upon fulfillment. |
| **Pinterest Studio & Niche Libraries** | ✅ Operational & Live | DeepSeek AI niche generator, 6-level hierarchy, draft preview/approval in KV, Cartesian batch matrix, multi-account Autopilot, and dynamic RSS feeds. |
| **Background Queue Processing** | ✅ Configured | Cloudflare Queues (`bulk-jersey-jobs` & `pinterest-jobs`) handle bulk rendering and pin processing. |
| **D1 Concurrency Control** | ✅ Operational | Query batching (100 rows per transaction) to optimize D1 write limits. |
| **Font Caching & Batch KV** | ✅ Operational | TTF/OTF font assets and job progress tracked in `FONTS_CACHE_KV` namespace. |
| **CRM Support & Webhooks** | ✅ Operational | Customer support tickets, threading, inbound support email webhooks, and logistics auto-replies. |
| **Email Marketing & Outbound Composer** | ✅ Live in Prod | 4-mode campaign composer (Saved Templates, Local `.html` file attachment, Visual Builder, Raw HTML), live audience reach calculator, responsive desktop/mobile preview, domain warmup throttle (10-200/d), and D1 auto-seeding. |
| **Telegram Bot Alerting** | ✅ Active | Real-time Telegram alerts configured for new orders and support tickets on channel `-1003926357837`. |
| **Hosting & Cloud Deploy** | ✅ Live in Prod | Frontend on Cloudflare Pages (`jot-layer-raid-web.pages.dev`); Backend on Cloudflare Workers (`api-worker.justoneteeteam.workers.dev`). |
| **Supplier Excel Export** | ✅ Operational | Client-side ExcelJS spreadsheet generator with backend CORS-proxy and automated shipping status updates. |
| **Automated E2E Test Suite** | ✅ 20/20 Passed | Live test suite verifies all 8 frontend routes and 14 backend API endpoints against production URLs. |

---

## ⚡ Active Connections & Live Resources

| Service / Binding | Type | Resource ID / Name / URL |
| :--- | :--- | :--- |
| **`api-worker`** | Cloudflare Worker (Hono) | [https://api-worker.justoneteeteam.workers.dev](https://api-worker.justoneteeteam.workers.dev) |
| **`web`** | Cloudflare Pages (Next.js Edge) | [https://jot-layer-raid-web.pages.dev](https://jot-layer-raid-web.pages.dev) |
| **`DB`** | Cloudflare D1 (SQLite) | `d4e061cb-72cc-49f6-9562-092a3cd4a27b` (jotlayerraid-db) |
| **`FONTS_CACHE_KV`** | Workers KV Namespace | `f9d69ed778704bbea0b77e36ca454f8a` |
| **`BULK_QUEUE`** | Cloudflare Queue | `bulk-jersey-jobs` |
| **`PINTEREST_QUEUE`** | Cloudflare Queue | `pinterest-jobs` |
| **`BUCKET`** | Cloudflare R2 Bucket | `jot-layer-raid-bucket` (Public: `pub-3981afcf4d1b47279c20739515baec8f.r2.dev`) |
| **`EMAIL`** | Send Email Binding | Cloudflare Send Email Gateway |
| **`Telegram Bot`** | Alert Channel | Bot: `8882930959` / Channel ID: `-1003926357837` (JOT OMS Notification) |
| **`Target Stores`** | Connected Channels | WooCommerce (`https://vulius.com`), ShopBase, Astro Site (`/api/oms/webhook/astro`) |

---

## 🎯 Active Goals & Operations

1. **Monitor Worker Traffic**: Track API requests and queue executions through the Cloudflare Worker console.
2. **Pinterest Content Scaling**: Generate and approve new niche content libraries for targeted verticals (e.g. AI tools, SaaS workflows, athletic apparel, home decor).
3. **Daily Midnight Sync**: Verify the Cron trigger (`0 0 * * *`) synchronizes WooCommerce, ShopBase, and Astro storefront orders into D1.
4. **Multi-Account Autopilot**: Keep RSS channels connected with Pinterest Business auto-publishing with 0 duplicate creatives across accounts.
