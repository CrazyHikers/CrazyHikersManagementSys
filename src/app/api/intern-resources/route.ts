import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorize } from "@/lib/permissions";
import { headObject, deleteFile } from "@/lib/r2";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_KINDS = ["DOCUMENT", "VIDEO"] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

export async function POST(request: NextRequest) {
  const session = await authorize("intern_resources:manage");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { key?: unknown; title?: unknown; kind?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const kindRaw = typeof body.kind === "string" ? body.kind : "";

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!ALLOWED_KINDS.includes(kindRaw as Kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  const kind = kindRaw as Kind;

  // Only accept keys under the prefix we issue presigns for. Prevents an
  // admin from attaching the DB row to an arbitrary path in the bucket.
  if (!key.startsWith("intern-resources/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const head = await headObject(key);
  if (!head) {
    return NextResponse.json({ error: "File not uploaded" }, { status: 400 });
  }
  if (head.sizeBytes > MAX_UPLOAD_BYTES) {
    await deleteFile(key).catch(() => {});
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  try {
    const resource = await db.internResource.create({
      data: {
        title,
        r2Key: key,
        kind,
        mime: head.contentType,
        sizeBytes: head.sizeBytes,
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
    console.error("Intern resource confirm error:", error);
    return NextResponse.json({ error: "Could not save file record" }, { status: 500 });
  }
}
