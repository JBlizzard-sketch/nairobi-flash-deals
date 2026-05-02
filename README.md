# Nairobi Flash Deals

> Premium same-day flash deal platform for Nairobi restaurants, spas, and wellness venues.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange.svg)](https://pnpm.io/)

---

## The Problem

Every upscale restaurant in Westlands and Kilimani sits empty between 2 pm and 5 pm on weekdays. Every spa has dead Tuesday morning slots. Every rooftop bar is a ghost town on Monday nights. These venues have already paid for staff, food prep, and overhead — every empty seat is pure loss.

Meanwhile, Nairobi's large population of remote workers, freelancers, NGO staff, and flexible-schedule professionals would love a great lunch or spa session at 3 pm on a Tuesday — if they knew about it and could book in seconds.

**Nairobi Flash Deals bridges that gap.**

---

## What We're Building

A platform where venues push a same-day or next-day flash deal — *"40% off lunch today 1–4 pm, 6 covers available"* — and subscribers get an instant notification and can book and pay immediately.

- No printed vouchers
- No Groupon-style race to the bottom
- Think **HotelsTonight energy** — premium feel, genuine scarcity, fast decision
- Venues pay **nothing upfront** — the platform takes a commission on completed bookings
- Customers subscribe free and get daily deal alerts by category (food, spa, fitness, experiences)

---

## Key Features

| Feature | Description |
|---|---|
| **Flash Deals** | Same-day or next-day limited slots with real scarcity |
| **Standing Deals** | Recurring off-peak deals that activate automatically below a booking threshold |
| **WhatsApp Bot** | Venue managers post deals by typing natural language into WhatsApp |
| **Mpesa Payments** | Native Kenyan mobile payment integration |
| **Sub-60s Booking** | Notification → confirmation in under 60 seconds |
| **Trending Feed** | Real-time "filling fast today" discovery feed |
| **Geo Push Notifications** | Location-aware alerts for deals nearby |
| **Venue Analytics** | Fill rate, deal performance, best-performing time slots |
| **Loyalty Status** | Repeat bookers earn tiered recognition |
| **Concierge Tier** | Corporate team lunch bookings at short notice |
| **White-Label** | Hotel chains manage their own restaurant dead hours |
| **Curated Venues** | All venues approved — premium brand protected |

---

## Tech Stack

### Monorepo

| Tool | Version |
|---|---|
| pnpm workspaces | 10.x |
| TypeScript | 5.9 |
| Node.js | 24 |

### Backend (API Server)

| Tool | Purpose |
|---|---|
| Express 5 | HTTP framework |
| PostgreSQL + Drizzle ORM | Database & migrations |
| Zod v4 | Input/output validation |
| Orval | OpenAPI → type-safe hooks codegen |
| Pino | Structured logging |
| esbuild | Production bundling |

### Frontend (Planned)

| Tool | Purpose |
|---|---|
| Next.js | Web application framework |
| Vercel Edge Functions | Real-time deal availability |
| React Query | Server-state management (generated hooks) |
| Tailwind CSS | Utility-first styling |

### Infrastructure (Planned)

| Tool | Purpose |
|---|---|
| Railway | Backend hosting |
| Vercel | Frontend hosting |
| WhatsApp Business API | Venue deal-posting bot |
| Mpesa Daraja API | Kenyan mobile payments |
| Docker | Container-ready deployment |

---

## Project Structure

```
nairobi-flash-deals/
├── artifacts/
│   ├── api-server/          # Express API backend
│   │   ├── src/
│   │   │   ├── app.ts       # Express app setup
│   │   │   ├── index.ts     # Server entrypoint
│   │   │   ├── lib/         # Shared utilities (logger, etc.)
│   │   │   ├── middlewares/  # Express middlewares
│   │   │   └── routes/      # Route handlers
│   │   └── package.json
│   └── mockup-sandbox/      # UI component preview server (Vite)
├── lib/                     # Shared TypeScript libraries
├── scripts/                 # Utility scripts
├── pnpm-workspace.yaml      # Workspace config + catalog pins
├── tsconfig.base.json       # Shared TS defaults
└── package.json             # Root dev tooling
```

---

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL (or a Railway database URL)

### Install

```bash
pnpm install
```

### Environment Variables

Copy the example file and fill in values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session signing |
| `GITHUB_TOKEN` | GitHub token (CI/deployment use only) |
| `MPESA_CONSUMER_KEY` | Daraja API consumer key |
| `MPESA_CONSUMER_SECRET` | Daraja API consumer secret |
| `WHATSAPP_TOKEN` | WhatsApp Business API token |

### Development

```bash
# Run API server
pnpm --filter @workspace/api-server run dev

# Type-check all packages
pnpm run typecheck

# Regenerate API hooks from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (dev only)
pnpm --filter @workspace/db run push
```

### Health Check

```bash
curl http://localhost:80/api/healthz
# {"status":"ok"}
```

---

## Development Roadmap

| Phase | Description | Status |
|---|---|---|
| 1 | Monorepo scaffold, API server, health check | ✅ Complete |
| 2 | Database schema — venues, deals, users, bookings | 🔄 In Progress |
| 3 | OpenAPI contract + Zod schemas for all entities | 🔄 In Progress |
| 4 | Venue management CRUD (admin approval workflow) | ⏳ Planned |
| 5 | Flash deal creation & lifecycle state machine | ⏳ Planned |
| 6 | Real-time availability (slots countdown) | ⏳ Planned |
| 7 | Customer auth + subscription preferences | ⏳ Planned |
| 8 | Booking flow (reserve → pay → confirm) | ⏳ Planned |
| 9 | Mpesa Daraja payment integration | ⏳ Planned |
| 10 | WhatsApp Business bot (deal posting by managers) | ⏳ Planned |
| 11 | Push notification service (geo-aware) | ⏳ Planned |
| 12 | Next.js frontend — customer-facing app | ⏳ Planned |
| 13 | Venue dashboard (analytics, deal management) | ⏳ Planned |
| 14 | Standing deals (auto-activate below threshold) | ⏳ Planned |
| 15 | Trending feed + discovery algorithms | ⏳ Planned |
| 16 | Post-visit ratings & review system | ⏳ Planned |
| 17 | Loyalty tiers for repeat customers | ⏳ Planned |
| 18 | Concierge / corporate booking tier | ⏳ Planned |
| 19 | White-label version for hotel chains | ⏳ Planned |
| 20 | Production hardening, load testing, launch | ⏳ Planned |

---

## API Reference

### Health

```
GET /api/healthz
→ 200 { "status": "ok" }
```

More endpoints will be documented here as they are built.

---

## Contributing

This is an active build. Contributions, ideas, and feedback are welcome.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a pull request

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Contact

Built by [JBlizzard-sketch](https://github.com/JBlizzard-sketch) · Nairobi, Kenya
