import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock3, ShieldCheck, UsersRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { can, getUserRole } from "@/lib/permissions";
import { listPolls, prismaPollDatabase } from "@/lib/polls/service";
import type { PollListItemDTO, UserRole } from "@/lib/polls/types";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PollStatusBadge } from "@/components/dashboard/polls/poll-status-badge";

function rank(poll: PollListItemDTO) {
  if (poll.status === "open" && !poll.hasVoted) return 0;
  if (poll.status === "open") return 1;
  if (poll.status === "draft") return 2;
  return 3;
}

export default async function PollsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [session, t] = await Promise.all([
    auth(),
    getTranslations("dashboard.polls"),
  ]);
  const email = session?.user?.email;
  if (!email) return null;
  const role = getUserRole(session) as UserRole;
  const polls = (
    await listPolls(prismaPollDatabase, { email, role })
  ).sort((left, right) => rank(left) - rank(right));
  const isAdmin = can(session, "polls.manage");
  const formatDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const statuses = {
    draft: t("status.draft"),
    open: t("status.open"),
    closed: t("status.closed"),
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-emerald-950 px-6 py-8 text-white shadow-sm sm:px-9">
        <div className="absolute -right-12 -top-16 size-52 rounded-full border border-white/10" />
        <div className="absolute -bottom-24 right-20 size-44 rounded-full bg-lime-300/10" />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-lime-300">
            {t("eyebrow")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/75 sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </header>

      {polls.length === 0 ? (
        <Card className="border-dashed bg-white/70 py-10 text-center">
          <CardContent>
            <ShieldCheck className="mx-auto mb-3 size-8 text-emerald-700" />
            <p className="font-medium text-slate-800">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {polls.map((poll) => (
            <Card
              key={poll.id}
              className="group overflow-hidden border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <PollStatusBadge status={poll.status} labels={statuses} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {t(`scope.${poll.scope}`)}
                  </span>
                  {poll.status === "open" && poll.hasVoted && (
                    <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white">
                      {t("voted")}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  {poll.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                  {poll.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-3.5" />
                    {formatDate.format(new Date(poll.deadline))}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <UsersRound className="size-3.5" />
                    {t("participantCount", { count: poll.participantCount })}
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <Link
                    href={`/dashboard/polls/${poll.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
                  >
                    {poll.status === "open" && !poll.hasVoted
                      ? t("voteNow")
                      : t("view")}
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </Link>
                  {isAdmin && (
                    <Link
                      href={`/dashboard/polls/${poll.id}/manage`}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                      {t("manage")}
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
