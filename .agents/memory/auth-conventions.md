---
name: Auth conventions
description: How auth middleware works in api-server routes
---

- Auth middleware attaches to `req.auth`, NOT `req.user`
- JWT payload shape: `{ userId: number, phone: string, role: string }`
- `requireAuth` — strict, returns 401 if no valid JWT
- `optionalAuth` — flexible, sets req.auth if JWT present, otherwise undefined

**Why:** Drilled into routes during Phases 7-20; any new route handler must use req.auth.userId etc.

**How to apply:** In route handlers: `const userId = req.auth?.userId`. Never `req.user`.
