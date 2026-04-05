import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { RoleChanger } from "@/components/dashboard/role-changer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const roleBadgeColors: Record<string, string> = {
  dev: "bg-red-100 text-red-800",
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  member: "bg-gray-100 text-gray-800",
};

const waiverStatusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  expiring: "bg-orange-100 text-orange-800",
  expired: "bg-gray-100 text-gray-800",
};

const flagColors: Record<string, string> = {
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "members.viewDetail")) {
    redirect("/dashboard");
  }
  const isAdmin = can(session, "members.list");
  const isDev = can(session, "users.changeRole");

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);

  const user = await db.user.findUnique({
    where: { email: decodedEmail },
    include: {
      managerProfile: true,
      waivers: { orderBy: { signedAt: "desc" } },
      registrations: {
        include: { activity: true },
        orderBy: { registeredAt: "desc" },
      },
      flags: {
        orderBy: { issuedAt: "desc" },
        include: { activity: true, issuer: true },
      },
    },
  });

  if (!user) notFound();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <Badge className={roleBadgeColors[user.role]}>{user.role}</Badge>
      </div>

      {/* Dev: Role changer */}
      {isDev && (
        <RoleChanger userEmail={user.email} currentRole={user.role} />
      )}

      {/* Basic info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Basic Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Role: </span>
              <span className="font-medium">{user.role}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Joined: </span>
              <span className="font-medium">{user.createdAt.toLocaleDateString()}</span>
            </div>
            {user.managerProfile && (
              <>
                <div>
                  <span className="text-muted-foreground">Tag: </span>
                  <span className="font-medium">{user.managerProfile.tag}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge className={user.managerProfile.intern ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
                    {user.managerProfile.intern ? "Intern" : "Qualified"}
                  </Badge>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Waivers */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Waivers ({user.waivers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.waivers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No waivers submitted</p>
          ) : (
            <div className="space-y-2">
              {user.waivers.map((w) => (
                <div key={w.fileId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Submitted: </span>
                    {w.signedAt.toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={waiverStatusColors[w.status] || ""}>
                      {w.status}
                    </Badge>
                    <a
                      href={`/api/waivers/view/${w.fileId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-600 hover:underline"
                    >
                      View
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activities */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Activity History ({user.registrations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.registrations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No activity participation</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.registrations.map((r) => (
                  <TableRow key={r.activityId}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/activity-view/${r.activityId}`} className="hover:underline text-green-700">
                        {r.activity.title}
                      </Link>
                    </TableCell>
                    <TableCell>{r.activity.date.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={
                        r.status === "attended" ? "bg-green-100 text-green-800" :
                        r.status === "absent" ? "bg-red-100 text-red-800" :
                        r.status === "registration_confirmed" ? "bg-blue-100 text-blue-800" :
                        "bg-gray-100 text-gray-800"
                      }>
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Flags ({user.flags.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.flags.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No flags</p>
          ) : (
            <div className="space-y-3">
              {user.flags.map((f) => (
                <div key={f.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={flagColors[f.flagType]}>{f.flagType}</Badge>
                    <span className="text-sm text-muted-foreground">
                      from {f.activity.title}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Issued by {f.issuer.name} on {f.issuedAt.toLocaleDateString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Ban until: {f.banUntil.toLocaleDateString()}
                    {f.banUntil > new Date() ? (
                      <Badge className="bg-red-100 text-red-800 ml-2 text-xs">Active</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800 ml-2 text-xs">Expired</Badge>
                    )}
                  </div>
                  {f.reason && (
                    <div className="text-sm mt-1">Reason: {f.reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
