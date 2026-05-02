import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  venuesTable,
  dealsTable,
  bookingsTable,
  usersTable,
  ratingsTable,
} from "@workspace/db/schema";
import { eq, and, sql, desc, gte, count } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";
import type { Request, Response, NextFunction } from "express";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (req.auth.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

// All admin routes require auth + admin role
router.use("/admin", requireAuth, requireAdmin);

// ── Platform stats ────────────────────────────────────────────────────────────
router.get("/admin/stats", async (_req, res) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const [venueCounts, dealCounts, bookingKpi, userCounts, dailyRows, topVenues] =
    await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int                                         AS total,
          COUNT(*) FILTER (WHERE status='pending')::int        AS pending,
          COUNT(*) FILTER (WHERE status='approved')::int       AS approved,
          COUNT(*) FILTER (WHERE status='suspended')::int      AS suspended
        FROM venues
      `),
      db.execute(sql`
        SELECT
          COUNT(*)::int                                     AS total,
          COUNT(*) FILTER (WHERE status='live')::int        AS live,
          COUNT(*) FILTER (WHERE status='filling_fast')::int AS filling_fast,
          COUNT(*) FILTER (WHERE status='sold_out')::int    AS sold_out
        FROM deals
      `),
      db.execute(sql`
        SELECT
          COUNT(*)::int                                                  AS total_bookings,
          COALESCE(SUM(total_amount::numeric), 0)                        AS total_revenue,
          COALESCE(SUM(commission_amount::numeric), 0)                   AS total_commission,
          COUNT(*) FILTER (WHERE created_at >= ${thisMonthStart})::int   AS month_bookings,
          COALESCE(SUM(total_amount::numeric) FILTER (WHERE created_at >= ${thisMonthStart}), 0) AS month_revenue,
          COALESCE(SUM(commission_amount::numeric) FILTER (WHERE created_at >= ${thisMonthStart}), 0) AS month_commission
        FROM bookings
      `),
      db.execute(sql`
        SELECT
          COUNT(*)::int                                               AS total,
          COUNT(*) FILTER (WHERE role='customer')::int               AS customers,
          COUNT(*) FILTER (WHERE role='venue_manager')::int          AS managers,
          COUNT(*) FILTER (WHERE role='admin')::int                  AS admins
        FROM users
      `),
      db.execute(sql`
        SELECT
          DATE(created_at) AS day,
          COUNT(*)::int           AS bookings,
          COALESCE(SUM(total_amount::numeric), 0) AS revenue,
          COALESCE(SUM(commission_amount::numeric), 0) AS commission
        FROM bookings
        WHERE created_at >= ${sevenDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `),
      db.execute(sql`
        SELECT v.id, v.name, v.category, v.neighborhood,
          COUNT(b.id)::int AS bookings,
          COALESCE(SUM(b.total_amount::numeric), 0) AS revenue
        FROM venues v
        LEFT JOIN bookings b ON b.venue_id = v.id
        GROUP BY v.id
        ORDER BY revenue DESC
        LIMIT 5
      `),
    ]);

  // Build 7-day calendar
  type DailyRow = { day: string; bookings: number; revenue: string; commission: string };
  const dailyMap = new Map<string, DailyRow>();
  for (const row of dailyRows.rows as DailyRow[]) {
    dailyMap.set(row.day.substring(0, 10), row);
  }
  const dailyRevenue = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().substring(0, 10);
    const label = d.toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" });
    const entry = dailyMap.get(key);
    dailyRevenue.push({
      date: key,
      label,
      bookings: entry?.bookings ?? 0,
      revenue: Number(entry?.revenue ?? 0),
      commission: Number(entry?.commission ?? 0),
    });
  }

  const v = venueCounts.rows[0] as { total: number; pending: number; approved: number; suspended: number };
  const d = dealCounts.rows[0] as { total: number; live: number; filling_fast: number; sold_out: number };
  const b = bookingKpi.rows[0] as {
    total_bookings: number; total_revenue: string; total_commission: string;
    month_bookings: number; month_revenue: string; month_commission: string;
  };
  const u = userCounts.rows[0] as { total: number; customers: number; managers: number; admins: number };

  res.json({
    venues: { total: v.total, pending: v.pending, approved: v.approved, suspended: v.suspended },
    deals: { total: d.total, live: d.live, fillingFast: d.filling_fast, soldOut: d.sold_out },
    bookings: {
      total: b.total_bookings,
      totalRevenue: Number(b.total_revenue),
      totalCommission: Number(b.total_commission),
      monthBookings: b.month_bookings,
      monthRevenue: Number(b.month_revenue),
      monthCommission: Number(b.month_commission),
    },
    users: { total: u.total, customers: u.customers, managers: u.managers, admins: u.admins },
    dailyRevenue,
    topVenues: (topVenues.rows as Array<{ id: number; name: string; category: string; neighborhood: string; bookings: number; revenue: string }>).map(r => ({
      id: r.id, name: r.name, category: r.category, neighborhood: r.neighborhood,
      bookings: r.bookings, revenue: Number(r.revenue),
    })),
  });
});

// ── Venues management ─────────────────────────────────────────────────────────
router.get("/admin/venues", async (req, res) => {
  const schema = z.object({
    status: z.enum(["pending", "approved", "suspended"]).optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  });
  const query = schema.parse(req.query);
  const conditions = query.status ? [eq(venuesTable.status, query.status as typeof venuesTable.status._.data)] : [];
  const where = conditions.length ? and(...conditions) : undefined;

  const [data, [{ cnt }]] = await Promise.all([
    db.select().from(venuesTable).where(where).orderBy(desc(venuesTable.createdAt)).limit(query.limit).offset(query.offset),
    db.select({ cnt: sql<number>`count(*)` }).from(venuesTable).where(where),
  ]);

  // Attach booking/deal counts per venue
  const venueIds = data.map((v) => v.id);
  let bookingCounts: Map<number, number> = new Map();
  let dealCounts2: Map<number, number> = new Map();
  if (venueIds.length > 0) {
    const bRows = await db.execute(sql`
      SELECT venue_id, COUNT(*)::int AS cnt FROM bookings WHERE venue_id = ANY(${venueIds}) GROUP BY venue_id
    `);
    for (const r of bRows.rows as { venue_id: number; cnt: number }[]) {
      bookingCounts.set(r.venue_id, r.cnt);
    }
    const dRows = await db.execute(sql`
      SELECT venue_id, COUNT(*)::int AS cnt FROM deals WHERE venue_id = ANY(${venueIds}) GROUP BY venue_id
    `);
    for (const r of dRows.rows as { venue_id: number; cnt: number }[]) {
      dealCounts2.set(r.venue_id, r.cnt);
    }
  }

  res.json({
    data: data.map((v) => ({
      ...v,
      bookingCount: bookingCounts.get(v.id) ?? 0,
      dealCount: dealCounts2.get(v.id) ?? 0,
    })),
    pagination: { total: Number(cnt), limit: query.limit, offset: query.offset },
  });
});

router.patch("/admin/venues/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = z.object({
    status: z.enum(["pending", "approved", "suspended"]),
  }).parse(req.body);

  const [venue] = await db
    .update(venuesTable)
    .set({ status: status as typeof venuesTable.status._.data, updatedAt: new Date() })
    .where(eq(venuesTable.id, id))
    .returning();
  if (!venue) {
    res.status(404).json({ message: "Venue not found" });
    return;
  }
  res.json(venue);
});

// ── Recent bookings ───────────────────────────────────────────────────────────
router.get("/admin/bookings", async (req, res) => {
  const schema = z.object({
    status: z.enum(["pending_payment", "confirmed", "checked_in", "completed", "cancelled", "refunded"]).optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  });
  const query = schema.parse(req.query);

  const conditions = query.status ? [eq(bookingsTable.status, query.status)] : [];
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ cnt }]] = await Promise.all([
    db.execute(sql`
      SELECT b.*, 
        d.title AS deal_title, d.category AS deal_category,
        v.name AS venue_name, v.neighborhood,
        u.name AS user_name, u.phone AS user_phone
      FROM bookings b
      LEFT JOIN deals d ON b.deal_id = d.id
      LEFT JOIN venues v ON b.venue_id = v.id
      LEFT JOIN users u ON b.user_id = u.id
      ${where ? sql`WHERE b.status = ${query.status}` : sql``}
      ORDER BY b.created_at DESC
      LIMIT ${query.limit} OFFSET ${query.offset}
    `),
    db.select({ cnt: sql<number>`count(*)` }).from(bookingsTable).where(where),
  ]);

  res.json({
    data: rows.rows,
    pagination: { total: Number(cnt), limit: query.limit, offset: query.offset },
  });
});

// ── Users list ────────────────────────────────────────────────────────────────
router.get("/admin/users", async (req, res) => {
  const schema = z.object({
    role: z.enum(["customer", "venue_manager", "admin"]).optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  });
  const query = schema.parse(req.query);
  const conditions = query.role ? [eq(usersTable.role, query.role)] : [];
  const where = conditions.length ? and(...conditions) : undefined;

  const [data, [{ cnt }]] = await Promise.all([
    db.select().from(usersTable).where(where).orderBy(desc(usersTable.createdAt)).limit(query.limit).offset(query.offset),
    db.select({ cnt: sql<number>`count(*)` }).from(usersTable).where(where),
  ]);

  res.json({
    data,
    pagination: { total: Number(cnt), limit: query.limit, offset: query.offset },
  });
});

export default router;
