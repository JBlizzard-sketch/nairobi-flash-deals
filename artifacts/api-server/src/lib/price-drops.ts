/**
 * Dynamic last-minute pricing cron — runs every 5 minutes.
 * As a deal approaches its end time, its price progressively drops:
 *   60–120 min left → 5% extra off
 *   30–60 min left  → 10% extra off
 *   <30 min left    → 15% extra off
 */
import { db } from "@workspace/db";
import { dealsTable } from "@workspace/db/schema";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import { logger } from "./logger";

export function startPriceDropCron(): void {
  applyPriceDrops().catch((e) => logger.error({ e }, "price-drops: initial run failed"));
  setInterval(() => {
    applyPriceDrops().catch((e) => logger.error({ e }, "price-drops: tick failed"));
  }, 5 * 60 * 1000);
}

async function applyPriceDrops(): Promise<void> {
  const now = new Date();

  const liveDeals = await db
    .select({
      id: dealsTable.id,
      dealPrice: dealsTable.dealPrice,
      originalPrice: dealsTable.originalPrice,
      baseDealPrice: dealsTable.baseDealPrice,
      endsAt: dealsTable.endsAt,
    })
    .from(dealsTable)
    .where(
      and(
        inArray(dealsTable.status, ["live", "filling_fast"]),
        gte(dealsTable.endsAt, now),
      ),
    );

  let updated = 0;

  for (const deal of liveDeals) {
    const base = parseFloat(String(deal.baseDealPrice ?? deal.dealPrice));
    const original = parseFloat(String(deal.originalPrice));
    const minsLeft = (deal.endsAt.getTime() - now.getTime()) / 60_000;

    let multiplier = 1.0;
    if (minsLeft <= 30) multiplier = 0.85;
    else if (minsLeft <= 60) multiplier = 0.90;
    else if (minsLeft <= 120) multiplier = 0.95;
    else continue; // no drop needed

    const newPrice = Math.round(base * multiplier);
    const newDiscount = Math.round((1 - newPrice / original) * 100);

    await db
      .update(dealsTable)
      .set({
        baseDealPrice: deal.baseDealPrice ?? deal.dealPrice,
        dealPrice: String(newPrice),
        discountPercent: newDiscount,
        updatedAt: now,
      })
      .where(eq(dealsTable.id, deal.id));
    updated++;
  }

  if (updated > 0) {
    logger.info({ updated }, "price-drops: prices updated");
  }
}
