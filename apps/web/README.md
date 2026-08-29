# JOTLayerRaid Web App (Next.js 16 Edge on Cloudflare Pages)

Frontend dashboard and interactive canvas editor for JOTLayerRaid, deployed to **Cloudflare Pages** with Edge Runtime.

## Getting Started

Run the development server:

```bash
pnpm dev
# or only web
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Build & Cloudflare Pages Deployment

```bash
# Production Next.js build
pnpm --filter web build

# Build for Cloudflare Pages (Edge output)
pnpm --filter web run pages:build

# Deploy directly via Wrangler
pnpm --filter web exec wrangler pages deploy .vercel/output/static --project-name=jot-layer-raid-web
```

## Edge Runtime Requirement

All dynamic page routes (e.g., `(editor)/mockups/[id]/edit/page.tsx`, `(dashboard)/pinterest/niches/[id]/page.tsx`) must declare:

```typescript
export const runtime = "edge";
```

