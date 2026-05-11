import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorize } from "@/lib/permissions";
import { getSignedDownloadUrl } from "@/lib/r2";

// Returns a 302 redirect to a short-lived R2 signed URL instead of streaming
// the file through this function. Streaming would force the entire payload
// (potentially 100 MB) through Vercel's request budget; redirecting hands
// the transfer to R2 directly.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await authorize("intern_resources:read");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const resource = await db.internResource.findUnique({ where: { id } });
  if (!resource) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // r2Key looks like `intern-resources/<uuid>-<original-filename>`.
    // Strip the UUID prefix so the browser downloads under the original name.
    const last = resource.r2Key.split("/").pop() || "download";
    const filename = last.replace(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
      ""
    );
    // RFC 5987: ASCII fallback for old clients, percent-encoded UTF-8 for modern ones.
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
    const disposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
    const url = await getSignedDownloadUrl(resource.r2Key, 300, disposition);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Intern resource download error:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
