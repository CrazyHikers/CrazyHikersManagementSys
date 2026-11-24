"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react";

function RefreshPermissions() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const previousPermissions = useRef<string | undefined>(undefined);
  const user = session?.user as {
    email?: string | null;
    role?: string;
    isIntern?: boolean;
  } | undefined;
  const permissions = JSON.stringify([user?.email, user?.role, user?.isIntern]);

  useEffect(() => {
    if (status === "loading") return;
    const previous = previousPermissions.current;
    previousPermissions.current = permissions;
    // Refresh server-rendered controls (e.g. the approval button), too.
    // Ordinary session polling must not repeatedly refresh the page.
    if (previous !== undefined && previous !== permissions) router.refresh();
  }, [permissions, status, router]);

  return null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider refetchInterval={30} refetchWhenOffline={false}>
      <RefreshPermissions />
      {children}
    </NextAuthSessionProvider>
  );
}
