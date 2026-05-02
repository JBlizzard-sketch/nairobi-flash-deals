import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { waitlistTable, dealsTable, venuesTable, usersTable } from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// ── Join waitlist ─────────────────────────────────────────────────────────────
router.post("/waitlist/:dealId", requireAuth, async (req, res) => {
  const dealId = Number(req.params.dealId);
  const userId = req.auth!.userId;

  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, dealId));
  if (!deal) {
    res.status(404).json({ message: "Deal not found" });
    return;
  }
  if (deal.status === "live" || deal.status === "filling_fast") {
    res.status(409).json({ message: "Deal has available slots — book directly instead." });
    return;
  }

  // Check if already on waitlist
  const [existing] = await db
    .select()
    .from(waitlistTable)
    .where(and(eq(waitlistTable.dealId, dealId), eq(waitlistTable.userId, userId)));

  if (existing && existing.status === "waiting") {
    res.status(409).json({ message: "Already on waitlist", entry: existing });
    return;
  }

  // Get next position
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(position), 0)` })
    .from(waitlistTable)
    .where(and(eq(waitlistTable.dealId, dealId), eq(waitlistTable.status, "waiting")));

  if (existing) {
    // Re-join after removing
    const [updated] = await db
      .update(waitlistTable)
      .set({ status: "waiting", position: Number(maxPos) + 1, updatedAt: new Date() })
      .where(eq(waitlistTable.id, existing.id))
      .returning();
    res.status(201).json(updated);
  } else {
    const [entry] = await db
      .insert(waitlistTable)
      .values({ dealId, userId, position: Number(maxPos) + 1 })
      .returning();
    res.status(201).json(entry);
  }
});

// ── Leave waitlist ────────────────────────────────────────────────────────────
router.delete("/waitlist/:dealId", requireAuth, async (req, res) => {
  const dealId = Number(req.params.dealId);
  const userId = req.auth!.userId;

  const [entry] = await db
    .update(waitlistTable)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(waitlistTable.dealId, dealId), eq(waitlistTable.userId, userId)))
    .returning();

  if (!entry) {
    res.status(404).json({ message: "Not on waitlist" });
    return;
  }
  res.json(entry);
});

// ── My waitlist entries ───────────────────────────────────────────────────────
router.get("/waitlist/my", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;

  const rows = await db
    .select({ entry: waitlistTable, deal: dealsTable, venue: venuesTable })
    .from(waitlistTable)
    .leftJoin(dealsTable, eq(waitlistTable.dealId, dealsTable.id))
    .leftJoin(venuesTable, eq(dealsTable.venueId, venuesTable.id))
    .where(and(eq(waitlistTable.userId, userId), eq(waitlistTable.status, "waiting")))
    .orderBy(desc(waitlistTable.createdAt));

  res.json({
    data: rows.map(({ entry, deal, venue }) => ({ ...entry, deal, venue })),
    count: rows.length,
  });
});

// ── Waitlist count for a deal (public) ───────────────────────────────────────
router.get("/waitlist/deal/:dealId/count", async (req, res) => {
  const dealId = Number(req.params.dealId);
  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(waitlistTable)
    .where(and(eq(waitlistTable.dealId, dealId), eq(waitlistTable.status, "waiting")));
  res.json({ dealId, count: Number(cnt) });
});

// ── Check if current user is on waitlist for a deal ──────────────────────────
router.get("/waitlist/deal/:dealId/me", requireAuth, async (req, res) => {
  const dealId = Number(req.params.dealId);
  const userId = req.auth!.userId;

  const [entry] = await db
    .select()
    .from(waitlistTable)
    .where(and(eq(waitlistTable.dealId, dealId), eq(waitlistTable.userId, userId)));

  res.json({
    onWaitlist: entry?.status === "waiting",
    entry: entry ?? null,
  });
});

export default router;
