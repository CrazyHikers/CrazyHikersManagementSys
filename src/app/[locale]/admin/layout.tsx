import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminNav } from "@/components/admin/nav";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/admin/signin`);
  }

  const managerName =
    (session.user as Record<string, unknown>).managerName as string ||
    session.user.name ||
    session.user.email ||
    "Manager";

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminNav managerName={managerName} />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
