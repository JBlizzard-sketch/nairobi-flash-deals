import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, otpTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import { randomInt } from "crypto";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const isDev = process.env["NODE_ENV"] !== "production";

const phoneSchema = z
  .string()
  .regex(/^\+254[0-9]{9}$/, "Phone must be in E.164 format: +254XXXXXXXXX");

function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

router.post("/auth/register", async (req, res) => {
  const bodySchema = z.object({
    phone: phoneSchema,
    name: z.string().min(2).max(100),
    email: z.string().email().optional(),
  });
  const body = bodySchema.parse(req.body);

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phone, body.phone));

  if (existing) {
    res.status(409).json({ message: "Phone number already registered. Use /auth/login instead." });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({ phone: body.phone, name: body.name, email: body.email ?? null })
    .returning();

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.insert(otpTable).values({
    phone: body.phone,
    code,
    userId: user.id,
    expiresAt,
  });

  const response: Record<string, unknown> = {
    message: "OTP sent to your phone number",
    phone: body.phone,
  };

  if (isDev) response["otp"] = code;

  res.status(201).json(response);
});

router.post("/auth/login", async (req, res) => {
  const bodySchema = z.object({ phone: phoneSchema });
  const body = bodySchema.parse(req.body);

  const [user] = await db
    .select({ id: usersTable.id, phone: usersTable.phone, role: usersTable.role, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.phone, body.phone));

  if (!user) {
    res.status(404).json({ message: "Phone number not registered. Please register first." });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ message: "Account is suspended." });
    return;
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.insert(otpTable).values({
    phone: body.phone,
    code,
    userId: user.id,
    expiresAt,
  });

  const response: Record<string, unknown> = {
    message: "OTP sent to your phone number",
    phone: body.phone,
  };

  if (isDev) response["otp"] = code;

  res.json(response);
});

router.post("/auth/verify", async (req, res) => {
  const bodySchema = z.object({
    phone: phoneSchema,
    otp: z.string().length(6),
  });
  const body = bodySchema.parse(req.body);
  const now = new Date();

  const [otpRecord] = await db
    .select()
    .from(otpTable)
    .where(
      and(
        eq(otpTable.phone, body.phone),
        eq(otpTable.verified, false),
        gt(otpTable.expiresAt, now),
      ),
    )
    .orderBy(otpTable.createdAt)
    .limit(1);

  if (!otpRecord) {
    res.status(400).json({ message: "OTP not found or expired. Request a new one." });
    return;
  }

  if (otpRecord.attempts >= 3) {
    res.status(429).json({ message: "Too many incorrect attempts. Request a new OTP." });
    return;
  }

  if (otpRecord.code !== body.otp) {
    await db
      .update(otpTable)
      .set({ attempts: otpRecord.attempts + 1 })
      .where(eq(otpTable.id, otpRecord.id));
    res.status(400).json({ message: "Incorrect OTP.", attemptsRemaining: 3 - otpRecord.attempts - 1 });
    return;
  }

  await db.update(otpTable).set({ verified: true }).where(eq(otpTable.id, otpRecord.id));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, otpRecord.userId!));

  const token = await signToken({ userId: user.id, phone: user.phone, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      loyaltyTier: user.loyaltyTier,
      loyaltyPoints: user.loyaltyPoints,
      createdAt: user.createdAt,
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.auth!.userId));

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    phone: user.phone,
    name: user.name,
    email: user.email,
    role: user.role,
    loyaltyTier: user.loyaltyTier,
    loyaltyPoints: user.loyaltyPoints,
    subscriptionCategories: user.subscriptionCategories,
    neighborhoodPref: user.neighborhoodPref,
    latitude: user.latitude,
    longitude: user.longitude,
    pushToken: user.pushToken,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

router.patch("/auth/me", requireAuth, async (req, res) => {
  const updateSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    subscriptionCategories: z.array(z.string()).optional(),
    neighborhoodPref: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    pushToken: z.string().optional(),
  });
  const body = updateSchema.parse(req.body);

  const [user] = await db
    .update(usersTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(usersTable.id, req.auth!.userId))
    .returning();

  res.json(user);
});

router.post("/auth/logout", requireAuth, (_req, res) => {
  res.json({ message: "Logged out successfully" });
});

export default router;
