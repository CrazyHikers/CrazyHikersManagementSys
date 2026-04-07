import { NextResponse } from "next/server";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(req: Request) {
  try {
    const { turnstileToken } = await req.json();

    if (!turnstileToken) {
      return NextResponse.json(
        { success: false, error: "Missing Turnstile token" },
        { status: 400 }
      );
    }

    const valid = await verifyTurnstile(turnstileToken);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Turnstile verification failed" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
