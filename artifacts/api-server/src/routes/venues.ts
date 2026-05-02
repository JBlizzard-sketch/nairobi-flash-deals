import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  venuesTable,
  insertVenueSchema,
  venueNeighborhoodEnum,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const listQuerySchema = z.object({
  category: z.enum(["restaurant", "spa", "bar", "fitness", "experience"]).optional(),
  neighborhood: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

router.get("/venues", async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const conditions = [eq(venuesTable.status, "approved")];
  if (query.category) {
    conditions.push(eq(venuesTable.category, query.category));
  }
  if (query.neighborhood) {
    conditions.push(eq(venuesTable.neighborhood, query.neighborhood as typeof venueNeighborhoodEnum.enumValues[number]));
  }

  const [data, [{ count }]] = await Promise.all([
    db
      .select()
      .from(venuesTable)
      .where(and(...conditions))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ count: sql<number>`count(*)` }).from(venuesTable).where(and(...conditions)),
  ]);

  res.json({ data, pagination: { total: Number(count), limit: query.limit, offset: query.offset } });
});

router.post("/venues", async (req, res) => {
  const body = insertVenueSchema.parse(req.body);
  const [venue] = await db.insert(venuesTable).values(body).returning();
  res.status(201).json(venue);
});

router.get("/venues/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [venue] = await db.select().from(venuesTable).where(eq(venuesTable.id, id));
  if (!venue) {
    res.status(404).json({ message: "Venue not found" });
    return;
  }
  res.json(venue);
});

router.patch("/venues/:id", async (req, res) => {
  const id = Number(req.params.id);
  const updateSchema = insertVenueSchema.partial();
  const body = updateSchema.parse(req.body);
  const [venue] = await db
    .update(venuesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(venuesTable.id, id))
    .returning();
  if (!venue) {
    res.status(404).json({ message: "Venue not found" });
    return;
  }
  res.json(venue);
});

router.post("/venues/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const [venue] = await db
    .update(venuesTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(venuesTable.id, id))
    .returning();
  if (!venue) {
    res.status(404).json({ message: "Venue not found" });
    return;
  }
  res.json(venue);
});

router.get("/venues/:id/analytics", async (req, res) => {
  const id = Number(req.params.id);
  const [venue] = await db.select().from(venuesTable).where(eq(venuesTable.id, id));
  if (!venue) {
    res.status(404).json({ message: "Venue not found" });
    return;
  }
  res.json({
    venueId: id,
    totalDeals: 0,
    totalBookings: Number(venue.totalBookings),
    fillRate: Number(venue.fillRate ?? 0),
    averageRating: Number(venue.averageRating ?? 0),
    totalRevenue: 0,
    recentDeals: [],
  });
});

export default router;
