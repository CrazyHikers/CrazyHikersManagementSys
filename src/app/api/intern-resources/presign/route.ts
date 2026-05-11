import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authorize } from "@/lib/permissions";
import { getSignedUploadUrl } from "@/lib/r2";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_KINDS = ["DOCUMENT", "VIDEO"] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function POST(request: NextRequest) {
  const session = await authorize("intern_resources:manage");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    filename?: unknown;
    mime?: unknown;
    sizeBytes?: unknown;
    kind?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const filename = typeof body.filename === "string" ? body.filename : "";
  const mime = typeof body.mime === "string" && body.mime ? body.mime : "application/octet-stream";
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : -1;
  const kindRaw = typeof body.kind === "string" ? body.kind : "";

  if (!filename) {
    return NextResponse.json({ error: "Filename required" }, { status: 400 });
  }
  if (!ALLOWED_KINDS.includes(kindRaw as Kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` },
      { status: 413 }
    );
  }

  const key = `intern-resources/${randomUUID()}-${sanitizeFilename(filename)}`;
  try {
    const uploadUrl = await getSignedUploadUrl(key, mime);
    return NextResponse.json({ uploadUrl, key });
  } catch (error) {
    console.error("Intern resource presign error:", error);
    return NextResponse.json({ error: "Could not create upload URL" }, { status: 500 });
  }
}
