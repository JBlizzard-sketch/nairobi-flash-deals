import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bookingsTable, dealsTable, venuesTable, insertBookingSchema } from "@workspace/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { isDarajaConfigured, initiateSTKPush } from "../lib/daraja";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const listQuerySchema = z.object({
  status: z
    .enum(["pending_payment", "confirmed", "checked_in", "completed", "cancelled", "refunded"])
    .optional(),
  venueId: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

function generateConfirmationCode(): string {
  return `NFD-${randomBytes(3).toString("hex").toUpperCase()}`;
}

router.get("/bookings", async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const conditions = [];
  if (query.status) conditions.push(eq(bookingsTable.status, query.status));
  if (query.venueId) conditions.push(eq(bookingsTable.venueId, query.venueId));

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({ booking: bookingsTable, deal: dealsTable, venue: venuesTable })
      .from(bookingsTable)
      .leftJoin(dealsTable, eq(bookingsTable.dealId, dealsTable.id))
      .leftJoin(venuesTable, eq(bookingsTable.venueId, venuesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${bookingsTable.createdAt} DESC`)
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  res.json({
    data: rows.map(({ booking, deal, venue }) => ({ ...booking, deal, venue })),
    pagination: { total: Number(count), limit: query.limit, offset: query.offset },
  });
});

router.post("/bookings", async (req, res) => {
  const createSchema = z.object({
    dealId: z.number(),
    slots: z.number().min(1).max(20),
    specialRequests: z.string().optional(),
    isCorporate: z.boolean().optional().default(false),
    corporateName: z.string().optional(),
    phoneNumber: z.string(),
    userId: z.number().optional(),
  });
  const body = createSchema.parse(req.body);

  const [deal] = await db
    .select({ deal: dealsTable, venue: venuesTable })
    .from(dealsTable)
    .leftJoin(venuesTable, eq(dealsTable.venueId, venuesTable.id))
    .where(eq(dealsTable.id, body.dealId));

  if (!deal) {
    res.status(404).json({ message: "Deal not found" });
    return;
  }
  if (deal.deal.status !== "live") {
    res.status(409).json({ message: "Deal is not available" });
    return;
  }
  const available = deal.deal.totalSlots - deal.deal.bookedSlots;
  if (available < body.slots) {
    res.status(409).json({ message: `Only ${available} slot(s) remaining` });
    return;
  }

  const dealPrice = Number(deal.deal.dealPrice);
  const totalAmount = (dealPrice * body.slots).toFixed(2);
  const commissionRate = Number(deal.venue?.commissionRate ?? 15) / 100;
  const commissionAmount = (Number(totalAmount) * commissionRate).toFixed(2);
  const venueAmount = (Number(totalAmount) - Number(commissionAmount)).toFixed(2);

  const [booking] = await db.transaction(async (tx) => {
    const booked = await tx
      .update(dealsTable)
      .set({
        bookedSlots: sql`${dealsTable.bookedSlots} + ${body.slots}`,
        status: sql`CASE WHEN ${dealsTable.bookedSlots} + ${body.slots} >= ${dealsTable.totalSlots} THEN 'sold_out'::deal_status WHEN (${dealsTable.bookedSlots} + ${body.slots})::float / ${dealsTable.totalSlots} >= 0.7 THEN 'filling_fast'::deal_status ELSE ${dealsTable.status} END`,
        updatedAt: new Date(),
      })
      .where(eq(dealsTable.id, body.dealId))
      .returning();

    return tx
      .insert(bookingsTable)
      .values({
        dealId: body.dealId,
        userId: body.userId ?? null,
        venueId: deal.deal.venueId,
        slots: body.slots,
        totalAmount,
        commissionAmount,
        venueAmount,
        confirmationCode: generateConfirmationCode(),
        specialRequests: body.specialRequests,
        isCorporate: body.isCorporate ?? false,
        corporateName: body.corporateName,
        status: "pending_payment",
      })
      .returning();
  });

  // Auto-trigger STK push if Daraja is configured and phone is provided
  let paymentInfo: Record<string, unknown> = { paymentStatus: "pending_payment" };

  if (isDarajaConfigured()) {
    try {
      const stkResult = await initiateSTKPush({
        phone: body.phoneNumber,
        amountKes: Math.ceil(Number(totalAmount)),
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
      });
      await db
        .update(bookingsTable)
        .set({ mpesaCheckoutRequestId: stkResult.checkoutRequestId, updatedAt: new Date() })
        .where(eq(bookingsTable.id, booking.id));
      paymentInfo = {
        paymentStatus: "stk_sent",
        message: stkResult.customerMessage,
        checkoutRequestId: stkResult.checkoutRequestId,
      };
    } catch (err) {
      logger.error({ err, bookingId: booking.id }, "STK Push failed — booking left pending");
      paymentInfo = { paymentStatus: "stk_failed", message: "Payment prompt could not be sent. Use /api/payments/initiate to retry." };
    }
  } else {
    // Simulated mode: auto-confirm without real payment
    await db
      .update(bookingsTable)
      .set({ status: "confirmed", mpesaRef: `SIM-${Date.now()}`, updatedAt: new Date() })
      .where(eq(bookingsTable.id, booking.id));
    paymentInfo = { paymentStatus: "simulated", message: "Mpesa not configured — booking auto-confirmed." };
    booking.status = "confirmed";
  }

  res.status(201).json({ ...booking, deal: null, venue: null, ...paymentInfo });
});

router.get("/bookings/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [result] = await db
    .select({ booking: bookingsTable, deal: dealsTable, venue: venuesTable })
    .from(bookingsTable)
    .leftJoin(dealsTable, eq(bookingsTable.dealId, dealsTable.id))
    .leftJoin(venuesTable, eq(bookingsTable.venueId, venuesTable.id))
    .where(eq(bookingsTable.id, id));

  if (!result) {
    res.status(404).json({ message: "Booking not found" });
    return;
  }
  res.json({ ...result.booking, deal: result.deal, venue: result.venue });
});

router.post("/bookings/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  const [booking] = await db
    .update(bookingsTable)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(bookingsTable.id, id))
    .returning();
  if (!booking) {
    res.status(404).json({ message: "Booking not found" });
    return;
  }
  res.json({ ...booking, deal: null, venue: null });
});

router.post("/bookings/:id/checkin", async (req, res) => {
  const id = Number(req.params.id);
  const [booking] = await db
    .update(bookingsTable)
    .set({ status: "checked_in", checkedInAt: new Date(), updatedAt: new Date() })
    .where(eq(bookingsTable.id, id))
    .returning();
  if (!booking) {
    res.status(404).json({ message: "Booking not found" });
    return;
  }
  res.json({ ...booking, deal: null, venue: null });
});

export default router;
