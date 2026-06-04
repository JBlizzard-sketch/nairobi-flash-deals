/**
 * Standing deals cron — runs every minute.
 * Auto-publishes standing deals when their weekly schedule matches the current time.
 * Auto-expires them when their time window closes.
 */
import { db } from "@workspace/db";
import { dealsTable } from "@workspace/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { logger } from "./logger";

export function startStandingDealsCron(): void {
  processStandingDeals().catch((e) => logger.error({ e }, "standing: initial run failed"));
  setInterval(() => {
    processStandingDeals().catch((e) => logger.error({ e }, "standing: tick failed"));
  }, 60 * 1000);
}

async function processStandingDeals(): Promise<void> {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun…6=Sat
  const currentHour = now.getHours();

  const standingDeals = await db
    .select()
    .from(dealsTable)
    .where(
      and(
        eq(dealsTable.isStanding, true),
        isNotNull(dealsTable.standingDaysOfWeek),
      ),
    );

  let activated = 0;
  let expired = 0;

  for (const deal of standingDeals) {
    const days = deal.standingDaysOfWeek ?? [];
    const startH = deal.standingStartHour ?? 14;
    const endH = deal.standingEndHour ?? 17;
    const inWindow = days.includes(currentDay) && currentHour >= startH && currentHour < endH;

    if (inWindow && (deal.status === "expired" || deal.status === "draft")) {
      // Compute today's window
      const startsAt = new Date(now);
      startsAt.setHours(startH, 0, 0, 0);
      const endsAt = new Date(now);
      endsAt.setHours(endH, 0, 0, 0);

      await db
        .update(dealsTable)
        .set({
          status: "live",
          bookedSlots: 0,
          startsAt,
          endsAt,
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(dealsTable.id, deal.id));
      activated++;
    } else if (!inWindow && (deal.status === "live" || deal.status === "filling_fast")) {
      // Outside window — expire it
      if (
        days.includes(currentDay) &&
        (currentHour >= endH || currentHour < startH) &&
        deal.standingEndHour !== undefined
      ) {
        await db
          .update(dealsTable)
          .set({ status: "expired", updatedAt: now })
          .where(eq(dealsTable.id, deal.id));
        expired++;
      }
    }
  }

  if (activated > 0 || expired > 0) {
    logger.info({ activated, expired }, "standing deals: processed");
  }
}
