import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { uploadFile } from "@/lib/r2";
import { randomUUID } from "crypto";

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
    return NextResponse.json({ version: null });
  }

  return NextResponse.json({
    version: template.version,
    filename: template.filename,
    uploadedAt: template.uploadedAt,
    uploadedBy: template.uploadedBy,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!can(session, "settings.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be under 10MB" },
        { status: 400 }
      );
    }

    const key = `waiver-templates/${randomUUID()}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to R2 first — if DB transaction fails, orphan file is harmless
    await uploadFile(key, buffer, "application/pdf");

    // Atomically: create template record + expire all active waivers
    const newTemplate = await db.$transaction(async (tx) => {
      const template = await tx.waiverTemplate.create({
        data: {
          r2Key: key,
          filename: file.name,
          uploadedBy: session.user!.email!,
        },
      });

      await tx.userWaiver.updateMany({
        where: { status: { in: ["approved", "expiring"] } },
        data: { status: "expired" },
      });

      return template;
    });

    return NextResponse.json({
      success: true,
      version: newTemplate.version,
    });
  } catch (error) {
    console.error("Waiver template upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
