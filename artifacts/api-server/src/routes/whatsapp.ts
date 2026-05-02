/**
 * WhatsApp Business Bot — Phase 9
 *
 * GET  /api/whatsapp/webhook   — Meta webhook verification challenge
 * POST /api/whatsapp/webhook   — Incoming messages from venues
 * POST /api/whatsapp/test      — Local dev: submit a deal message without WhatsApp
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { venuesTable, dealsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { parseDealMessage, type ParsedDeal } from "../lib/deal-parser";
import { sendTextMessage, extractInboundMessage, type WAWebhookPayload } from "../lib/whatsapp";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── In-memory conversation state ─────────────────────────────────────────────
// Keyed by venue WhatsApp phone number (+254...)
interface PendingDeal {
  venueId: number;
  venueName: string;
  deal: ParsedDeal;
  expiresAt: Date;
}

const pendingDeals = new Map<string, PendingDeal>();

function cleanExpiredPending() {
  const now = new Date();
  for (const [phone, pending] of pendingDeals) {
    if (pending.expiresAt < now) pendingDeals.delete(phone);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function findVenueByWhatsApp(phone: string) {
  const [venue] = await db
    .select()
    .from(venuesTable)
    .where(eq(venuesTable.whatsappNumber, phone))
    .limit(1);
  return venue ?? null;
}

async function createAndPublishDeal(venueId: number, parsed: ParsedDeal) {
  const discountPercent =
    parsed.discountPercent ??
    Math.round(((parsed.originalPrice - parsed.dealPrice) / parsed.originalPrice) * 100);

  const [deal] = await db
    .insert(dealsTable)
    .values({
      venueId,
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      originalPrice: String(parsed.originalPrice),
      dealPrice: String(parsed.dealPrice),
      discountPercent,
      totalSlots: parsed.totalSlots,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
    })
    .returning();

  // Publish immediately
  const [published] = await db
    .update(dealsTable)
    .set({ status: "live", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(dealsTable.id, deal.id))
    .returning();

  return published;
}

async function handleVenueMessage(from: string, text: string, contactName: string) {
  cleanExpiredPending();

  // ── CONFIRM / EDIT / CANCEL flow ─────────────────────────────────────────
  const cmd = text.trim().toUpperCase();
  const pending = pendingDeals.get(from);

  if (pending) {
    if (cmd === "CONFIRM") {
      pendingDeals.delete(from);
      try {
        const deal = await createAndPublishDeal(pending.venueId, pending.deal);
        const kf = (n: number) => `KES ${Number(n).toLocaleString()}`;
        const tf = (d: Date) =>
          d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true });

        await sendTextMessage({
          to: from,
          body:
            `🎉 *Deal posted!* Your flash deal is now live.\n\n` +
            `📌 *${deal.title}*\n` +
            `💰 ${kf(Number(deal.dealPrice))} _(was ${kf(Number(deal.originalPrice))})_\n` +
            `🎟️ ${deal.totalSlots} slots · ${tf(new Date(deal.startsAt))} – ${tf(new Date(deal.endsAt))}\n` +
            `🆔 Deal ID: ${deal.id}\n\n` +
            `Customers are already seeing your deal. Good luck! 🚀`,
        });
      } catch (err) {
        logger.error({ err }, "Failed to create deal from WhatsApp CONFIRM");
        await sendTextMessage({
          to: from,
          body: "❌ Something went wrong creating your deal. Please try again or contact support.",
        });
      }
      return;
    }

    if (cmd === "CANCEL" || cmd === "NO") {
      pendingDeals.delete(from);
      await sendTextMessage({ to: from, body: "❌ Deal cancelled. Send a new message whenever you're ready to post." });
      return;
    }

    if (cmd === "EDIT") {
      pendingDeals.delete(from);
      await sendTextMessage({
        to: from,
        body:
          "✏️ No problem — just resend your deal with the corrections.\n\n" +
          "Format: *Title: X% off — original KES Y, deal KES Z — N slots — HH:MM to HH:MM*",
      });
      return;
    }
  }

  // ── Venue lookup ──────────────────────────────────────────────────────────
  const venue = await findVenueByWhatsApp(from);

  if (!venue) {
    await sendTextMessage({
      to: from,
      body:
        `👋 Hi ${contactName}! This number isn't registered on Nairobi Flash Deals yet.\n\n` +
        `To list your venue and start posting flash deals, contact us at *hello@nairobideals.co.ke*\n\n` +
        `Once approved, you can post deals instantly by messaging us here.`,
    });
    return;
  }

  if (venue.status !== "approved") {
    await sendTextMessage({
      to: from,
      body: `⏳ Hi ${contactName}! Your venue *${venue.name}* is still pending approval. We'll notify you as soon as it's live.`,
    });
    return;
  }

  // ── Deal parse ────────────────────────────────────────────────────────────
  const result = parseDealMessage(text);

  if (!result.ok) {
    await sendTextMessage({ to: from, body: result.clarification! });
    return;
  }

  // Store pending and ask for confirmation
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min to confirm
  pendingDeals.set(from, {
    venueId: venue.id,
    venueName: venue.name,
    deal: result.deal!,
    expiresAt,
  });

  await sendTextMessage({ to: from, body: result.confirmation! });
}

// ── GET /api/whatsapp/webhook — Meta verification ─────────────────────────
router.get("/whatsapp/webhook", (req, res) => {
  const mode  = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "nairobideals_verify_2026";

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("WhatsApp webhook verified by Meta");
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ message: "Verification failed" });
  }
});

// ── POST /api/whatsapp/webhook — Incoming messages ─────────────────────────
router.post("/whatsapp/webhook", async (req, res) => {
  // Always ack immediately — Meta requires 200 within 20s
  res.status(200).json({ status: "ok" });

  try {
    const payload = req.body as WAWebhookPayload;
    if (payload.object !== "whatsapp_business_account") return;

    const inbound = extractInboundMessage(payload);
    if (!inbound) return;

    logger.info({ from: inbound.from, preview: inbound.text.slice(0, 80) }, "WhatsApp inbound message");
    await handleVenueMessage(inbound.from, inbound.text, inbound.contact);
  } catch (err) {
    logger.error({ err }, "Error handling WhatsApp webhook");
  }
});

// ── POST /api/whatsapp/test — Dev/sandbox testing without real WhatsApp ─────
router.post("/whatsapp/test", async (req, res) => {
  const { phone, message, venueWhatsapp } = req.body as {
    phone?: string;
    message?: string;
    venueWhatsapp?: string;
  };

  if (!message) {
    res.status(400).json({ message: "message is required" });
    return;
  }

  const senderPhone = phone ?? venueWhatsapp ?? "+254700000000";

  // Parse only — return what bot would say without hitting the DB
  if (req.query.parseOnly === "1") {
    const result = parseDealMessage(message);
    res.json({ parseResult: result });
    return;
  }

  // Simulate full bot flow — includes DB lookup + deal creation
  const responses: string[] = [];
  const origSend = sendTextMessage;

  // Intercept outgoing messages in test mode
  const captured: string[] = [];

  // Monkey-patch for this request only via closure capture
  const testSend = async (msg: { to: string; body: string }) => {
    captured.push(msg.body);
    logger.info({ to: msg.to, preview: msg.body.slice(0, 100) }, "[WA-TEST] Bot response");
  };

  // We can't easily swap the imported sendTextMessage, so we call handleVenueMessage
  // by temporarily injecting via the whatsapp module. Instead, do a direct parse + DB call:
  const venue = senderPhone
    ? await db.select().from(venuesTable).where(eq(venuesTable.whatsappNumber, senderPhone)).limit(1).then(r => r[0] ?? null)
    : null;

  const parseResult = parseDealMessage(message);

  if (!parseResult.ok) {
    res.json({
      ok: false,
      botResponse: parseResult.clarification,
      errors: parseResult.errors,
      venue: venue ? { id: venue.id, name: venue.name, status: venue.status } : null,
    });
    return;
  }

  res.json({
    ok: true,
    botResponse: parseResult.confirmation,
    parsedDeal: parseResult.deal,
    venue: venue ? { id: venue.id, name: venue.name, status: venue.status } : null,
    note: "To confirm posting, call POST /api/whatsapp/webhook with a WhatsApp payload containing 'CONFIRM'",
  });
});

export default router;
