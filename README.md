# JOTLayerRaid

> AI-powered jersey mockup generator & multi-store product publisher.

Upload a jersey image → AI separates name & number layers → bulk-generate thousands of player variants → push to WooCommerce & Shopbase stores automatically.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | **Next.js 15** (App Router) | Dashboard, wizards, real-time job tracking |
| UI Library | **Shadcn UI** + **Radix Primitives** | Light-theme minimal components |
| Styling | **Vanilla CSS** (CSS Modules) | Clean, maintainable, no utility bloat |
| Backend | **FastAPI** (Python 3.12) | REST API, WebSocket, file handling |
| AI Engine | **Qwen API** (Qwen-Image-Layered) | Jersey image layer separation |
| Image Processing | **Pillow** | Flat text overlay for name/number compositing |
| Database | **PostgreSQL** via **Supabase** | Teams, players, templates, jobs |
| File Storage | **Cloudflare R2** | Images, fonts — organized per team |
| Job Queue | **Celery** + **Redis** | Background bulk generation & store uploads |
| Scheduler | **Celery Beat** | Weekly Yahoo roster scraping |
| Auth | **NextAuth.js** | Simple credential-based login |
| Store APIs | **WooCommerce REST v3** / **Shopbase Admin** | Product creation with images & SEO |
| Monorepo | **Turborepo** + **pnpm** | Unified builds, shared configs |
| Deployment | **Vercel** (web) + **Railway** (api) | CI/CD, auto-scaling |

---

## UX Workflow

### First-Time Setup

```
Login
  │
  ├─→ 1. AI Mockup Creator
  │     Upload raw jersey PNG
  │     Select prompt: "Separate Layers" or "Fix Text Artifacts"
  │     → Qwen AI returns: blank jersey + name layer + number layer
  │     → Download individual PNGs or ZIP
  │     → Save as mockup template
  │
  ├─→ 2. Mockup Library
  │     Browse saved templates by team
  │     Click-to-place name/number positions on the jersey
  │     Select font, size, color, outline
  │     Live preview with sample text
  │
  ├─→ 3. Font Library
  │     Upload .ttf / .otf files
  │     Preview with sample text
  │     Tag by league (NFL, MLB, NCAA, NHL)
  │
  ├─→ 4. Player Database
  │     Import via CSV upload (with duplicate detection)
  │     Or sync from Yahoo Sports roster
  │     All changes go through Approval queue
  │
  └─→ 5. Store Settings
        Add WooCommerce / Shopbase stores
        Enter API credentials
        Test connection
```

### Daily Operations

```
Bulk Job Wizard
  │
  Step 1 → Select mockup template(s)
  Step 2 → Select players (filter by team / league)
  Step 3 → Choose variants: Men ✅  Women ✅  Youth ✅
  Step 4 → Configure SEO: title template, description, internal links. Add the product category with the fix parameter: domain-player-name-team-number-jersey.
  Step 5 → Select target stores
  Step 6 → Review summary → Click RUN
  Step 7 → Add into Google Sheets with product name, url
  │
  └─→ Background Engine
        Generates all images (Pillow flat text overlay)
        Uploads to R2 (team-specific folders)
        Creates separate products on each selected store
        Real-time progress via WebSocket
```

### Weekly Auto-Sync

```
Every Monday (Celery Beat)
  │
  └─→ Yahoo Roster Scraper
        Fetches roster pages for all NFL teams
        Detects new / changed / removed players
        Creates pending ROSTER_CHANGE records
        │
        └─→ Admin reviews in Approval UI
              Approve → player added to database
              Reject → logged and skipped
              Option: auto-trigger bulk job for approved players
```

---

## UI Design System — Light Theme Minimal

### Design Principles

| Principle | Rule |
|-----------|------|
| **Theme** | Light-only, clean white backgrounds |
| **Typography** | Google Fonts — **Inter** (body), **Space Grotesk** (headings) |
| **Color Palette** | Neutral grays + one accent color per context |
| **Spacing** | 8px grid system (4, 8, 12, 16, 24, 32, 48) |
| **Borders** | 1px solid `#E5E7EB`, border-radius: 8px |
| **Shadows** | Subtle only — `0 1px 3px rgba(0,0,0,0.08)` |
| **Icons** | Lucide icons (consistent with Shadcn) |
| **Density** | Comfortable — generous padding, no cramming |
| **Animations** | Minimal — 150ms ease transitions on hover/focus only |

