import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, bookingsTable } from "@workspace/db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// ── My referral stats ─────────────────────────────────────────────────────────
router.get("/referrals/my", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;

  const [user] = await db
    .select({ referralCode: usersTable.referralCode })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  // All users referred by me
  const referredUsers = await db
    .select({ id: usersTable.id, name: usersTable.name, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.referredByUserId, userId));

  const referredUserIds = referredUsers.map((u) => u.id);

  // Bonuses paid (bookings where referralBonusPaid=true for my referred users)
  let bonusesPaid = 0;
  if (referredUserIds.length > 0) {
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.referralBonusPaid, true),
          inArray(bookingsTable.userId, referredUserIds)
        )
      );
    bonusesPaid = Number(cnt);
  }

  // Pending bonuses = referred users who haven't made their first confirmed booking yet
  let pendingCount = 0;
  if (referredUserIds.length > 0) {
    const bookingMade = await db
      .select({ userId: bookingsTable.userId })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.referralBonusPaid, true),
          inArray(bookingsTable.userId, referredUserIds)
        )
      );
    const bookingMadeIds = new Set(bookingMade.map((b) => b.userId));
    pendingCount = referredUserIds.filter((id) => !bookingMadeIds.has(id)).length;
  }

  res.json({
    referralCode: user.referralCode,
    referredCount: referredUsers.length,
    bonusesPaid,
    pendingCount,
    pointsEarned: bonusesPaid * 500,
    referredUsers: referredUsers.map((u) => ({
      name: u.name,
      joinedAt: u.createdAt,
    })),
  });
});

export default router;
