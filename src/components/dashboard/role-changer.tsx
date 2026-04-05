"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const roles = ["member", "manager", "admin", "dev"] as const;

const roleLabels: Record<string, string> = {
  dev: "Dev",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
};

const roleColors: Record<string, string> = {
  dev: "bg-red-600 hover:bg-red-700 text-white",
  admin: "bg-purple-600 hover:bg-purple-700 text-white",
  manager: "bg-blue-600 hover:bg-blue-700 text-white",
  member: "bg-gray-600 hover:bg-gray-700 text-white",
};

export function RoleChanger({
  userEmail,
  currentRole,
}: {
  userEmail: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);

  async function handleChange(newRole: string) {
    if (newRole === currentRole) return;
    setChanging(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userEmail)}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success(`Role changed to ${roleLabels[newRole]}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setChanging(false);
    }
  }

  return (
    <Card className="mb-6 border-red-200">
      <CardHeader>
        <CardTitle className="text-lg text-red-700">Change Role (Dev)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 flex-wrap">
          {roles.map((role) => (
            <Button
              key={role}
              variant={role === currentRole ? "default" : "outline"}
              size="sm"
              className={role === currentRole ? roleColors[role] : ""}
              disabled={role === currentRole || changing}
              onClick={() => handleChange(role)}
            >
              {roleLabels[role]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
