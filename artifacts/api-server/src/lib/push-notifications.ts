/**
 * Notification fan-out service.
 * When a deal goes live, finds all eligible users and sends push notifications.
 *
 * Eligibility criteria:
 *   1. User has a pushToken
 *   2. Venue category is in user's subscriptionCategories
 *   3. User has location set AND is within radiusKm of the venue
 *      OR user has no location (opt-in to all)
 */

import { db } from "@workspace/db";
import { usersTable, notificationLogTable } from "@workspace/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { distanceKm } from "./geo";
import { sendPushNotification } from "./fcm";
import { logger } from "./logger";

export interface DealNotificationPayload {
  dealId: number;
  venueId: number;
  venueName: string;
  venueCategory: string;
  venueLat: number | null;
  venueLng: number | null;
  dealTitle: string;
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  slotsAvailable: number;
  endsAt: Date;
  radiusKm?: number;
}

export interface FanOutResult {
  eligible: number;
  sent: number;
  failed: number;
  simulated: number;
}

function formatPrice(n: number): string {
  return `KES ${Math.round(n).toLocaleString()}`;
}

function formatTimeLeft(endsAt: Date): string {
  const mins = Math.round((endsAt.getTime() - Date.now()) / 60_000);
  if (mins <= 60) return `${mins} min left`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m left`;
}

export async function fanOutDealNotification(
  payload: DealNotificationPayload
): Promise<FanOutResult> {
  const radiusKm = payload.radiusKm ?? 12; // 12km default covers greater Nairobi

  // Fetch all active users with a push token
  const candidates = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.isActive, true),
        isNotNull(usersTable.pushToken),
        // Filter by category preference via array contains
        sql`${usersTable.subscriptionCategories} @> ARRAY[${payload.venueCategory}]::text[]`
      )
    );

  logger.info(
    { dealId: payload.dealId, candidates: candidates.length },
    "Push fan-out: candidate users fetched"
  );

  const result: FanOutResult = { eligible: 0, sent: 0, failed: 0, simulated: 0 };

  const notificationRows: (typeof notificationLogTable.$inferInsert)[] = [];

  const title = `⚡ ${payload.discountPercent}% off at ${payload.venueName}`;
  const body =
    `${payload.dealTitle} — ${formatPrice(payload.dealPrice)} ` +
    `(was ${formatPrice(payload.originalPrice)}) · ` +
    `${payload.slotsAvailable} slots · ${formatTimeLeft(payload.endsAt)}`;

  for (const user of candidates) {
    // Geo filter: if user has coords AND venue has coords, check distance
    if (
      payload.venueLat !== null &&
      payload.venueLng !== null &&
      user.latitude &&
      user.longitude
    ) {
      const km = distanceKm(
        parseFloat(user.latitude),
        parseFloat(user.longitude),
        payload.venueLat,
        payload.venueLng
      );
      if (km > radiusKm) continue; // Too far
    }

    result.eligible++;
    const userLat = user.latitude ? parseFloat(user.latitude) : null;
    const userLng = user.longitude ? parseFloat(user.longitude) : null;
    const distKm =
      payload.venueLat && payload.venueLng && userLat && userLng
        ? String(
            distanceKm(userLat, userLng, payload.venueLat, payload.venueLng).toFixed(2)
          )
        : null;

    const fcmResult = await sendPushNotification({
      token: user.pushToken!,
      title,
      body,
      data: {
        dealId: String(payload.dealId),
        venueId: String(payload.venueId),
        screen: "DealDetail",
      },
    });

    notificationRows.push({
      userId: user.id,
      dealId: payload.dealId,
      channel: "push",
      status: fcmResult.error ? "failed" : fcmResult.simulated ? "simulated" : "sent",
      title,
      body,
      fcmMessageId: fcmResult.messageId,
      errorMessage: fcmResult.error,
      distanceKm: distKm,
    });

    if (fcmResult.error) result.failed++;
    else if (fcmResult.simulated) result.simulated++;
    else result.sent++;
  }

  // Bulk insert notification log
  if (notificationRows.length > 0) {
    await db.insert(notificationLogTable).values(notificationRows);
  }

  // Update notificationsSent counter on the deal
  if (notificationRows.length > 0) {
    await db
      .update(
        (await import("@workspace/db/schema")).dealsTable
      )
      .set({
        notificationsSent: sql`notifications_sent + ${notificationRows.length}`,
        updatedAt: new Date(),
      })
      .where(
        eq(
          (await import("@workspace/db/schema")).dealsTable.id,
          payload.dealId
        )
      );
  }

  logger.info(
    { dealId: payload.dealId, ...result },
    "Push fan-out complete"
  );

  return result;
}
