"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead, MobileSortBar, type SortState } from "./sortable-head";

export type MemberRow = {
  uid: string;
  email: string;
  name: string;
  role: string;
  totalAttended: number;
  waiverStatus: string | null;
  banUntil: string | null; // ISO date string, or null when not banned
  banFlagType: "yellow" | "red" | null;
};

type SortKey =
  | "name"
  | "email"
  | "role"
  | "totalAttended"
  | "waiver"
  | "status";

const ROLE_RANK: Record<string, number> = {
  dev: 0,
  admin: 1,
  manager: 2,
  member: 3,
};

function compare(a: MemberRow, b: MemberRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "email":
      return a.email.localeCompare(b.email);
    case "role":
      return (ROLE_RANK[a.role] ?? 99) - (ROLE_RANK[b.role] ?? 99);
    case "totalAttended":
      return a.totalAttended - b.totalAttended;
    case "waiver": {
      // Has approved waiver = 0, other waiver status = 1, no waiver = 2
      const rank = (s: string | null) =>
        s === "approved" ? 0 : s ? 1 : 2;
      return rank(a.waiverStatus) - rank(b.waiverStatus);
    }
    case "status": {
      // Active = 0, yellow ban = 1, red ban = 2 — sorts least-restricted first.
      const rank = (m: MemberRow) =>
        !m.banUntil ? 0 : m.banFlagType === "red" ? 2 : 1;
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      // Same status → tiebreak by ban-until date (later = more restrictive)
      if (a.banUntil && b.banUntil) {
        return new Date(a.banUntil).getTime() - new Date(b.banUntil).getTime();
      }
      return 0;
    }
  }
}

export function MembersTable({ members }: { members: MemberRow[] }) {
  const t = useTranslations("dashboard.members");
  const [sort, setSort] = useState<SortState<SortKey>>({
    key: "name",
    dir: "asc",
  });

  const sorted = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      const r = compare(a, b, sort.key);
      return sort.dir === "asc" ? r : -r;
    });
    return copy;
  }, [members, sort]);

  return (
    <>
      {/* Mobile sort bar + cards */}
      <MobileSortBar
        options={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          { key: "totalAttended", label: t("totalAttended") },
          { key: "waiver", label: t("waiverStatus") },
          { key: "status", label: "Status" },
        ]}
        state={sort}
        onChange={setSort}
      />
      <div className="md:hidden space-y-3">
        {sorted.map((m) => {
          const href = `/dashboard/members/${m.uid}`;
          return (
            <Link key={m.email} href={href} prefetch={false}>
              <div className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm text-muted-foreground">{m.email}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <Badge
                      className={
                        m.role === "dev"
                          ? "bg-red-100 text-red-800 text-xs"
                          : m.role === "admin"
                          ? "bg-purple-100 text-purple-800 text-xs"
                          : m.role === "manager"
                          ? "bg-blue-100 text-blue-800 text-xs"
                          : "bg-gray-100 text-gray-800 text-xs"
                      }
                    >
                      {m.role}
                    </Badge>
                    {m.waiverStatus ? (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        {m.waiverStatus}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        No waiver
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {t("totalAttended")}: {m.totalAttended}
                  {m.banUntil ? (
                    <span className="text-red-600 ml-2">
                      Banned until {new Date(m.banUntil).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead sortKey="name" state={sort} onChange={setSort}>
              Name
            </SortableHead>
            <SortableHead sortKey="email" state={sort} onChange={setSort}>
              Email
            </SortableHead>
            <SortableHead sortKey="role" state={sort} onChange={setSort}>
              Role
            </SortableHead>
            <SortableHead sortKey="totalAttended" state={sort} onChange={setSort}>
              {t("totalAttended")}
            </SortableHead>
            <SortableHead sortKey="waiver" state={sort} onChange={setSort}>
              {t("waiverStatus")}
            </SortableHead>
            <SortableHead sortKey="status" state={sort} onChange={setSort}>
              Status
            </SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((m) => {
            const href = `/dashboard/members/${m.uid}`;
            return (
              <TableRow key={m.email} className="cursor-pointer hover:bg-gray-50">
                <TableCell className="p-0">
                  <Link href={href} prefetch={false} className="block px-4 py-2 font-medium">
                    {m.name}
                  </Link>
                </TableCell>
                <TableCell className="p-0">
                  <Link href={href} prefetch={false} className="block px-4 py-2">
                    {m.email}
                  </Link>
                </TableCell>
                <TableCell className="p-0">
                  <Link href={href} prefetch={false} className="block px-4 py-2">
                    <Badge
                      className={
                        m.role === "dev"
                          ? "bg-red-100 text-red-800"
                          : m.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : m.role === "manager"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {m.role}
                    </Badge>
                  </Link>
                </TableCell>
                <TableCell className="p-0">
                  <Link href={href} prefetch={false} className="block px-4 py-2">
                    {m.totalAttended}
                  </Link>
                </TableCell>
                <TableCell className="p-0">
                  <Link href={href} prefetch={false} className="block px-4 py-2">
                    {m.waiverStatus ? (
                      <Badge
                        className={
                          m.waiverStatus === "approved"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {m.waiverStatus}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">None</Badge>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="p-0">
                  <Link href={href} prefetch={false} className="block px-4 py-2">
                    {m.banUntil ? (
                      <Badge
                        className={
                          m.banFlagType === "red"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        Banned until {new Date(m.banUntil).toLocaleDateString()}
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    )}
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </>
  );
}
