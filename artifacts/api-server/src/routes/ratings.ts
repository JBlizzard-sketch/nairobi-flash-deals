import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ratingsTable, venuesTable, bookingsTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

export function getTierForPoints(points: number): "bronze" | "silver" | "gold" | "platinum" {
  if (points >= 2000) return "platinum";
  if (points >= 1000) return "gold";
  if (points >= 500) return "silver";
  return "bronze";
}

export async function awardLoyaltyPoints(userId: number, points: number): Promise<void> {
  const [updated] = await db
    .update(usersTable)
    .set({ loyaltyPoints: sql`${usersTable.loyaltyPoints} + ${points}`, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning({ loyaltyPoints: usersTable.loyaltyPoints });

  if (updated) {
    const newTier = getTierForPoints(updated.loyaltyPoints);
    await db
      .update(usersTable)
      .set({ loyaltyTier: newTier })
      .where(eq(usersTable.id, userId));
  }
}

router.post("/ratings", requireAuth, async (req, res) => {
  const createSchema = z.object({
    bookingId: z.number(),
    score: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  });
  const body = createSchema.parse(req.body);
  const userId = req.auth!.userId;

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, body.bookingId));

  if (!booking) {
    res.status(404).json({ message: "Booking not found" });
    return;
  }
  if (booking.userId !== userId) {
    res.status(403).json({ message: "This booking does not belong to you" });
    return;
  }
  if (!["checked_in", "completed", "confirmed"].includes(booking.status)) {
    res.status(409).json({ message: "You can only rate after visiting the venue" });
    return;
  }

  let rating;
  try {
    [rating] = await db
      .insert(ratingsTable)
      .values({
        bookingId: body.bookingId,
        userId,
        venueId: booking.venueId,
        dealId: booking.dealId,
        score: body.score,
        comment: body.comment ?? null,
      })
      .returning();
  } catch {
    res.status(409).json({ message: "You have already rated this booking" });
    return;
  }

  await db
    .update(venuesTable)
    .set({
      totalRatings: sql`${venuesTable.totalRatings} + 1`,
      averageRating: sql`ROUND((COALESCE(${venuesTable.averageRating}, 0) * ${venuesTable.totalRatings} + ${body.score}) / (${venuesTable.totalRatings} + 1), 2)`,
      updatedAt: new Date(),
    })
    .where(eq(venuesTable.id, booking.venueId));

  await awardLoyaltyPoints(userId, 50);

  res.status(201).json({ ...rating, pointsAwarded: 50 });
});

router.get("/ratings/booking/:bookingId", requireAuth, async (req, res) => {
  const bookingId = Number(req.params.bookingId);
  const [rating] = await db
    .select()
    .from(ratingsTable)
    .where(eq(ratingsTable.bookingId, bookingId))
    .limit(1);

  if (!rating) {
    res.status(404).json({ message: "No rating for this booking" });
    return;
  }
  res.json(rating);
});

router.get("/ratings/deal/:dealId", async (req, res) => {
  const dealId = Number(req.params.dealId);
  const limit = Number(req.query["limit"] ?? 10);

  const [data, [{ count }]] = await Promise.all([
    db
      .select()
      .from(ratingsTable)
      .where(eq(ratingsTable.dealId, dealId))
      .orderBy(sql`${ratingsTable.createdAt} DESC`)
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ratingsTable)
      .where(eq(ratingsTable.dealId, dealId)),
  ]);

  res.json({ data, pagination: { total: Number(count), limit, offset: 0 } });
});

router.get("/ratings/venue/:venueId", async (req, res) => {
  const venueId = Number(req.params.venueId);
  const limit = Number(req.query["limit"] ?? 20);

  const [data, [{ count }]] = await Promise.all([
    db
      .select()
      .from(ratingsTable)
      .where(eq(ratingsTable.venueId, venueId))
      .orderBy(sql`${ratingsTable.createdAt} DESC`)
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ratingsTable)
      .where(eq(ratingsTable.venueId, venueId)),
  ]);

  res.json({ data, pagination: { total: Number(count), limit, offset: 0 } });
});

router.patch("/ratings/:id/respond", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const bodySchema = z.object({ response: z.string().min(1).max(500) });
  const body = bodySchema.parse(req.body);

  const [rating] = await db
    .update(ratingsTable)
    .set({ response: body.response, respondedAt: new Date() })
    .where(eq(ratingsTable.id, id))
    .returning();

  if (!rating) {
    res.status(404).json({ message: "Rating not found" });
    return;
  }
  res.json(rating);
});

export default router;
