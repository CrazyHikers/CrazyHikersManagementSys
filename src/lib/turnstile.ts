import crypto from "crypto";

const TURNSTILE_COOKIE_NAME = "turnstile-verified";
const TURNSTILE_COOKIE_TTL_MS = 60_000; // 60 seconds

export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[TURNSTILE] TURNSTILE_SECRET_KEY is not set");
    return false;
  }

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
      }
    );
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("[TURNSTILE] Verification failed:", err);
    return false;
  }
}

function getHmacKey(): string {
  return process.env.AUTH_SECRET || "fallback-key";
}

/** Create a signed cookie value: timestamp.hmac */
export function createTurnstileCookie(): {
  name: string;
  value: string;
  maxAge: number;
} {
  const timestamp = Date.now().toString();
  const hmac = crypto
    .createHmac("sha256", getHmacKey())
    .update(timestamp)
    .digest("hex");

  return {
    name: TURNSTILE_COOKIE_NAME,
    value: `${timestamp}.${hmac}`,
    maxAge: Math.ceil(TURNSTILE_COOKIE_TTL_MS / 1000),
  };
}

/** Verify the signed cookie is valid and not expired */
export function verifyTurnstileCookie(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;

  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, hmac] = parts;
  const expectedHmac = crypto
    .createHmac("sha256", getHmacKey())
    .update(timestamp)
    .digest("hex");

  if (hmac !== expectedHmac) return false;

  const age = Date.now() - parseInt(timestamp, 10);
  return age >= 0 && age < TURNSTILE_COOKIE_TTL_MS;
}
