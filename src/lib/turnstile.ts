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
