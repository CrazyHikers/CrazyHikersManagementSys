import crypto from "crypto";
import { db } from "@/lib/db";

const PWRESET_PREFIX = "pwreset:";
const ATTEMPT_TTL_MS = 30 * 60 * 1000;
const SETUP_TOKEN_TTL_MS = 60 * 60 * 1000;

export const INBOUND_SIGNUP_SETTING_KEYS = {
  enabled: "inbound_signup_enabled",
  codeHash: "inbound_signup_code_hash",
  expiresAt: "inbound_signup_expires_at",
} as const;

export type InboundSignupConfig = {
  enabled: boolean;
  active: boolean;
  expiresAt: Date | null;
  address: string;
  configured: boolean;
};

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function constantTimeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeEventCode(code: string) {
  return code.trim().toUpperCase();
}

export function hashInboundEventCode(code: string) {
  return hash(normalizeEventCode(code));
}

export async function getInboundSignupConfig(): Promise<InboundSignupConfig> {
  const keys = Object.values(INBOUND_SIGNUP_SETTING_KEYS);
  const rows = await db.appSettings.findMany({ where: { key: { in: keys } } });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const enabled = values.get(INBOUND_SIGNUP_SETTING_KEYS.enabled) === "1";
  const expiresAtValue = values.get(INBOUND_SIGNUP_SETTING_KEYS.expiresAt);
  const parsedExpiry = expiresAtValue ? new Date(expiresAtValue) : null;
  const expiresAt = parsedExpiry && !Number.isNaN(parsedExpiry.getTime()) ? parsedExpiry : null;
  const address = normalizeEmail(process.env.INBOUND_SIGNUP_ADDRESS || "");
  const configured = Boolean(address && process.env.INBOUND_SIGNUP_WEBHOOK_SECRET);

  return {
    enabled,
    active: enabled && configured && Boolean(expiresAt && expiresAt > new Date()),
    expiresAt,
    address,
    configured,
  };
}

export async function createInboundSignupAttempt(email: string, locale: string) {
  const requestCode = crypto.randomBytes(5).toString("hex").toUpperCase();
  const browserToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ATTEMPT_TTL_MS);

  await db.inboundSignupAttempt.create({
    data: {
      requestCode,
      email: normalizeEmail(email),
      browserTokenHash: hash(browserToken),
      locale: locale === "en" ? "en" : "zh",
      expiresAt,
    },
  });

  return { requestCode, browserToken, expiresAt };
}

export async function getInboundSignupStatus(requestCode: string, browserToken: string) {
  const attempt = await db.inboundSignupAttempt.findUnique({ where: { requestCode } });
  if (!attempt || !constantTimeHexEqual(attempt.browserTokenHash, hash(browserToken))) {
    return { status: "not_found" as const };
  }
  if (!attempt.setupToken && attempt.expiresAt <= new Date()) {
    return { status: "expired" as const };
  }
  if (!attempt.setupToken) {
    return { status: "pending" as const, expiresAt: attempt.expiresAt };
  }

  const params = new URLSearchParams({ token: attempt.setupToken, email: attempt.email });
  return {
    status: "verified" as const,
    setupPath: `/${attempt.locale}/reset-password?${params.toString()}`,
  };
}

export type VerifyInboundSignupInput = {
  sender: string;
  authenticatedHeaderSender?: string | null;
  eventCode: string;
  requestCode: string;
  messageId: string;
};

export async function verifyInboundSignupEmail(input: VerifyInboundSignupInput) {
  const config = await getInboundSignupConfig();
  if (!config.active) return { outcome: "disabled" as const };

  const storedCode = await db.appSettings.findUnique({
    where: { key: INBOUND_SIGNUP_SETTING_KEYS.codeHash },
  });
  if (!storedCode || !constantTimeHexEqual(storedCode.value, hashInboundEventCode(input.eventCode))) {
    return { outcome: "invalid_code" as const };
  }

  const requestCode = input.requestCode.trim().toUpperCase();
  const attempt = await db.inboundSignupAttempt.findUnique({ where: { requestCode } });
  if (!attempt) return { outcome: "not_found" as const };
  if (attempt.expiresAt <= new Date()) return { outcome: "expired" as const };
  const authenticatedSenders = [input.sender, input.authenticatedHeaderSender]
    .filter((sender): sender is string => Boolean(sender))
    .map(normalizeEmail);
  if (!authenticatedSenders.includes(attempt.email)) {
    return { outcome: "sender_mismatch" as const };
  }
  if (attempt.setupToken) return { outcome: "verified" as const };

  const setupToken = crypto.randomBytes(32).toString("base64url");
  const verifiedAt = new Date();
  const tokenExpiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);

  const reserved = await db.$transaction(async (tx) => {
    const updated = await tx.inboundSignupAttempt.updateMany({
      where: { id: attempt.id, setupToken: null },
      data: {
        setupToken,
        messageId: input.messageId || null,
        verifiedAt,
      },
    });
    if (updated.count === 0) return false;

    await tx.verificationToken.create({
      data: {
        identifier: `${PWRESET_PREFIX}${attempt.email}`,
        token: setupToken,
        expires: tokenExpiresAt,
      },
    });
    return true;
  });

  return { outcome: reserved ? "verified" as const : "already_verified" as const };
}
