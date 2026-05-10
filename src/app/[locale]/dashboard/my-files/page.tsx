import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FileText, Video } from "lucide-react";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function MyFilesPage() {
  const session = await auth();
  if (!session?.user || !can(session, "intern_resources:read")) {
    redirect("/dashboard");
  }

  const t = await getTranslations("dashboard.myFiles");

  const resources = await db.internResource.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {resources.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t("empty")}</p>
      ) : (
        <div className="space-y-3">
          {resources.map((r) => {
            const Icon = r.kind === "VIDEO" ? Video : FileText;
            const kindLabel =
              r.kind === "VIDEO" ? t("kind_VIDEO") : t("kind_DOCUMENT");
            return (
              <Card key={r.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="h-5 w-5 text-green-700 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {kindLabel} · {formatBytes(r.sizeBytes)}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`/api/intern-resources/${r.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        {t("download")}
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