### Color Tokens

```css
:root {
  /* Backgrounds */
  --bg-primary:    #FFFFFF;
  --bg-secondary:  #F9FAFB;
  --bg-tertiary:   #F3F4F6;

  /* Text */
  --text-primary:   #111827;
  --text-secondary: #6B7280;
  --text-muted:     #9CA3AF;

  /* Borders */
  --border-default: #E5E7EB;
  --border-hover:   #D1D5DB;

  /* Accent — Teal (primary actions) */
  --accent:         #0D9488;
  --accent-hover:   #0F766E;
  --accent-light:   #CCFBF1;

  /* Status */
  --success:  #16A34A;
  --warning:  #EAB308;
  --error:    #DC2626;
  --info:     #2563EB;

  /* Shadows */
  --shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md:  0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-lg:  0 4px 12px rgba(0, 0, 0, 0.1);
}
```

### Layout Structure

```
┌──────────────────────────────────────────────────┐
│  Logo    JOTLayerRaid              [User] [Logout]│  ← Top bar (56px, white, border-bottom)
├────────┬─────────────────────────────────────────┤
│        │                                         │
│  🤖   │   Page Content Area                     │
│  📁   │                                         │
│  🔤   │   Cards with subtle shadows             │
│  🏈   │   Tables with striped rows              │
│  ⚙️   │   Forms with labeled inputs             │
│  🔧   │                                         │
│        │                                         │
│ Sidebar│                                         │  ← Sidebar (240px, #F9FAFB)
│ (icons │                                         │
│ +label)│                                         │
├────────┴─────────────────────────────────────────┤
│  © 2026 JOTLayerRaid                             │  ← Footer (optional, 40px)
└──────────────────────────────────────────────────┘
```

### Component Styles

**Buttons**
- Primary: `bg: var(--accent)`, white text, 8px radius, 150ms hover darken
- Secondary: `bg: white`, gray border, dark text
- Ghost: no background, text only, underline on hover

**Cards**
- White background, 1px border `var(--border-default)`, 8px radius, `var(--shadow-sm)`
- 24px padding inside

**Tables**
- Header: `bg: var(--bg-secondary)`, bold text, uppercase 11px tracking
- Rows: alternate `white` / `var(--bg-secondary)`
- Hover: `var(--bg-tertiary)`

**Form Inputs**
- 40px height, 8px radius, 1px border
- Focus: 2px ring `var(--accent)` with 0.15 opacity

**Status Badges**
- Pill shape (999px radius), 10px 12px padding
- Colors map to status tokens (success/warning/error/info)

**Sidebar Navigation**
- Active item: `bg: var(--accent-light)`, `color: var(--accent)`, left 3px border accent
- Inactive: `color: var(--text-secondary)`, hover `var(--bg-tertiary)`

---

## Development Setup

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Python** ≥ 3.12
- **Docker Desktop** (for PostgreSQL + Redis locally)

### Quick Start

```bash
# 1. Clone
git clone https://github.com/your-org/JOTLayerRaid.git
cd JOTLayerRaid

# 2. Install frontend dependencies
pnpm install

# 3. Start PostgreSQL + Redis
docker compose up -d

# 4. Setup Python backend
cd apps/api
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt

# 5. Run database migrations
alembic upgrade head

# 6. Seed NFL teams
python -m seeds.seed_db

# 7. Start everything (from project root)
cd ../..
pnpm dev
```

This runs:
- **Next.js** on `http://localhost:3000`
- **FastAPI** on `http://localhost:8000`
- **Swagger docs** at `http://localhost:8000/docs`

### Environment Variables

Create `.env` files in both apps:

**`apps/web/.env.local`**
```env
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**`apps/api/.env`**
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jotlayerraid

# Redis
REDIS_URL=redis://localhost:6379/0

# AI
QWEN_API_KEY=your-qwen-api-key

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=jersey-mockups

# Auth
JWT_SECRET=your-jwt-secret
```

