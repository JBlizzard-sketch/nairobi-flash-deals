/**
 * Firebase Cloud Messaging (FCM) v1 HTTP client.
 *
 * Operates in simulated mode when GOOGLE_APPLICATION_CREDENTIALS_JSON is absent
 * — logs the notification payload instead of calling FCM.
 *
 * To go live:
 *   1. Create a Firebase project → Project Settings → Service Accounts → Generate new private key
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS_JSON to the full JSON content of the key file
 *   3. Set FIREBASE_PROJECT_ID to your Firebase project ID
 */

import { logger } from "./logger";

export function isFCMConfigured(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON &&
    process.env.FIREBASE_PROJECT_ID
  );
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id: string;
}

let _cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const now = Date.now();
  if (_cachedToken && _cachedToken.expiresAt > now + 60_000) {
    return _cachedToken.value;
  }

  // Build a minimal JWT for Google OAuth2
  const { SignJWT } = await import("jose");
  const { createPrivateKey } = await import("crypto");

  const privateKey = createPrivateKey(sa.private_key);
  const iat = Math.floor(now / 1000);

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 3600)
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .sign(privateKey);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FCM OAuth2 token error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  _cachedToken = { value: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return _cachedToken.value;
}

export interface FCMPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FCMResult {
  messageId?: string;
  simulated: boolean;
  error?: string;
}

export async function sendPushNotification(payload: FCMPayload): Promise<FCMResult> {
  if (!isFCMConfigured()) {
    logger.info(
      { to: payload.token.slice(0, 12) + "…", title: payload.title },
      "[FCM-SIM] Would send push notification"
    );
    return { simulated: true, messageId: `sim-${Date.now()}` };
  }

  try {
    const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!;
    const sa = JSON.parse(saJson) as ServiceAccountKey;
    const projectId = process.env.FIREBASE_PROJECT_ID ?? sa.project_id;
    const accessToken = await getAccessToken(sa);

    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: payload.token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data ?? {},
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.warn({ status: res.status, errText }, "FCM send failed");
      return { simulated: false, error: errText };
    }

    const json = (await res.json()) as { name: string };
    return { simulated: false, messageId: json.name };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "FCM exception");
    return { simulated: false, error: message };
  }
}
