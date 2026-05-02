/**
 * Safaricom Daraja API service
 * Handles OAuth token caching and STK Push (Lipa Na M-Pesa Online)
 *
 * Sandbox: https://sandbox.safaricom.co.ke
 * Production: https://api.safaricom.co.ke
 */

const isSandbox = process.env["MPESA_ENV"] !== "production";
const BASE_URL = isSandbox
  ? "https://sandbox.safaricom.co.ke"
  : "https://api.safaricom.co.ke";

const CONSUMER_KEY = process.env["MPESA_CONSUMER_KEY"] ?? "";
const CONSUMER_SECRET = process.env["MPESA_CONSUMER_SECRET"] ?? "";
const SHORTCODE = process.env["MPESA_SHORTCODE"] ?? "174379"; // sandbox default
const PASSKEY = process.env["MPESA_PASSKEY"] ?? "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"; // sandbox default
const CALLBACK_URL = process.env["MPESA_CALLBACK_URL"] ?? "";

export function isDarajaConfigured(): boolean {
  return Boolean(CONSUMER_KEY && CONSUMER_SECRET && CALLBACK_URL);
}

// ── Token cache ───────────────────────────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

  const res = await fetch(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: { Authorization: `Basic ${credentials}` },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja OAuth failed [${res.status}]: ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: string };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) - 30) * 1000,
  };

  return tokenCache.token;
}

// ── STK Push ──────────────────────────────────────────────────────────────────

export interface StkPushParams {
  phone: string;         // +254XXXXXXXXX or 254XXXXXXXXX
  amountKes: number;     // integer KES amount (Daraja requires integer)
  bookingId: number;
  confirmationCode: string;
  description?: string;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

function normalisePhone(phone: string): string {
  // Convert +254XXXXXXXXX → 254XXXXXXXXX
  return phone.replace(/^\+/, "");
}

function timestamp(): string {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0")
  );
}

export async function initiateSTKPush(params: StkPushParams): Promise<StkPushResult> {
  const token = await getAccessToken();
  const ts = timestamp();
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${ts}`).toString("base64");

  const phone = normalisePhone(params.phone);
  const amount = Math.ceil(params.amountKes); // Daraja requires integer

  const body = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: CALLBACK_URL,
    AccountReference: `NFD-${params.confirmationCode}`,
    TransactionDesc: params.description ?? `Nairobi Flash Deals booking #${params.bookingId}`,
  };

  const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`STK Push failed [${res.status}]: ${text}`);
  }

  const data = (await res.json()) as {
    CheckoutRequestID: string;
    MerchantRequestID: string;
    ResponseCode: string;
    ResponseDescription: string;
    CustomerMessage: string;
  };

  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
    customerMessage: data.CustomerMessage,
  };
}

// ── STK Query (status check) ──────────────────────────────────────────────────

export interface StkQueryResult {
  resultCode: string;
  resultDesc: string;
}

export async function queryStkStatus(checkoutRequestId: string): Promise<StkQueryResult> {
  const token = await getAccessToken();
  const ts = timestamp();
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${ts}`).toString("base64");

  const res = await fetch(`${BASE_URL}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const data = (await res.json()) as { ResultCode: string; ResultDesc: string };
  return { resultCode: data.ResultCode, resultDesc: data.ResultDesc };
}

// ── Callback parsing ──────────────────────────────────────────────────────────

export interface CallbackItem {
  Name: string;
  Value: string | number;
}

export interface DarajaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: CallbackItem[];
      };
    };
  };
}

export function parseCallback(raw: DarajaCallback): {
  checkoutRequestId: string;
  success: boolean;
  resultCode: number;
  resultDesc: string;
  mpesaRef?: string;
  phone?: string;
  amountPaid?: number;
  transactionDate?: string;
} {
  const cb = raw.Body.stkCallback;
  const success = cb.ResultCode === 0;
  const items = cb.CallbackMetadata?.Item ?? [];

  const get = (name: string) => items.find((i) => i.Name === name)?.Value;

  return {
    checkoutRequestId: cb.CheckoutRequestID,
    success,
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc,
    mpesaRef: success ? String(get("MpesaReceiptNumber") ?? "") : undefined,
    phone: success ? String(get("PhoneNumber") ?? "") : undefined,
    amountPaid: success ? Number(get("Amount") ?? 0) : undefined,
    transactionDate: success ? String(get("TransactionDate") ?? "") : undefined,
  };
}
