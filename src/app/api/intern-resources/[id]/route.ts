import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorize } from "@/lib/permissions";
import { deleteFile } from "@/lib/r2";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await authorize("intern_resources:manage");
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const resource = await db.internResource.findUnique({ where: { id } });
  if (!resource) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteFile(resource.r2Key);
  } catch (error) {
    console.error("Intern resource R2 delete error:", error);
    return NextResponse.json({ error: "Storage delete failed" }, { status: 500 });
  }

  await db.internResource.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
