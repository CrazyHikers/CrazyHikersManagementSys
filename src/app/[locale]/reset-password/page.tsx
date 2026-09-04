import { CircleX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { ResetPasswordForm } from "./reset-password-form";

const PWRESET_PREFIX = "pwreset:";

type SearchParams = Promise<{
  token?: string | string[];
  email?: string | string[];
}>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("auth");
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const email = typeof query.email === "string" ? query.email : "";

  const record = token && email
    ? await db.verificationToken.findUnique({
        where: {
          identifier_token: {
            identifier: `${PWRESET_PREFIX}${email}`,
            token,
          },
        },
        select: { expires: true },
      })
    : null;
  const linkInvalid = !record || record.expires <= new Date();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.jpg" alt="Crazy Hikers" className="mx-auto mb-2 h-20" />
          {linkInvalid ? (
            <>
              <CircleX className="mx-auto mb-2 size-12 text-red-600" aria-hidden="true" />
              <CardTitle role="heading" aria-level={1}>
                {t("resetLinkInvalidTitle")}
              </CardTitle>
              <CardDescription>{t("resetLinkInvalid")}</CardDescription>
            </>
          ) : (
            <>
              <CardTitle>{t("resetPasswordTitle")}</CardTitle>
              <CardDescription>{t("resetPasswordDescription")}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {linkInvalid ? (
            <Link
              href="/signin"
              className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-medium text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              {t("backToSignIn")}
            </Link>
          ) : (
            <ResetPasswordForm token={token} email={email} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
