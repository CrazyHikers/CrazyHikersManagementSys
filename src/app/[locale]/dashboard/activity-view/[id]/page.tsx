import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth-utils";
import { getPublicUrl } from "@/lib/r2";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  closed: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

const regStatusColors: Record<string, string> = {
  registered: "bg-gray-100 text-gray-800",
  registration_confirmed: "bg-blue-100 text-blue-800",
  attended: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
};

export default async function ActivityViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user ? hasRole(session, "admin") : false;

  const activity = await db.activity.findUnique({
    where: { id },
    include: {
      activityManagers: {
        where: { status: "confirmed" },
        include: { user: true },
      },
      registrations: {
        include: { user: true },
        orderBy: { registeredAt: "asc" },
      },
      _count: {
        select: {
          registrations: {
            where: { status: { in: ["registered", "registration_confirmed", "attended"] } },
          },
        },
      },
    },
  });

  if (!activity) notFound();

  const managers = activity.activityManagers.filter((am) => am.role === "manager");
  const comanagers = activity.activityManagers.filter((am) => am.role === "comanager");

  return (
    <div>
      <div className="flex items-start gap-3 mb-6">
        <h1 className="text-2xl font-bold">{activity.title}</h1>
        <Badge className={statusColors[activity.status]}>{activity.status}</Badge>
      </div>

      {activity.coverImgId && (
        <div className="rounded-lg overflow-hidden mb-6 max-h-64 bg-gray-100">
          <img
            src={getPublicUrl(activity.coverImgId)}
            alt={activity.title}
            className="w-full h-full max-h-64 object-contain"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Activity Date</div>
            <div className="font-medium">{activity.date.toLocaleDateString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Deadline</div>
            <div className="font-medium">{activity.deadline.toLocaleDateString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Registrations</div>
            <div className="font-medium">
              {activity._count.registrations}
              {activity.capacity > 0 && ` / ${activity.capacity}`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Max Registration</div>
            <div className="font-medium">{activity.maximumRegistration || "Unlimited"}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{activity.description}</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Managers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {managers.map((am) => (
              <div key={am.userEmail} className="flex items-center gap-2">
                <Badge>Manager</Badge>
                <span>{am.user.name}</span>
                <span className="text-sm text-muted-foreground">({am.user.email})</span>
              </div>
            ))}
            {comanagers.map((am) => (
              <div key={am.userEmail} className="flex items-center gap-2">
                <Badge variant="secondary">Co-manager</Badge>
                <span>{am.user.name}</span>
                <span className="text-sm text-muted-foreground">({am.user.email})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Participants list — admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Participants ({activity.registrations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.registrations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No participants</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.registrations.map((r) => (
                    <TableRow key={r.userEmail}>
                      <TableCell>
                        <Link href={`/dashboard/members/${encodeURIComponent(r.userEmail)}`} className="font-medium hover:underline text-green-700">
                          {r.user.name}
                        </Link>
                      </TableCell>
                      <TableCell>{r.user.email}</TableCell>
                      <TableCell>
                        <Badge className={regStatusColors[r.status] || ""}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>{r.registeredAt.toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
