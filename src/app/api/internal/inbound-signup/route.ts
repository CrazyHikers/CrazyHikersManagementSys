import crypto from "crypto";
import { NextResponse } from "next/server";
import { verifyInboundSignupEmail } from "@/lib/inbound-signup";

const MAX_BODY_BYTES = 4_096;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function verifySignature(payload: string, timestamp: string, signature: string) {
  const secret = process.env.INBOUND_SIGNUP_WEBHOOK_SECRET;
  if (!secret || !/^\d{10,13}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const payload = await request.text();
  if (Buffer.byteLength(payload, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const timestamp = request.headers.get("x-inbound-signup-timestamp") || "";
  const signature = request.headers.get("x-inbound-signup-signature") || "";
  if (!verifySignature(payload, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const body: unknown = JSON.parse(payload);
    if (
      !body ||
      typeof body !== "object" ||
      !("sender" in body) || typeof body.sender !== "string" ||
      !("eventCode" in body) || typeof body.eventCode !== "string" ||
      !("requestCode" in body) || typeof body.requestCode !== "string" ||
      !("messageId" in body) || typeof body.messageId !== "string"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const result = await verifyInboundSignupEmail({
      sender: body.sender,
      eventCode: body.eventCode,
      requestCode: body.requestCode,
      messageId: body.messageId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[INBOUND_SIGNUP_WEBHOOK] error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