### Docker Compose (Local Dev)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: jotlayerraid
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

### Project Commands

```bash
# Run everything in dev mode
pnpm dev

# Run only frontend
pnpm --filter web dev

# Run only backend
cd apps/api && uvicorn main:app --reload

# Run Celery worker (for bulk jobs)
cd apps/api && celery -A workers worker --loglevel=info

# Run Celery Beat (for weekly roster scraper)
cd apps/api && celery -A workers beat --loglevel=info

# Run database migrations
cd apps/api && alembic upgrade head

# Create new migration
cd apps/api && alembic revision --autogenerate -m "description"

# Run backend tests
cd apps/api && pytest tests/ -v

# Build frontend for production
pnpm --filter web build

# Type check
pnpm --filter web tsc --noEmit
```

### Folder Structure

```
JOTLayerRaid/
├── apps/
│   ├── web/                          # Next.js 15
│   │   ├── app/
│   │   │   ├── layout.tsx            # Sidebar + top bar + auth guard
│   │   │   ├── login/page.tsx        # Login page
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── mockups/
│   │   │   │   ├── page.tsx          # Mockup library grid
│   │   │   │   ├── create/page.tsx   # AI Mockup Creator
│   │   │   │   └── [id]/page.tsx     # Template editor
│   │   │   ├── fonts/page.tsx        # Font library
│   │   │   ├── patches/page.tsx      # Patch library
│   │   │   ├── database/
│   │   │   │   ├── page.tsx          # Team/Player browser
│   │   │   │   └── import/page.tsx   # CSV import wizard
│   │   │   ├── roster/
│   │   │   │   └── approval/page.tsx # Unified approval UI
│   │   │   ├── bulk/
│   │   │   │   ├── page.tsx          # Bulk job wizard
│   │   │   │   └── [jobId]/page.tsx  # Live job progress
│   │   │   └── settings/page.tsx     # Store settings
│   │   ├── components/               # Shared UI components
│   │   ├── lib/                      # API client, auth helpers
│   │   ├── styles/                   # Global CSS + design tokens
│   │   └── public/
│   │
│   └── api/                          # FastAPI
│       ├── main.py                   # App entry + middleware
│       ├── config.py                 # Env config loader
│       ├── models/                   # SQLAlchemy ORM
│       ├── routers/                  # API endpoints
│       │   ├── auth.py
│       │   ├── mockups.py
│       │   ├── mockups_separation.py
│       │   ├── database.py
│       │   ├── bulk.py
│       │   └── settings.py
│       ├── workers/                  # Celery tasks
│       │   ├── image_generator.py
│       │   └── store_uploader.py
│       ├── services/                 # Business logic
│       │   ├── layer_separation.py
│       │   ├── roster_scraper.py
│       │   ├── image_engine.py
│       │   ├── woocommerce.py
│       │   ├── shopbase.py
│       │   ├── r2_storage.py
│       │   └── seo_generator.py
│       ├── tasks/
│       │   └── weekly_roster_job.py
│       ├── seeds/
│       │   ├── nfl_teams.json
│       │   └── seed_db.py
│       └── tests/
│
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md                         # ← You are here
```

---

## Deployment

### Frontend → Vercel

```bash
# Connect GitHub repo to Vercel
# Set root directory: apps/web
# Set env vars in Vercel dashboard
```

### Backend → Railway

```bash
# Connect GitHub repo to Railway
# Add services: FastAPI, PostgreSQL, Redis
# Set env vars in Railway dashboard
# Celery worker runs as a separate Railway service
```

### R2 Bucket Structure

```
jot-layer-raid-bucket/jersey-mockups/                    # Single R2 bucket
├── eagles/                        # Per-team prefix
│   ├── templates/
│   │   ├── home-green-blank.png
│   │   ├── home-green-name.png
│   │   └── home-green-number.png
│   └── generated/
│       ├── hurts-1-men-green.png
│       └── hurts-1-women-green.png
├── cowboys/
│   ├── templates/
│   └── generated/
├── seahawks/
│   ├── templates/
│   └── generated/
└── fonts/
    ├── nfl-block-bold.ttf
    └── mlb-script.otf
```

---

## License

Private — All rights reserved.
