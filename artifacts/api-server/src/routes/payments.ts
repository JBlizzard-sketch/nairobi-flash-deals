import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bookingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import {
  isDarajaConfigured,
  initiateSTKPush,
  queryStkStatus,
  parseCallback,
  type DarajaCallback,
} from "../lib/daraja";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// POST /api/payments/initiate
// Initiate Mpesa STK Push for an existing booking
router.post("/payments/initiate", requireAuth, async (req, res) => {
  const bodySchema = z.object({
    bookingId: z.number(),
    phone: z.string().regex(/^\+254[0-9]{9}$/, "Phone must be +254XXXXXXXXX"),
  });

  const body = bodySchema.parse(req.body);

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, body.bookingId));

  if (!booking) {
    res.status(404).json({ message: "Booking not found" });
    return;
  }
  if (booking.status !== "pending_payment") {
    res.status(409).json({ message: `Booking is already ${booking.status}` });
    return;
  }

  if (!isDarajaConfigured()) {
    // Dev/staging mode: simulate payment success
    const [updated] = await db
      .update(bookingsTable)
      .set({
        status: "confirmed",
        mpesaRef: `SIM-${Date.now()}`,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, body.bookingId))
      .returning();

    res.json({
      mode: "simulated",
      message: "Payment simulated (Mpesa not configured). Booking confirmed.",
      booking: { ...updated, deal: null, venue: null },
    });
    return;
  }

  const result = await initiateSTKPush({
    phone: body.phone,
    amountKes: Math.ceil(Number(booking.totalAmount)),
    bookingId: booking.id,
    confirmationCode: booking.confirmationCode,
    description: `NFD: ${booking.slots} slot(s) – ${booking.confirmationCode}`,
  });

  // Store the checkout request ID for callback matching
  await db
    .update(bookingsTable)
    .set({
      mpesaCheckoutRequestId: result.checkoutRequestId,
      updatedAt: new Date(),
    })
    .where(eq(bookingsTable.id, body.bookingId));

  res.json({
    mode: "live",
    message: result.customerMessage,
    checkoutRequestId: result.checkoutRequestId,
  });
});

// POST /api/payments/callback
// Daraja sends payment result here (public endpoint, no auth)
router.post("/payments/callback", async (req, res) => {
  const raw = req.body as DarajaCallback;

  let parsed: ReturnType<typeof parseCallback>;
  try {
    parsed = parseCallback(raw);
  } catch (err) {
    logger.warn({ err }, "Malformed Daraja callback");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    return;
  }

  req.log.info(
    { checkoutRequestId: parsed.checkoutRequestId, success: parsed.success, resultCode: parsed.resultCode },
    "Daraja callback received",
  );

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.mpesaCheckoutRequestId, parsed.checkoutRequestId));

  if (!booking) {
    logger.warn({ checkoutRequestId: parsed.checkoutRequestId }, "Daraja callback: booking not found");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    return;
  }

  if (parsed.success) {
    await db
      .update(bookingsTable)
      .set({
        status: "confirmed",
        mpesaRef: parsed.mpesaRef,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, booking.id));

    req.log.info({ bookingId: booking.id, mpesaRef: parsed.mpesaRef }, "Booking confirmed via Mpesa");
  } else {
    await db
      .update(bookingsTable)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, booking.id));

    req.log.warn({ bookingId: booking.id, resultCode: parsed.resultCode, resultDesc: parsed.resultDesc }, "Mpesa payment failed — booking cancelled");
  }

  // Daraja expects this exact response to stop retrying
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// POST /api/payments/query
// Manually query payment status (for polling fallback)
router.post("/payments/query", requireAuth, async (req, res) => {
  const bodySchema = z.object({ bookingId: z.number() });
  const { bookingId } = bodySchema.parse(req.body);

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId));

  if (!booking) {
    res.status(404).json({ message: "Booking not found" });
    return;
  }

  if (!booking.mpesaCheckoutRequestId) {
    res.json({ status: booking.status, message: "No STK push initiated yet" });
    return;
  }

  if (!isDarajaConfigured()) {
    res.json({ status: booking.status, message: "Mpesa not configured" });
    return;
  }

  const result = await queryStkStatus(booking.mpesaCheckoutRequestId);

  res.json({
    status: booking.status,
    resultCode: result.resultCode,
    resultDesc: result.resultDesc,
  });
});

export default router;
