# STATE.md — JOTLayerRaid

> **Current Phase**: Cloudflare Serverless Architecture (v2.0)
> **Milestone**: v2.0 — Live Serverless Production
> **Last Updated**: 2026-07-15 4:45 PM

---

## 🚀 Module Status Tracker

| Feature / Module | Status | Notes |
| :--- | :--- | :--- |
| **Monorepo Structure** | ✅ Operational | Turborepo workspace with `apps/web` (Pages) and `apps/api-worker` (Workers). |
| **Interactive Canvas Editor**| ✅ Edge Compliant | Next.js 16 Edge runtime deployed to Cloudflare Pages. |
| **Satori Layout Engine** | ✅ Operational | Replaced Pillow with Satori + resvg-wasm overlay renderer inside the Worker. |
| **D1 Database Schema** | ✅ Migrated | Drizzle SQLite schema defined and applied. 15 tables fully migrated and running in D1. |
| **Cloud Store Uploads** | ✅ Ported | WooCommerce, ShopBase, and Astro storefront sync written in TypeScript. |
| **Background Processing** | ✅ Configured | Cloudflare Queues (`bulk-jersey-jobs`) handles bulk jersey render queues. |
| **D1 Concurrency Control** | ✅ Operational | Implemented query batching (100 rows per transaction) to optimize D1 write limits. |
| **Font Caching (KV)** | ✅ Operational | TTF/OTF font assets stored and fetched through `FONTS_CACHE_KV` namespace. |
| **CRM Support & Webhooks** | ✅ Operational | Customer support tickets, replies, and inbound support email webhooks fully running on Hono. |
| **Telegram Bot Alerting** | ✅ Active | Real-time Telegram alerts configured for new orders and support tickets. |
| **Hosting & Cloud Deploy** | ✅ Live | Frontend on Cloudflare Pages; Backend API on Cloudflare Workers. |
| **Supplier Excel Export** | ✅ Operational | Client-side ExcelJS spreadsheet generator with backend CORS-proxy and automated shipping status updates. |

---

## ⚡ Active Connections & Live Resources

| Service / Binding | Type | Resource ID / Name / URL |
| :--- | :--- | :--- |
| **`api-worker`** | Cloudflare Worker (Hono) | [https://api-worker.justoneteeteam.workers.dev](https://api-worker.justoneteeteam.workers.dev) |
| **`web`** | Cloudflare Pages (Next.js) | [https://jot-layer-raid-web.pages.dev](https://jot-layer-raid-web.pages.dev) |
| **`DB`** | Cloudflare D1 (SQLite) | `d4e061cb-72cc-49f6-9562-092a3cd4a27b` (jotlayerraid-db) |
| **`FONTS_CACHE_KV`** | Workers KV Namespace | `f9d69ed778704bbea0b77e36ca454f8a` |
| **`BULK_QUEUE`** | Cloudflare Queue | `bulk-jersey-jobs` |
| **`BUCKET`** | Cloudflare R2 Bucket | `jot-layer-raid-bucket` |
| **`Telegram Bot`** | Alert Channel | Bot: `8882930959` / Channel ID: `-1003926357837` (JOT OMS Notification) |

---

## 🎯 Active Goals

1. **Monitor Worker Traffic**: Track API requests through the Cloudflare Worker console.
2. **Perform Load Testing**: Submit a bulk generation job of 100+ jerseys to verify the queue consumer throttling and D1 batch-transaction write speeds.
3. **Weekly Sync Checks**: Monitor the Monday Cron trigger (`0 0 * * 1`) to ensure active WooCommerce and ShopBase storefront orders sync cleanly into D1.
