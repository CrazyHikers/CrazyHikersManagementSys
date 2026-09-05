import { NextResponse } from "next/server";
import { getInboundSignupStatus } from "@/lib/inbound-signup";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (
      !body ||
      typeof body.requestCode !== "string" ||
      typeof body.browserToken !== "string"
    ) {
      return NextResponse.json({ status: "not_found" }, { status: 400 });
    }

    const result = await getInboundSignupStatus(
      body.requestCode.trim().toUpperCase(),
      body.browserToken,
    );
    return NextResponse.json(result, {
      status: result.status === "not_found" ? 404 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[INBOUND_SIGNUP_STATUS] error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
