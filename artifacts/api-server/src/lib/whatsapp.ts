/**
 * WhatsApp Cloud API client (Meta Business Platform v19.0)
 * Operates in simulated mode when WHATSAPP_TOKEN / WHATSAPP_PHONE_ID are absent.
 */

import { logger } from "./logger";

const GRAPH_API = "https://graph.facebook.com/v19.0";

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export interface TextMessage {
  to: string;
  body: string;
}

/**
 * Send a plain-text WhatsApp message.
 * In simulated mode, logs the message instead of calling Meta's API.
 */
export async function sendTextMessage(msg: TextMessage): Promise<void> {
  if (!isWhatsAppConfigured()) {
    logger.info({ to: msg.to, preview: msg.body.slice(0, 120) }, "[WA-SIM] Would send WhatsApp message");
    return;
  }

  const phoneId = process.env.WHATSAPP_PHONE_ID!;
  const token   = process.env.WHATSAPP_TOKEN!;

  const res = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: msg.to.replace(/^\+/, ""),
      type: "text",
      text: { preview_url: false, body: msg.body },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${errBody}`);
  }
}

// ── Webhook types ────────────────────────────────────────────────────────────
export interface WAEntry {
  id: string;
  changes: WAChange[];
}

export interface WAChange {
  value: WAValue;
  field: string;
}

export interface WAValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WAContact[];
  messages?: WAMessage[];
  statuses?: WAStatus[];
}

export interface WAContact {
  profile: { name: string };
  wa_id: string;
}

export interface WAMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body: string };
  type: string;
}

export interface WAStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

export interface WAWebhookPayload {
  object: string;
  entry: WAEntry[];
}

/**
 * Extract the first inbound text message from a WhatsApp Cloud API webhook payload.
 */
export function extractInboundMessage(
  payload: WAWebhookPayload
): { from: string; text: string; contact: string } | null {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages;
      if (!messages?.length) continue;
      const msg = messages[0];
      if (msg.type !== "text" || !msg.text?.body) continue;
      const contact = change.value.contacts?.[0]?.profile?.name ?? "Venue";
      return {
        from: `+${msg.from}`,
        text: msg.text.body,
        contact,
      };
    }
  }
  return null;
}
