import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserRole } from "@/lib/permissions";
import { DashboardNav } from "@/components/dashboard/nav";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/signin`);
  }

  const role = getUserRole(session);
  const userName =
    session.user.name ||
    session.user.email ||
    "User";

  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardNav role={role} userName={userName} />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
