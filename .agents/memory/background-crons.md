---
name: Background crons pattern
description: How background jobs (crons) are wired into the api-server
---

Three background crons live in `artifacts/api-server/src/lib/`:
- `trending.ts` — recalculates hot_score every 5 min for live deals
- `standing-deals.ts` — auto-activates/expires standing deals every 1 min
- `price-drops.ts` — applies last-minute price drops every 5 min

Each exports a `startX()` function. All three are called in `app.ts` after the router is mounted.

**Why:** Keeps cron logic isolated and testable; app.ts is the single startup coordinator.

**How to apply:** Add new crons as `lib/<name>.ts` with a `startXCron()` export, import and call in app.ts.
