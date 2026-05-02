/**
 * Notification preference and push token management.
 *
 * PATCH /api/notifications/preferences  — update category subscriptions + radius
 * PUT   /api/notifications/location     — update user's lat/lng (for geo filter)
 * PUT   /api/notifications/push-token   — register/update FCM push token
 * GET   /api/notifications/log          — list recent notifications sent to the user
 * POST  /api/notifications/test         — dev: trigger a test push to yourself
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, notificationLogTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";
import { sendPushNotification } from "../lib/fcm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── PATCH /api/notifications/preferences ─────────────────────────────────
const prefsSchema = z.object({
  subscriptionCategories: z
    .array(
      z.enum([
        "restaurant", "spa", "bar", "fitness", "experience",
      ])
    )
    .min(1)
    .optional(),
  neighborhoodPref: z.string().optional(),
});

router.patch("/notifications/preferences", requireAuth, async (req, res) => {
  const body = prefsSchema.parse(req.body);
  const userId = req.auth!.userId;

  const [updated] = await db
    .update(usersTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning({
      id: usersTable.id,
      subscriptionCategories: usersTable.subscriptionCategories,
      neighborhoodPref: usersTable.neighborhoodPref,
    });

  res.json({ message: "Preferences updated", preferences: updated });
});

// ── PUT /api/notifications/location ──────────────────────────────────────
const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

router.put("/notifications/location", requireAuth, async (req, res) => {
  const { latitude, longitude } = locationSchema.parse(req.body);
  const userId = req.auth!.userId;

  await db
    .update(usersTable)
    .set({
      latitude: String(latitude),
      longitude: String(longitude),
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));

  res.json({ message: "Location updated", latitude, longitude });
});

// ── PUT /api/notifications/push-token ────────────────────────────────────
const tokenSchema = z.object({
  pushToken: z.string().min(10),
});

router.put("/notifications/push-token", requireAuth, async (req, res) => {
  const { pushToken } = tokenSchema.parse(req.body);
  const userId = req.auth!.userId;

  await db
    .update(usersTable)
    .set({ pushToken, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ message: "Push token registered" });
});

// ── GET /api/notifications/log ────────────────────────────────────────────
router.get("/notifications/log", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  const logs = await db
    .select()
    .from(notificationLogTable)
    .where(eq(notificationLogTable.userId, userId))
    .orderBy(desc(notificationLogTable.sentAt))
    .limit(limit);

  res.json({ data: logs, count: logs.length });
});

// ── POST /api/notifications/test ──────────────────────────────────────────
router.post("/notifications/test", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;
  const [user] = await db
    .select({ pushToken: usersTable.pushToken, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user?.pushToken) {
    res.status(400).json({
      message: "No push token registered. Call PUT /api/notifications/push-token first.",
    });
    return;
  }

  const result = await sendPushNotification({
    token: user.pushToken,
    title: "⚡ Test Notification — Nairobi Flash Deals",
    body: `Hey ${user.name}! Push notifications are working perfectly.`,
    data: { screen: "Home", test: "true" },
  });

  logger.info({ userId, result }, "Test push sent");

  res.json({
    message: result.simulated
      ? "Simulated (FCM not configured) — push logged"
      : "Push sent successfully",
    messageId: result.messageId,
    simulated: result.simulated,
    error: result.error,
  });
});

export default router;
