import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { FileText, Video } from "lucide-react";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { formatBytes } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InternResourcesUpload } from "@/components/dashboard/intern-resources-upload";
import { InternResourceDelete } from "@/components/dashboard/intern-resource-delete";

export default async function InternResourcesPage() {
  const session = await auth();
  if (!session?.user || !can(session, "intern_resources:manage")) {
    redirect("/dashboard");
  }

  const t = await getTranslations("dashboard.internResources");
  const locale = await getLocale();

  const resources = await db.internResource.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { name: true, email: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      <InternResourcesUpload />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t("listTitle")} ({resources.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("empty")}</p>
          ) : (
            <div className="space-y-3">
              {resources.map((r) => {
                const Icon = r.kind === "VIDEO" ? Video : FileText;
                const kindLabel =
                  r.kind === "VIDEO" ? t("kind_VIDEO") : t("kind_DOCUMENT");
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 border rounded-md p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="h-5 w-5 text-green-700 shrink-0" />
                      <div className="min-w-0 text-sm">
                        <div className="font-medium truncate">{r.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {kindLabel} · {formatBytes(r.sizeBytes)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("uploadedBy")}: {r.uploadedBy.name || r.uploadedBy.email} ·{" "}
                          {t("uploadedAt")}: {r.createdAt.toLocaleString(locale)}
                        </div>
                      </div>
                    </div>
                    <InternResourceDelete id={r.id} title={r.title} />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
