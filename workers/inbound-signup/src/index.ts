import { DurableObject } from "cloudflare:workers";

const SUBJECT_PATTERN = /^JOIN\s+([A-F0-9]{10})$/i;
const SESSION_OBJECT_NAME = "active-signup-session";
const MAX_CONTROL_BODY_BYTES = 4_096;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const CLAIM_LEASE_MS = 60 * 1000;

type SessionRow = { active: number; generation: string; expires_at: number };
type AttemptRow = {
  request_code: string;
  sender_hash: string;
  expires_at: number;
  claim_until: number;
};

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

async function hmac(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(secret: string, payload: string, timestamp: string, signature: string) {
  if (!/^\d{10,13}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
    return false;
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureBytes = new Uint8Array(signature.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(`${timestamp}.${payload}`));
}

async function hashSender(secret: string, address: string) {
  return hmac(secret, normalizeAddress(address));
}

async function readLimitedBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > MAX_CONTROL_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_CONTROL_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export class SignupSession extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS signup_session (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          active INTEGER NOT NULL,
          generation TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS signup_attempts (
          request_code TEXT PRIMARY KEY,
          sender_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          claim_until INTEGER NOT NULL DEFAULT 0
        );
      `);
    });
  }

  async openSession(generation: string, expiresAt: number) {
    if (!generation || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;
    this.ctx.storage.sql.exec("DELETE FROM signup_attempts");
    this.ctx.storage.sql.exec(
      `INSERT INTO signup_session (id, active, generation, expires_at)
       VALUES (1, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET active = 1, generation = excluded.generation,
         expires_at = excluded.expires_at`,
      generation,
      expiresAt,
    );
    await this.ctx.storage.setAlarm(expiresAt);
    return true;
  }

  async closeSession(generation: string) {
    const session = this.getSession();
    if (session && session.generation !== generation) return false;
    this.ctx.storage.sql.exec("DELETE FROM signup_attempts");
    this.ctx.storage.sql.exec("UPDATE signup_session SET active = 0 WHERE id = 1");
    await this.ctx.storage.deleteAlarm();
    return true;
  }

  registerAttempt(generation: string, requestCode: string, senderHash: string, expiresAt: number) {
    const session = this.getSession();
    const now = Date.now();
    if (
      !session || session.active !== 1 || session.generation !== generation ||
      session.expires_at <= now || !/^[A-F0-9]{10}$/.test(requestCode) ||
      !/^[a-f0-9]{64}$/.test(senderHash) || !Number.isSafeInteger(expiresAt) ||
      expiresAt <= now
    ) {
      return false;
    }
    this.ctx.storage.sql.exec("DELETE FROM signup_attempts WHERE expires_at <= ?", now);
    this.ctx.storage.sql.exec(
      `INSERT INTO signup_attempts (request_code, sender_hash, expires_at, claim_until)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(request_code) DO UPDATE SET sender_hash = excluded.sender_hash,
         expires_at = excluded.expires_at, claim_until = 0`,
      requestCode,
      senderHash,
      Math.min(expiresAt, session.expires_at),
    );
    return true;
  }

  claimAttempt(requestCode: string, senderHashes: string[]) {
    const session = this.getSession();
    const now = Date.now();
    if (!session || session.active !== 1 || session.expires_at <= now) {
      this.expireSession();
      return false;
    }
    this.ctx.storage.sql.exec("DELETE FROM signup_attempts WHERE expires_at <= ?", now);
    const attempt = this.ctx.storage.sql
      .exec<AttemptRow>("SELECT * FROM signup_attempts WHERE request_code = ?", requestCode)
      .toArray()[0];
    if (!attempt || !senderHashes.includes(attempt.sender_hash) || attempt.claim_until > now) {
      return false;
    }
    this.ctx.storage.sql.exec(
      "UPDATE signup_attempts SET claim_until = ? WHERE request_code = ?",
      now + CLAIM_LEASE_MS,
      requestCode,
    );
    return true;
  }

  releaseAttempt(requestCode: string) {
    this.ctx.storage.sql.exec("UPDATE signup_attempts SET claim_until = 0 WHERE request_code = ?", requestCode);
  }

  completeAttempt(requestCode: string) {
    this.ctx.storage.sql.exec("DELETE FROM signup_attempts WHERE request_code = ?", requestCode);
  }

  async alarm() {
    const session = this.getSession();
    if (!session || session.expires_at <= Date.now()) {
      this.expireSession();
      return;
    }
    await this.ctx.storage.setAlarm(session.expires_at);
  }

  private getSession() {
    return this.ctx.storage.sql
      .exec<SessionRow>("SELECT active, generation, expires_at FROM signup_session WHERE id = 1")
      .toArray()[0];
  }

  private expireSession() {
    this.ctx.storage.sql.exec("DELETE FROM signup_attempts");
    this.ctx.storage.sql.exec("UPDATE signup_session SET active = 0 WHERE id = 1");
  }
}

function getSessionStub(env: Env) {
  // Wrangler generates the binding itself, but cannot infer the exported RPC
  // class for a same-Worker Durable Object.
  return env.SIGNUP_SESSION.getByName(SESSION_OBJECT_NAME) as DurableObjectStub<SignupSession>;
}

async function handleControlRequest(request: Request, env: Env) {
  if (request.method !== "POST") return new Response("Not found", { status: 404 });
  const payload = await readLimitedBody(request);
  if (payload === null) return Response.json({ error: "Payload too large" }, { status: 413 });
  const timestamp = request.headers.get("x-inbound-signup-timestamp") || "";
  const signature = request.headers.get("x-inbound-signup-signature") || "";
  if (!(await verifySignature(env.SIGNUP_WEBHOOK_SECRET, payload, timestamp, signature))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid payload" }, { status: 400 });

  const path = new URL(request.url).pathname;
  const stub = getSessionStub(env);
  if (path === "/internal/session/open") {
    if (!("generation" in body) || typeof body.generation !== "string" ||
        !("expiresAt" in body) || typeof body.expiresAt !== "number") {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    const opened = await stub.openSession(body.generation, body.expiresAt);
    return Response.json({ ok: opened }, { status: opened ? 200 : 409 });
  }
  if (path === "/internal/session/close") {
    if (!("generation" in body) || typeof body.generation !== "string") {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    const closed = await stub.closeSession(body.generation);
    return Response.json({ ok: closed }, { status: closed ? 200 : 409 });
  }
  if (path === "/internal/attempts") {
    if (!("generation" in body) || typeof body.generation !== "string" ||
        !("requestCode" in body) || typeof body.requestCode !== "string" ||
        !("senderHash" in body) || typeof body.senderHash !== "string" ||
        !("expiresAt" in body) || typeof body.expiresAt !== "number") {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }
    const registered = await stub.registerAttempt(
      body.generation, body.requestCode, body.senderHash, body.expiresAt,
    );
    return Response.json({ ok: registered }, { status: registered ? 200 : 409 });
  }
  return new Response("Not found", { status: 404 });
}

export default {
  fetch: handleControlRequest,

  async email(message, env): Promise<void> {
    if (normalizeAddress(message.to) !== normalizeAddress(env.SIGNUP_ADDRESS)) {
      message.setReject("Unknown signup verification address");
      return;
    }
    const subject = message.headers.get("subject")?.trim() || "";
    const match = SUBJECT_PATTERN.exec(subject);
    if (!match) return;

    const requestCode = match[1].toUpperCase();
    const authenticatedHeaderSender = getAuthenticatedHeaderSender(message.headers);
    const senders = [normalizeAddress(message.from), authenticatedHeaderSender]
      .filter((sender): sender is string => Boolean(sender));
    const senderHashes = await Promise.all([...new Set(senders)].map((sender) =>
      hashSender(env.SIGNUP_WEBHOOK_SECRET, sender),
    ));
    const stub = getSessionStub(env);
    if (!(await stub.claimAttempt(requestCode, senderHashes))) {
      console.log(JSON.stringify({ message: "inbound signup email ignored", requestCode }));
      return;
    }

    const payload = JSON.stringify({
      requestCode,
      messageId: (message.headers.get("message-id") || crypto.randomUUID()).slice(0, 512),
    });
    const timestamp = Date.now().toString();
    const signature = await hmac(env.SIGNUP_WEBHOOK_SECRET, `${timestamp}.${payload}`);
    try {
      const response = await fetch(env.SITE_CALLBACK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Inbound-Signup-Timestamp": timestamp,
          "X-Inbound-Signup-Signature": signature,
        },
        body: payload,
      });
      if (!response.ok) throw new Error(`Signup callback failed with status ${response.status}`);
      const result: unknown = await response.json();
      await stub.completeAttempt(requestCode);
      console.log(JSON.stringify({ message: "inbound signup email processed", requestCode, result }));
    } catch (error) {
      await stub.releaseAttempt(requestCode);
      console.error(JSON.stringify({
        message: "signup callback failed",
        requestCode,
        error: error instanceof Error ? error.message : "unknown error",
      }));
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
