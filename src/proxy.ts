import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip i18n for API routes and internal Next.js routes
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check auth for admin routes
  const isAdminRoute =
    pathname.includes("/admin") || pathname.match(/^\/(en|zh)\/admin/);

  if (isAdminRoute) {
    // Auth check will be handled by the admin layout server component
    // The proxy just handles locale routing
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
