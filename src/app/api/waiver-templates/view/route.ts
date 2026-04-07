import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignedDownloadUrl } from "@/lib/r2";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const versionParam = searchParams.get("version");

  let template;
  if (versionParam) {
    const version = parseInt(versionParam, 10);
    if (isNaN(version)) {
      return NextResponse.json({ error: "Invalid version" }, { status: 400 });
    }
    template = await db.waiverTemplate.findUnique({ where: { version } });
  } else {
    template = await db.waiverTemplate.findFirst({
      orderBy: { version: "desc" },
    });
  }

  if (!template) {
    // Fallback to static PDF for legacy waivers signed before template versioning
    const baseUrl = new URL(request.url).origin;
    return NextResponse.redirect(`${baseUrl}/waiver-template.pdf`);
  }

  try {
    const url = await getSignedDownloadUrl(template.r2Key, 300);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Waiver template view error:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
