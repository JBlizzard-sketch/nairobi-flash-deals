/**
 * Trending score cron — runs every 5 minutes.
 * hotScore = booking_velocity + fill_urgency + engagement + recency_bonus
 */
import { db } from "@workspace/db";
import { dealsTable, bookingsTable } from "@workspace/db/schema";
import { eq, and, gte, sql, inArray } from "drizzle-orm";
import { logger } from "./logger";

export function startTrendingCron(): void {
  updateHotScores().catch((e) => logger.error({ e }, "trending: initial run failed"));
  setInterval(() => {
    updateHotScores().catch((e) => logger.error({ e }, "trending: update failed"));
  }, 5 * 60 * 1000);
}

async function updateHotScores(): Promise<void> {
  const now = new Date();
  const since6h = new Date(now.getTime() - 6 * 3_600_000);

  // Fetch live/filling_fast deals
  const liveDeals = await db
    .select({
      id: dealsTable.id,
      totalSlots: dealsTable.totalSlots,
      bookedSlots: dealsTable.bookedSlots,
      viewCount: dealsTable.viewCount,
      notificationsSent: dealsTable.notificationsSent,
      publishedAt: dealsTable.publishedAt,
      endsAt: dealsTable.endsAt,
    })
    .from(dealsTable)
    .where(
      and(
        inArray(dealsTable.status, ["live", "filling_fast"]),
        gte(dealsTable.endsAt, now),
      ),
    );

  if (liveDeals.length === 0) return;

  // Count recent bookings per deal
  const recentBookings = await db
    .select({
      dealId: bookingsTable.dealId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(bookingsTable)
    .where(gte(bookingsTable.createdAt, since6h))
    .groupBy(bookingsTable.dealId);

  const bookingMap = new Map(recentBookings.map((b) => [b.dealId, b.count]));

  // Update each deal's hotScore
  for (const deal of liveDeals) {
    const recentBookingCount = bookingMap.get(deal.id) ?? 0;
    const fillRate = deal.totalSlots > 0 ? deal.bookedSlots / deal.totalSlots : 0;
    const minsLeft = (deal.endsAt.getTime() - now.getTime()) / 60_000;
    const urgencyBonus = minsLeft <= 60 ? 20 : minsLeft <= 120 ? 10 : 0;
    const ageHours = deal.publishedAt
      ? (now.getTime() - deal.publishedAt.getTime()) / 3_600_000
      : 999;
    const recencyBonus = ageHours <= 2 ? 15 : ageHours <= 6 ? 7 : 0;

    const hotScore =
      recentBookingCount * 12 +
      fillRate * 40 +
      (deal.viewCount ?? 0) * 0.05 +
      (deal.notificationsSent ?? 0) * 0.02 +
      urgencyBonus +
      recencyBonus;

    await db
      .update(dealsTable)
      .set({ hotScore: Math.round(hotScore * 100) / 100 })
      .where(eq(dealsTable.id, deal.id));
  }

  logger.info({ count: liveDeals.length }, "trending: hot scores updated");
}
