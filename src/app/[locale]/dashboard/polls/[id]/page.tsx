import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Clock3, LockKeyhole, Settings2, UsersRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { can, getUserRole } from "@/lib/permissions";
import { getPollDetail, prismaPollDatabase } from "@/lib/polls/service";
import type { UserRole } from "@/lib/polls/types";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PollResults } from "@/components/dashboard/polls/poll-results";
import { PollStatusBadge } from "@/components/dashboard/polls/poll-status-badge";
import { PollVoteForm } from "@/components/dashboard/polls/poll-vote-form";

export default async function PollDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [session, t] = await Promise.all([
    auth(),
    getTranslations("dashboard.polls"),
  ]);
  const email = session?.user?.email;
  if (!email) return null;

  let poll;
  try {
    poll = await getPollDetail(prismaPollDatabase, {
      email,
      role: getUserRole(session) as UserRole,
      isIntern:
        (session.user as { isIntern?: boolean }).isIntern === true,
    }, id);
  } catch {
    notFound();
  }
  const isAdmin = can(session, "polls.manage");
  const formatDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  });
  const statuses = {
    draft: t("status.draft"),
    open: t("status.open"),
    closed: t("status.closed"),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/polls"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-800"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        {isAdmin && (
          <Button variant="outline" size="sm" render={<Link href={`/dashboard/polls/${id}/manage`} />}>
            <Settings2 className="size-4" />
            {t("manage")}
          </Button>
        )}
      </div>

      <article className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-green-800 px-6 py-8 text-white sm:px-9 sm:py-10">
          <div className="mb-4 flex flex-wrap gap-2">
            <PollStatusBadge status={poll.status} labels={statuses} />
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-50 ring-1 ring-white/15">
              {poll.scope
                ? t(`scope.${poll.scope}`)
                : t("scope.explicit_list")}
            </span>
            <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-200/20">
              {poll.anonymous
                ? t("identityAnonymous")
                : t("identityNamed")}
            </span>
            {poll.creatorType === "system" && (
              <span className="rounded-full bg-lime-300/15 px-3 py-1 text-xs font-semibold text-lime-100 ring-1 ring-lime-200/20">
                {t("creatorSystem")}
              </span>
            )}
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {poll.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-emerald-50/75">
            <span className="flex items-center gap-2">
              <Clock3 className="size-4" />
              {t("closes", { date: formatDate.format(new Date(poll.deadline)) })}
            </span>
            <span className="flex items-center gap-2">
              <UsersRound className="size-4" />
              {t("participantCount", { count: poll.participantCount })}
            </span>
          </div>
        </div>
        <div className="px-6 py-7 sm:px-9">
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
            {poll.description}
          </p>
        </div>
      </article>

      {poll.promotion && (
        <Card className="overflow-hidden border-amber-200 bg-amber-50/50 shadow-sm">
          <CardHeader className="border-b border-amber-200/70">
            <CardTitle className="text-amber-950">
              {t("promotion.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <p className="text-lg font-semibold text-slate-950">
                  {poll.promotion.candidateName}
                </p>
                <p className="text-sm text-slate-500">
                  {poll.promotion.candidateEmail}
                </p>
              </div>
              <span className="h-fit rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-950">
                {t(`promotion.type.${poll.promotion.type}`)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                ["attended", poll.promotion.stats.attendedCount],
                ["managed", poll.promotion.stats.managedCount],
                ["comanaged", poll.promotion.stats.comanagedCount],
              ] as const).map(([label, count]) => (
                <div key={label} className="rounded-xl bg-white p-3 text-center ring-1 ring-amber-200">
                  <p className="text-xl font-semibold tabular-nums text-amber-950">
                    {count}
                  </p>
                  <p className="mt-1 text-xs text-amber-900/65">
                    {t(`promotion.stats.${label}`)}
                  </p>
                </div>
              ))}
            </div>
            {poll.promotion.applicationText && (
              <div className="rounded-xl bg-white p-4 ring-1 ring-amber-200">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
                  {t("promotion.application")}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {poll.promotion.applicationText}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>
            {poll.status === "closed" ? t("resultsTitle") : t("ballotTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {poll.status === "draft" && (
            <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
              {t("draftHint")}
            </p>
          )}
          {poll.status === "open" && poll.hasVoted && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h2 className="font-semibold text-emerald-950">{t("voteRecorded")}</h2>
              <p className="mt-1 text-sm text-emerald-900/70">{t("voteRecordedHint")}</p>
            </div>
          )}
          {poll.status === "open" && !poll.hasVoted && (
            <PollVoteForm
              pollId={poll.id}
              options={poll.options}
              allowOther={poll.allowOther}
              anonymous={poll.anonymous}
              feedbackPolicy={poll.feedbackPolicy}
              copy={{
                choose: t("vote.choose"),
                identityAnonymous: t("vote.identityAnonymous"),
                identityNamed: t("vote.identityNamed"),
                feedback: t("vote.feedback"),
                feedbackPlaceholder: t("vote.feedbackPlaceholder"),
                other: t("vote.other"),
                otherPlaceholder: t("vote.otherPlaceholder"),
                review: t("vote.review"),
                confirmTitleAnonymous: t("vote.confirmTitleAnonymous"),
                confirmTitleNamed: t("vote.confirmTitleNamed"),
                confirmBody: t("vote.confirmBody"),
                cancel: t("vote.cancel"),
                confirmAnonymous: t("vote.confirmAnonymous"),
                confirmNamed: t("vote.confirmNamed"),
                submitting: t("vote.submitting"),
                success: t("vote.success"),
                error: t("vote.error"),
              }}
            />
          )}
          {poll.status === "closed" && poll.results && (
            <PollResults
              results={poll.results}
              otherLabel={t("vote.other")}
              votesLabel={(count) => t("votes", { count })}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-600">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-emerald-700" />
        <p>{t(poll.anonymous ? "privacy" : "privacyNamed")}</p>
      </div>
    </div>
  );
}
