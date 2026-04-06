import { NextResponse } from "next/server";

// Waiver approval has been replaced by in-app e-signing (auto-approved).
// This endpoint is no longer used.
export async function POST() {
  return NextResponse.json({ error: "Waiver approval is no longer supported. Waivers are now e-signed and auto-approved." }, { status: 410 });
}
