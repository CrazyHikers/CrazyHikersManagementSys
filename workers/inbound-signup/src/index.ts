const SUBJECT_PATTERN = /^JOIN\s+([A-Z0-9-]{4,32})\s+([A-F0-9]{10})$/i;

function normalizeAddress(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function parseSingleFromAddress(value: string | null) {
  if (!value) return null;

  const addresses = value.match(
    /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?/gi,
  );
  if (addresses?.length !== 1) return null;
  return normalizeAddress(addresses[0]);
}

function getAuthenticatedHeaderSender(headers: Headers) {
  const sender = parseSingleFromAddress(headers.get("from"));
  const authenticationResults = headers
    .get("authentication-results")
    ?.replace(/\r?\n[\t ]+/g, " ");
  if (!sender || !authenticationResults || !/^mx\.cloudflare\.net\s*;/i.test(authenticationResults)) {
    return null;
  }

  const senderDomain = normalizeDomain(sender.slice(sender.lastIndexOf("@") + 1));
  const results = authenticationResults.split(";").slice(1);
  const dmarcDomain = results
    .find((result) => /^\s*dmarc=pass\b/i.test(result))
    ?.match(/\bheader\.from=([^\s;()]+)/i)?.[1];
  const dkimDomains = results
    .filter((result) => /^\s*dkim=pass\b/i.test(result))
    .map((result) => result.match(/\bheader\.d=([^\s;()]+)/i)?.[1])
    .filter((domain): domain is string => Boolean(domain));

  if (
    !dmarcDomain ||
    normalizeDomain(dmarcDomain) !== senderDomain ||
    !dkimDomains.some((domain) => normalizeDomain(domain) === senderDomain)
  ) {
    return null;
  }
  return sender;
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
      // Prefer the SMTP envelope sender. The header sender is only supplied as
      // a fallback when Cloudflare reports aligned DKIM and DMARC passes.
      sender: normalizeAddress(message.from),
      authenticatedHeaderSender: getAuthenticatedHeaderSender(message.headers),
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
