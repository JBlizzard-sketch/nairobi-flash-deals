import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { dealsTable, venuesTable, insertDealSchema } from "@workspace/db/schema";
import { eq, and, sql, desc, gt, ilike, or, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { fanOutDealNotification } from "../lib/push-notifications";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const listQuerySchema = z.object({
  search: z.string().optional(),
  category: z
    .enum(["lunch", "dinner", "brunch", "treatment", "class", "experience", "drinks", "tasting"])
    .optional(),
  neighborhood: z.string().optional(),
  venueId: z.coerce.number().optional(),
  status: z
    .enum(["draft", "live", "filling_fast", "sold_out", "expired", "cancelled"])
    .optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

router.get("/deals", async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const conditions = [];

  if (query.search) {
    conditions.push(
      or(
        ilike(dealsTable.title, `%${query.search}%`),
        ilike(venuesTable.name, `%${query.search}%`),
      )!,
    );
  }
  if (query.category) conditions.push(eq(dealsTable.category, query.category));
  if (query.venueId) conditions.push(eq(dealsTable.venueId, query.venueId));
  if (query.neighborhood)
    conditions.push(
      eq(venuesTable.neighborhood, query.neighborhood as typeof venuesTable.neighborhood._.data),
    );
  if (query.minPrice)
    conditions.push(gte(sql`${dealsTable.dealPrice}::numeric`, query.minPrice));
  if (query.maxPrice)
    conditions.push(lte(sql`${dealsTable.dealPrice}::numeric`, query.maxPrice));
  if (query.status) conditions.push(eq(dealsTable.status, query.status));
  else conditions.push(eq(dealsTable.status, "live"));

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ deal: dealsTable, venue: venuesTable })
      .from(dealsTable)
      .leftJoin(venuesTable, eq(dealsTable.venueId, venuesTable.id))
      .where(where)
      .orderBy(desc(dealsTable.publishedAt))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(dealsTable)
      .leftJoin(venuesTable, eq(dealsTable.venueId, venuesTable.id))
      .where(where),
  ]);

  res.json({
    data: rows.map((r) => ({
      ...r.deal,
      availableSlots: r.deal.totalSlots - r.deal.bookedSlots,
      venue: r.venue,
    })),
    pagination: { total: Number(count), limit: query.limit, offset: query.offset },
  });
});

router.get("/deals/trending", async (_req, res) => {
  const now = new Date();
  const rows = await db
    .select({ deal: dealsTable, venue: venuesTable })
    .from(dealsTable)
    .leftJoin(venuesTable, eq(dealsTable.venueId, venuesTable.id))
    .where(and(inArray(dealsTable.status, ["live", "filling_fast"]), gt(dealsTable.endsAt, now)))
    .orderBy(desc(dealsTable.hotScore))
    .limit(10);

  res.json({
    data: rows.map((r) => ({ ...r.deal, availableSlots: r.deal.totalSlots - r.deal.bookedSlots, venue: r.venue })),
    pagination: { total: rows.length, limit: 10, offset: 0 },
  });
});

router.get("/deals/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [deal] = await db
    .select({
      deal: dealsTable,
      venue: venuesTable,
    })
    .from(dealsTable)
    .leftJoin(venuesTable, eq(dealsTable.venueId, venuesTable.id))
    .where(eq(dealsTable.id, id));

  if (!deal) {
    res.status(404).json({ message: "Deal not found" });
    return;
  }

  await db
    .update(dealsTable)
    .set({ viewCount: sql`${dealsTable.viewCount} + 1` })
    .where(eq(dealsTable.id, id));

  res.json({
    ...deal.deal,
    availableSlots: deal.deal.totalSlots - deal.deal.bookedSlots,
    venue: deal.venue,
  });
});

function coerceDates<T extends object>(raw: T): T {
  const result = { ...raw } as Record<string, unknown>;
  for (const key of ["startsAt", "endsAt", "publishedAt", "expiresAt"]) {
    if (typeof result[key] === "string") result[key] = new Date(result[key] as string);
  }
  return result as T;
}

router.post("/deals", async (req, res) => {
  const body = insertDealSchema.parse(coerceDates(req.body));
  const [deal] = await db.insert(dealsTable).values(body).returning();
  res.status(201).json({ ...deal, availableSlots: deal.totalSlots - deal.bookedSlots, venue: null });
});

router.patch("/deals/:id", async (req, res) => {
  const id = Number(req.params.id);
  const updateSchema = insertDealSchema.partial();
  const body = updateSchema.parse(coerceDates(req.body));
  const [deal] = await db
    .update(dealsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(dealsTable.id, id))
    .returning();
  if (!deal) {
    res.status(404).json({ message: "Deal not found" });
    return;
  }
  res.json({ ...deal, availableSlots: deal.totalSlots - deal.bookedSlots, venue: null });
});

router.post("/deals/:id/publish", async (req, res) => {
  const id = Number(req.params.id);

  const [row] = await db
    .select({ deal: dealsTable, venue: venuesTable })
    .from(dealsTable)
    .innerJoin(venuesTable, eq(dealsTable.venueId, venuesTable.id))
    .where(eq(dealsTable.id, id));

  if (!row) {
    res.status(404).json({ message: "Deal not found" });
    return;
  }

  const [deal] = await db
    .update(dealsTable)
    .set({ status: "live", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(dealsTable.id, id))
    .returning();

  res.json({ ...deal, availableSlots: deal.totalSlots - deal.bookedSlots, venue: null });

  setImmediate(async () => {
    try {
      const fanOut = await fanOutDealNotification({
        dealId: deal.id,
        venueId: row.venue.id,
        venueName: row.venue.name,
        venueCategory: row.venue.category,
        venueLat: row.venue.latitude ? parseFloat(row.venue.latitude) : null,
        venueLng: row.venue.longitude ? parseFloat(row.venue.longitude) : null,
        dealTitle: deal.title,
        dealPrice: Number(deal.dealPrice),
        originalPrice: Number(deal.originalPrice),
        discountPercent: deal.discountPercent,
        slotsAvailable: deal.totalSlots - deal.bookedSlots,
        endsAt: deal.endsAt,
      });
      logger.info({ dealId: deal.id, fanOut }, "Notification fan-out result");
    } catch (err) {
      logger.error({ err, dealId: deal.id }, "Notification fan-out failed");
    }
  });
});

router.post("/deals/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  const [deal] = await db
    .update(dealsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(dealsTable.id, id))
    .returning();
  if (!deal) {
    res.status(404).json({ message: "Deal not found" });
    return;
  }
  res.json({ ...deal, availableSlots: deal.totalSlots - deal.bookedSlots, venue: null });
});

export default router;
