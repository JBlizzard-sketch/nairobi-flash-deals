import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ratingsTable, venuesTable, insertRatingSchema } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

router.post("/ratings", async (req, res) => {
  const createSchema = z.object({
    bookingId: z.number(),
    score: z.number().min(1).max(5),
    comment: z.string().optional(),
    userId: z.number().optional(),
    venueId: z.number(),
    dealId: z.number(),
  });
  const body = createSchema.parse(req.body);
  const [rating] = await db.insert(ratingsTable).values({ ...body, userId: body.userId ?? null }).returning();

  await db
    .update(venuesTable)
    .set({
      totalRatings: sql`${venuesTable.totalRatings} + 1`,
      averageRating: sql`ROUND((${venuesTable.averageRating} * ${venuesTable.totalRatings} + ${body.score}) / (${venuesTable.totalRatings} + 1), 2)`,
      updatedAt: new Date(),
    })
    .where(eq(venuesTable.id, body.venueId));

  res.status(201).json(rating);
});

router.get("/ratings/venue/:venueId", async (req, res) => {
  const venueId = Number(req.params.venueId);
  const limit = Number(req.query.limit ?? 20);
  const data = await db
    .select()
    .from(ratingsTable)
    .where(eq(ratingsTable.venueId, venueId))
    .limit(limit);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ratingsTable)
    .where(eq(ratingsTable.venueId, venueId));
  res.json({ data, pagination: { total: Number(count), limit, offset: 0 } });
});

export default router;
