import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyPage() {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="text-4xl mb-2">📧</div>
          <CardTitle>{t("checkEmail")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {t("signInDescription")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
