import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = await req.json();

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.user.update({
      where: { email: session.user.email },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SET-PASSWORD] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
