# STATE.md — JOTLayerRaid

> **Current Phase**: Local Setup & Railway Integration
> **Milestone**: v1.0 — Production Jersey Mockup Workspace
> **Last Updated**: 2026-05-29

---

## 🚀 Module Status Tracker

| Feature / Module | Status | Notes |
| :--- | :--- | :--- |
| **Monorepo Structure** | ✅ Operational | Turborepo workspace with `apps/web`, `apps/api`, and shared configurations. |
| **Interactive Canvas Editor**| ✅ Feature-Rich | Fabric.js editor in `apps/web` with custom block font loaders, alignment tools, layer ordering, and patch image overlay. |
| **AI Layer separation** | ✅ Operational | Integrated with DashScope API supporting Qwen-Image-Layered to separate mockup layers. |
| **Pillow Composite Engine** | ✅ Ready | Custom backend image overlay service to stitch text and patches onto transparent background templates. |
| **Database & Cache** | ✅ Configured | Linked to local PostgreSQL / Docker Compose and production PostgreSQL on Railway. |
| **Cloud Store Uploads** | ✅ Implemented | Supported WooCommerce REST API and ShopBase store managers for automated bulk uploading. |
| **Background Processing** | 🟡 Testing | Celery + Redis configured in backend; local queue workers and Celery Beat scheduler set up. |
| **Railway Cloud Hosting** | ✅ Connected | Linked to project `inspiring-endurance` (Project ID: `a4f5dd05-f7a2-426d-a2e2-29cf27830749`). |

---

## ⚡ Active Configurations & Secrets Needed

Ensure the following environments are configured in your local `.env` and Railway Service Variables:

### 1. Backend (`apps/api/.env`)
* `DATABASE_URL` — PostgreSQL connection string.
* `REDIS_URL` — Redis host/port string.
* `QWEN_API_KEY` — Alibaba Cloud/DashScope API key for layer separation.
* `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — Cloudflare R2 credentials for mockup storage.

### 2. Frontend (`apps/web/.env.local`)
* `NEXT_PUBLIC_API_URL` — Point to backend (e.g. `http://localhost:8000` or `https://jot-layer-raid-production.up.railway.app`).

---

## 🎯 Active Goals

1. **Verify Local Stack**: Spin up PostgreSQL + Redis locally using Docker, install all node modules via `pnpm install`, and launch the unified development server via `pnpm dev`.
2. **Synchronize Schema**: Validate that Postgres tables are seeded with the default 32 NFL teams and the initial admin login (`admin`/`admin123`).
3. **Run Production Builds**: Validate that Next.js client builds successfully using Turborepo before triggering continuous deployments on Railway.
