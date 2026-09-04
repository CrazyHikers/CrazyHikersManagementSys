// Cloudflare's official "always passes" testing secret — used on any
// non-production deploy so that Vercel preview URLs (random `*.vercel.app`
// hostnames) keep working without each one being added to the Turnstile
// site-key allowlist. See:
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TEST_SECRET_ALWAYS_PASS = "1x0000000000000000000000000000000AA";

export type TurnstileVerificationStatus = "valid" | "invalid" | "unavailable";

export async function verifyTurnstileStatus(
  token: string
): Promise<TurnstileVerificationStatus> {
  const isProduction = process.env.VERCEL_ENV === "production";
  const secret = isProduction
    ? process.env.TURNSTILE_SECRET_KEY
    : TEST_SECRET_ALWAYS_PASS;
  if (!secret) {
    console.error("[TURNSTILE] TURNSTILE_SECRET_KEY is not set");
    return "unavailable";
  }

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(10_000),
      }
    );
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    const serviceFailure =
      !res.ok ||
      data["error-codes"]?.some((code) =>
        [
          "internal-error",
          "missing-input-secret",
          "invalid-input-secret",
          "bad-request",
        ].includes(code)
      );

    if (serviceFailure) {
      console.error("[TURNSTILE] Siteverify service error", {
        status: res.status,
        errorCodes: data["error-codes"],
      });
      return "unavailable";
    }

    return data.success === true ? "valid" : "invalid";
  } catch (err) {
    console.error("[TURNSTILE] Verification failed:", err);
    return "unavailable";
  }
}

export async function verifyTurnstile(token: string): Promise<boolean> {
  return (await verifyTurnstileStatus(token)) === "valid";
}
