/**
 * NLP deal parser for WhatsApp venue bot.
 * Extracts structured deal data from a single free-text message.
 * No external AI — pure regex + keyword mapping, tuned for Nairobi venue lingo.
 */

export type DealCategory =
  | "lunch"
  | "dinner"
  | "brunch"
  | "treatment"
  | "class"
  | "experience"
  | "drinks"
  | "tasting";

export interface ParsedDeal {
  title: string;
  description: string;
  category: DealCategory;
  originalPrice: number;
  dealPrice: number;
  discountPercent: number;
  totalSlots: number;
  startsAt: Date;
  endsAt: Date;
}

export interface ParseError {
  field: string;
  message: string;
}

export interface ParseResult {
  ok: boolean;
  deal?: ParsedDeal;
  errors?: ParseError[];
  /** Human-readable confirmation string to send back to venue */
  confirmation?: string;
  /** Clarification question when parsing is incomplete */
  clarification?: string;
}

// ── Category keyword map ────────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<DealCategory, string[]> = {
  lunch:      ["lunch", "lunchtime", "midday"],
  dinner:     ["dinner", "supper", "evening meal"],
  brunch:     ["brunch"],
  treatment:  ["spa", "treatment", "massage", "facial", "pedicure", "manicure", "hammam"],
  class:      ["class", "yoga", "pilates", "spin", "fitness", "workout", "session"],
  experience: ["experience", "tour", "safari", "tasting menu", "chef's table", "sundowner"],
  drinks:     ["drinks", "cocktails", "happy hour", "sundowner", "wine", "beer"],
  tasting:    ["tasting", "degustation", "wine tasting", "whisky", "pairing"],
};

function detectCategory(text: string): DealCategory {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return cat as DealCategory;
    }
  }
  return "experience";
}

// ── Price extraction ────────────────────────────────────────────────────────
interface PriceResult {
  originalPrice: number;
  dealPrice: number;
  discountPercent: number;
}

function extractPrices(text: string): PriceResult | null {
  const lower = text.toLowerCase();

  // Pattern: "originally 5000 now 3000" / "was 5000, now 3000" / "5000 → 3000"
  const fromToPattern =
    /(?:originally?|was|from|original[:\s]*kes?)[\s:]*(\d[\d,]+)[\s\w,]*(?:now|→|->|to|deal[:\s]*)[\s:]*(?:kes?\s*)?(\d[\d,]+)/i;
  let m = text.match(fromToPattern);
  if (m) {
    const orig = parseInt(m[1].replace(/,/g, ""), 10);
    const deal = parseInt(m[2].replace(/,/g, ""), 10);
    const disc = Math.round(((orig - deal) / orig) * 100);
    return { originalPrice: orig, dealPrice: deal, discountPercent: disc };
  }

  // Pattern: "50% off [from] 4000" / "40% off — original 6000"
  const pctOffPattern =
    /(\d{1,2})%\s*off(?:[\s\w,–-]*?(?:from|original[:\s]*kes?|kes?)[\s:]*(\d[\d,]+))?/i;
  m = text.match(pctOffPattern);
  if (m) {
    const disc = parseInt(m[1], 10);
    if (m[2]) {
      const orig = parseInt(m[2].replace(/,/g, ""), 10);
      const deal = Math.round(orig * (1 - disc / 100));
      return { originalPrice: orig, dealPrice: deal, discountPercent: disc };
    }
    // Discount % found but no original price — look for any KES amount
    const anyPrice = text.match(/(?:kes?)?\s*(\d[\d,]+)/i);
    if (anyPrice) {
      const deal = parseInt(anyPrice[1].replace(/,/g, ""), 10);
      const orig = Math.round(deal / (1 - disc / 100));
      return { originalPrice: orig, dealPrice: deal, discountPercent: disc };
    }
  }

  // Pattern: two bare numbers like "6000 3200" or "6000/3200"
  const twoPricesPattern = /(\d{3,6})\s*[\/|,–-]\s*(\d{3,6})/;
  m = text.match(twoPricesPattern);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const [orig, deal] = a > b ? [a, b] : [b, a];
    const disc = Math.round(((orig - deal) / orig) * 100);
    return { originalPrice: orig, dealPrice: deal, discountPercent: disc };
  }

  // Fallback: single price → treat as deal price, assume 30% discount
  const singlePrice = text.match(/(?:kes?\s*)?(\d{3,6})(?:\s*(?:per|pp|each))?/i);
  if (singlePrice) {
    const deal = parseInt(singlePrice[1], 10);
    const orig = Math.round(deal / 0.7);
    return { originalPrice: orig, dealPrice: deal, discountPercent: 30 };
  }

  return null;
}

// ── Slot extraction ─────────────────────────────────────────────────────────
function extractSlots(text: string): number | null {
  // "12 slots" / "10 spaces" / "8 people" / "6 covers" / "limited to 5"
  const m = text.match(
    /(\d+)\s*(?:slots?|spaces?|people|covers?|seats?|pax|guests?)|(?:limited\s+to|only)\s+(\d+)/i
  );
  if (m) return parseInt(m[1] ?? m[2], 10);
  return null;
}

