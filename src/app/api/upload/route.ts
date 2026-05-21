import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/r2";
import { randomUUID } from "crypto";
import { getSetting } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";

// MIME allowlist. Every caller of this route uploads images: activity
// cover/hero/thumbnail, QR codes, and matchmaking_520 photos. PDFs and
// other doc types go through R2 presigned URLs (/api/intern-resources/
// presign), not this endpoint. Keeping this list tight prevents the
// "I'll just upload a 50MB .mov" cost-attack vector.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
// Map back to a sane extension so we don't trust client-supplied filenames.
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Per-user rate limit. 30/hour is generous for a manager editing an
  // activity (cover + hero + thumbnail + QR ≈ 4 uploads per session,
  // a few sessions of edits per hour) but cuts off a compromised
  // account being used to burn R2 storage / Vercel bandwidth.
  const { allowed, resetIn } = await rateLimit(`upload:${session.user.email}`, {
    maxAttempts: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(resetIn / 1000)) },
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "uploads";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // MIME allowlist BEFORE size check — cheaper to reject bad types
    // immediately. file.type is browser-supplied and spoofable, but
    // R2 also stores it and our renderers serve <img> tags, so a
    // misdeclared type won't execute as anything dangerous. The real
    // value here is rejecting non-image categories outright.
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type "${file.type || "unknown"}". Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}.`,
        },
        { status: 415 }
      );
    }

    // Check file size against configurable limit
    const maxSizeMb = await getSetting("max_upload_size_mb");
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSizeMb} MB.` },
        { status: 413 }
      );
    }

    // Pick the extension from the validated MIME type rather than
    // trusting the client filename — prevents path traversal via crafted
    // filenames and keeps R2 keys consistent.
    const ext = MIME_TO_EXT[file.type] ?? "bin";
    const key = `${folder}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const url = await uploadFile(key, buffer, file.type);

    return NextResponse.json({ key, url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
