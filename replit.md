# Workspace — Nairobi Flash Deals

## Project

Premium same-day flash deal platform for upscale Nairobi restaurants, spas, and wellness venues.
Venues post deals to fill dead hours (2–5 pm weekdays, etc.) and customers book in under 60 seconds.

**GitHub**: https://github.com/JBlizzard-sketch/nairobi-flash-deals

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `node scripts/src/gh-push.mjs` — push current state to GitHub

## GitHub Sync

Push to GitHub anytime: `node scripts/src/gh-push.mjs "your commit message"`
Auto-push script: `scripts/github-push.sh`

## Database Schema (lib/db/src/schema/)

- `users.ts` — customers and venue managers (loyalty tiers, subscription prefs, geo)
- `venues.ts` — curated venues with approval workflow, commission rate, analytics fields
- `deals.ts` — flash deals with lifecycle state machine + standing deal support
- `bookings.ts` — reservations with Mpesa payment tracking and confirmation codes
- `ratings.ts` — post-visit ratings tied to bookings, auto-updates venue averages

## API Routes (artifacts/api-server/src/routes/)

- `health.ts` — GET /api/healthz
- `auth.ts` — register / login (OTP) / verify / me / logout (JWT HS256, 7-day)
- `venues.ts` — CRUD + approval + analytics
- `deals.ts` — CRUD + publish/cancel + trending feed
- `bookings.ts` — create (with slot reservation) + cancel + check-in
- `ratings.ts` — submit + list by venue

## Auth Architecture

- Phone-first (E.164: +254XXXXXXXXX), email optional
- OTP: 6-digit, 5 min TTL, max 3 attempts, stored in `otp_codes` table
- JWT: HS256 signed with `SESSION_SECRET`, 7-day expiry
- Dev mode: OTP returned in API response for easy testing
- SMS delivery wired in Phase 10 (AfricasTalking/Twilio)
- Middleware: `requireAuth` (strict) + `optionalAuth` (flexible)

## Roadmap

| Phase | Description | Status |
|---|---|---|
| 1 | Monorepo scaffold, API server, health check | ✅ Done |
| 2 | Database schema (venues, deals, users, bookings, ratings) | ✅ Done |
| 3 | OpenAPI contract + Zod schemas + codegen | ✅ Done |
| 4 | Venue management CRUD + admin approval | ✅ Done |
| 5 | Flash deal lifecycle state machine | ✅ Done |
| 6 | Booking flow with slot reservation | ✅ Done |
| 7 | Customer auth + session management | ✅ Done |
| 8 | Mpesa Daraja payment integration | ⏳ Next |
| 9 | WhatsApp Business bot (deal posting) | ⏳ Planned |
| 10 | Push notification service (geo-aware) | ⏳ Planned |
| 11 | Next.js frontend — customer app | ⏳ Planned |
| 12 | Venue dashboard + analytics UI | ⏳ Planned |
| 13 | Standing deals (auto-activate) | ⏳ Planned |
| 14 | Trending feed algorithms | ⏳ Planned |
| 15 | Post-visit ratings UI | ⏳ Planned |
| 16 | Loyalty tiers for repeat customers | ⏳ Planned |
| 17 | Concierge / corporate booking | ⏳ Planned |
| 18 | White-label for hotel chains | ⏳ Planned |
| 19 | WhatsApp NLP deal parser | ⏳ Planned |
| 20 | Production hardening + launch | ⏳ Planned |

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
