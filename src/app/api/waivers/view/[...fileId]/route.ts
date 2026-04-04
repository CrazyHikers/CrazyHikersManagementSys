import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await params;
  // fileId is a catch-all segment array, e.g. ["waivers", "abc123.pdf"]
  const key = fileId.join("/");

  try {
    const url = await getSignedDownloadUrl(key, 300); // 5 minute expiry
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Waiver view error:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
