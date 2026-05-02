import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  venuesTable,
  insertVenueSchema,
  venueNeighborhoodEnum,
  bookingsTable,
  dealsTable,
  ratingsTable,
} from "@workspace/db/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";
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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const [
    dailyRows,
    monthKpis,
    deals,
    ratingRows,
    ratingDist,
  ] = await Promise.all([
    // Daily bookings for last 7 days
    db.execute(sql`
      SELECT
        DATE(created_at) AS day,
        COUNT(*)::int           AS bookings,
        COALESCE(SUM(slots), 0)::int AS slots,
        COALESCE(SUM(total_amount::numeric), 0) AS revenue
      FROM bookings
      WHERE venue_id = ${id}
        AND created_at >= ${sevenDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `),
    // Month KPIs
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total_bookings,
        COALESCE(SUM(total_amount::numeric), 0)   AS total_revenue,
        COALESCE(SUM(commission_amount::numeric), 0) AS commission
      FROM bookings
      WHERE venue_id = ${id}
        AND created_at >= ${thisMonthStart}
    `),
    // Deal performance
    db.execute(sql`
      SELECT
        d.id,
        d.title,
        d.category,
        d.booked_slots,
        d.total_slots,
        d.view_count,
        d.deal_price::numeric AS deal_price,
        CASE WHEN d.total_slots > 0
          THEN ROUND(d.booked_slots::numeric / d.total_slots * 100, 1)
          ELSE 0 END AS fill_rate,
        COALESCE(SUM(b.total_amount::numeric), 0) AS revenue,
        COUNT(b.id)::int AS booking_count
      FROM deals d
      LEFT JOIN bookings b ON b.deal_id = d.id
      WHERE d.venue_id = ${id}
      GROUP BY d.id
      ORDER BY revenue DESC
    `),
    // Overall rating stats
    db.execute(sql`
      SELECT
        COALESCE(AVG(r.score), 0) AS avg_rating,
        COUNT(r.id)::int          AS total_reviews
      FROM ratings r
      JOIN bookings b ON r.booking_id = b.id
      WHERE b.venue_id = ${id}
    `),
    // Rating distribution 1-5
    db.execute(sql`
      SELECT
        r.score,
        COUNT(*)::int AS count
      FROM ratings r
      JOIN bookings b ON r.booking_id = b.id
      WHERE b.venue_id = ${id}
      GROUP BY r.score
      ORDER BY r.score ASC
    `),
  ]);

  // Build 7-day calendar (fill missing days with zeros)
  const dailyMap = new Map<string, { bookings: number; slots: number; revenue: number }>();
  for (const row of dailyRows.rows) {
    const r = row as { day: string; bookings: number; slots: number; revenue: string };
    dailyMap.set(r.day.substring(0, 10), {
      bookings: r.bookings,
      slots: r.slots,
      revenue: Number(r.revenue),
    });
  }
  const dailyBookings = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().substring(0, 10);
    const label = d.toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" });
    const entry = dailyMap.get(key) ?? { bookings: 0, slots: 0, revenue: 0 };
    dailyBookings.push({ date: key, label, ...entry });
  }

  const kpi = monthKpis.rows[0] as { total_bookings: number; total_revenue: string; commission: string };
  const rStats = ratingRows.rows[0] as { avg_rating: string; total_reviews: number };

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of ratingDist.rows) {
    const r = row as { score: number; count: number };
    distribution[r.score] = r.count;
  }

  res.json({
    venueId: id,
    totalDeals: (deals.rows as unknown[]).length,
    totalBookings: kpi.total_bookings,
    fillRate: Number(venue.fillRate ?? 0),
    averageRating: Number(Number(rStats.avg_rating).toFixed(1)),
    totalRevenue: Number(kpi.total_revenue),
    commissionEarned: Number(kpi.commission),
    totalReviews: rStats.total_reviews,
    dailyBookings,
    ratingDistribution: distribution,
    dealPerformance: (deals.rows as Array<{
      id: number; title: string; category: string; booked_slots: number;
      total_slots: number; view_count: number; deal_price: string;
      fill_rate: string; revenue: string; booking_count: number;
    }>).map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      bookedSlots: d.booked_slots,
      totalSlots: d.total_slots,
      viewCount: d.view_count,
      dealPrice: Number(d.deal_price),
      fillRate: Number(d.fill_rate),
      revenue: Number(d.revenue),
      bookingCount: d.booking_count,
    })),
    recentDeals: [],
  });
});

export default router;
