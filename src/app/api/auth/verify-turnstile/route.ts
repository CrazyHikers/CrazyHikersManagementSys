import { NextResponse } from "next/server";
import { verifyTurnstile, createTurnstileCookie } from "@/lib/turnstile";

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

    const cookie = createTurnstileCookie();
    const res = NextResponse.json({ success: true });
    res.cookies.set(cookie.name, cookie.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: cookie.maxAge,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