// ── Time extraction ─────────────────────────────────────────────────────────
interface TimeWindow {
  startsAt: Date;
  endsAt: Date;
}

function parseTime(timeStr: string, base: Date): Date {
  const t = timeStr.toLowerCase().trim();
  const now = new Date(base);

  // "now" → current time rounded up to next 15 min
  if (t === "now") {
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    return now;
  }

  // "12pm", "3:30pm", "15:00"
  const timeMatch = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!timeMatch) return now;

  let hours = parseInt(timeMatch[1], 10);
  const mins = parseInt(timeMatch[2] ?? "0", 10);
  const meridiem = timeMatch[3];

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  const result = new Date(base);
  result.setHours(hours, mins, 0, 0);
  return result;
}

function extractTimes(text: string, now: Date): TimeWindow | null {
  const lower = text.toLowerCase();

  // "12pm – 3pm" / "12:00 to 15:00" / "12–3pm" / "starts 12pm ends 3pm"
  const rangePattern =
    /(?:starts?\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:[-–—]|to|until|till|ends?)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  let m = text.match(rangePattern);
  if (m) {
    const start = parseTime(m[1], now);
    const end = parseTime(m[2], now);
    // If end is before start assume pm
    if (end <= start) end.setHours(end.getHours() + 12);
    return { startsAt: start, endsAt: end };
  }

  // "now until 5pm" / "open until 7pm"
  const nowUntilPattern =
    /(?:from\s+)?(?:now|immediately)\s+(?:until|till|to|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  m = text.match(nowUntilPattern);
  if (m) {
    const start = new Date(now);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
    const end = parseTime(m[1], now);
    return { startsAt: start, endsAt: end };
  }

  // Only end time: "ends at 5pm" / "until 6pm"
  const endOnlyPattern =
    /(?:ends?\s+(?:at\s+)?|until\s+|till\s+)(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  m = text.match(endOnlyPattern);
  if (m) {
    const start = new Date(now);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
    const end = parseTime(m[1], now);
    return { startsAt: start, endsAt: end };
  }

  return null;
}

// ── Title generation ────────────────────────────────────────────────────────
function buildTitle(text: string, category: DealCategory): string {
  // Take the first meaningful sentence / clause (before first comma or dash)
  const firstClause = text.split(/[,\-–—:|]/)[0].trim();
  if (firstClause.length >= 10 && firstClause.length <= 60) {
    return firstClause;
  }
  // Fallback
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `Flash ${cap(category)} Deal`;
}

// ── Main parser ─────────────────────────────────────────────────────────────
export function parseDealMessage(message: string, referenceTime?: Date): ParseResult {
  const now = referenceTime ?? new Date();
  const errors: ParseError[] = [];

  const category = detectCategory(message);
  const prices = extractPrices(message);
  const slots = extractSlots(message);
  const times = extractTimes(message, now);
  const title = buildTitle(message, category);

  if (!prices) {
    errors.push({ field: "price", message: "Could not detect pricing. Try: 'original 5000, deal 3200' or '40% off KES 4000'" });
  }
  if (!slots) {
    errors.push({ field: "slots", message: "Could not detect slot count. Try: '8 slots' or '10 people'" });
  }
  if (!times) {
    errors.push({ field: "time", message: "Could not detect time window. Try: '12pm – 3pm' or 'now until 5pm'" });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      clarification:
        `❓ I couldn't parse your deal fully. Please reply with a clearer format, e.g.:\n\n` +
        `*Spa special: 50% off — original KES 6000, deal KES 3000 — 8 slots — 2pm to 6pm*\n\n` +
        `Missing: ${errors.map((e) => e.field).join(", ")}`,
    };
  }

  const deal: ParsedDeal = {
    title,
    description: message.trim(),
    category,
    originalPrice: prices!.originalPrice,
    dealPrice: prices!.dealPrice,
    discountPercent: prices!.discountPercent,
    totalSlots: slots!,
    startsAt: times!.startsAt,
    endsAt: times!.endsAt,
  };

  const kf = (n: number) => `KES ${n.toLocaleString()}`;
  const tf = (d: Date) =>
    d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: true });

  const confirmation =
    `✅ *Deal ready to post!*\n\n` +
    `📌 *${deal.title}*\n` +
    `🏷️ ${deal.category} • ${deal.discountPercent}% off\n` +
    `💰 ${kf(deal.dealPrice)} _(was ${kf(deal.originalPrice)})_\n` +
    `🎟️ ${deal.totalSlots} slots\n` +
    `⏰ ${tf(deal.startsAt)} – ${tf(deal.endsAt)} today\n\n` +
    `Reply *CONFIRM* to post or *EDIT* to make changes.`;

  return { ok: true, deal, confirmation };
}
