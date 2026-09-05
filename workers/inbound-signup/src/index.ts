const SUBJECT_PATTERN = /^JOIN\s+([A-Z0-9-]{4,32})\s+([A-F0-9]{10})$/i;

function normalizeAddress(value: string) {
  return value.trim().toLowerCase();
}

async function sign(secret: string, timestamp: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default {
  async email(message, env): Promise<void> {
    if (normalizeAddress(message.to) !== normalizeAddress(env.SIGNUP_ADDRESS)) {
      message.setReject("Unknown signup verification address");
      return;
    }

    const subject = message.headers.get("subject")?.trim() || "";
    const match = SUBJECT_PATTERN.exec(subject);
    if (!match) {
      message.setReject("Subject must be: JOIN <event-code> <request-code>");
      return;
    }

    const payload = JSON.stringify({
      // Use the SMTP envelope sender. Unlike the display From header, this
      // value is supplied by Email Routing and is not parsed from MIME text.
      sender: normalizeAddress(message.from),
      eventCode: match[1].toUpperCase(),
      requestCode: match[2].toUpperCase(),
      messageId: message.headers.get("message-id") || crypto.randomUUID(),
    });
    const timestamp = Date.now().toString();
    const signature = await sign(env.SIGNUP_WEBHOOK_SECRET, timestamp, payload);
    const response = await fetch(env.SITE_CALLBACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inbound-Signup-Timestamp": timestamp,
        "X-Inbound-Signup-Signature": signature,
      },
      body: payload,
    });

    if (!response.ok) {
      console.error(JSON.stringify({
        message: "signup callback failed",
        status: response.status,
        requestCode: match[2].toUpperCase(),
      }));
      throw new Error(`Signup callback failed with status ${response.status}`);
    }

    const result: unknown = await response.json();
    console.log(JSON.stringify({
      message: "inbound signup email processed",
      requestCode: match[2].toUpperCase(),
      result,
    }));
    // No forwarding or reply is needed. Returning drops the processed email.
  },
} satisfies ExportedHandler<Env>;
