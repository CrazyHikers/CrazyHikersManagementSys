import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { authorize } from "@/lib/permissions";
import { uploadFile } from "@/lib/r2";

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

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const kindRaw = formData.get("kind") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!kindRaw || !ALLOWED_KINDS.includes(kindRaw as Kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    const kind = kindRaw as Kind;

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    const r2Key = `intern-resources/${randomUUID()}-${sanitizeFilename(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";

    await uploadFile(r2Key, buffer, mime);

    const resource = await db.internResource.create({
      data: {
        title,
        r2Key,
        kind,
        mime,
        sizeBytes: file.size,
        uploadedById: session.user!.email!,
      },
    });

    return NextResponse.json({
      id: resource.id,
      title: resource.title,
      kind: resource.kind,
      sizeBytes: resource.sizeBytes,
    });
  } catch (error) {
    console.error("Intern resource upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
