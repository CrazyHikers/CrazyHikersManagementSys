import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createFeedbackIssue, type FeedbackType } from "@/lib/github";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4000;
const ALLOWED_TYPES: FeedbackType[] = ["bug", "feature", "other"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { allowed } = await rateLimit(`feedback:${session.user.email}`, {
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  let body: { type?: string; title?: string; description?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type as FeedbackType;
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  if (!title || title.length > MAX_TITLE) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }
  if (!description || description.length > MAX_DESCRIPTION) {
    return NextResponse.json({ error: "Invalid description" }, { status: 400 });
  }

  const locale = body.locale === "en" ? "en" : "zh";
  const issueBody = [
    description,
    "",
    "---",
    "*Submitted via in-app feedback form*",
    `- User: ${session.user.email}`,
    `- Locale: ${locale}`,
    `- Submitted at: ${new Date().toISOString()}`,
  ].join("\n");

  try {
    const issue = await createFeedbackIssue({ title, body: issueBody, type });
    console.log(
      `[FEEDBACK] Created issue #${issue.number} by ${session.user.email} (${type}): ${issue.url}`
    );
    return NextResponse.json({ ok: true, url: issue.url, number: issue.number });
  } catch (err) {
    console.error("[FEEDBACK] GitHub issue creation failed:", err);
    return NextResponse.json({ error: "Failed to submit" }, { status: 502 });
  }
}
