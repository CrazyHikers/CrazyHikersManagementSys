import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, LockKeyhole, UserRoundCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { can, getUserRole } from "@/lib/permissions";
import {
  getPollDetail,
  listParticipants,
  prismaPollDatabase,
} from "@/lib/polls/service";
import type { UserRole } from "@/lib/polls/types";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PollAdminActions } from "@/components/dashboard/polls/poll-admin-actions";
import { PollEditor } from "@/components/dashboard/polls/poll-editor";
import { PollResults } from "@/components/dashboard/polls/poll-results";
import { PollStatusBadge } from "@/components/dashboard/polls/poll-status-badge";

export default async function ManagePollPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [session, t, publicT] = await Promise.all([
    auth(),
    getTranslations("dashboard.pollAdmin"),
    getTranslations("dashboard.polls"),
  ]);
  if (!session?.user?.email || !can(session, "polls.manage")) notFound();
  const actor = {
    email: session.user.email,
    role: getUserRole(session) as UserRole,
      isIntern:
        (session.user as { isIntern?: boolean }).isIntern === true,
  };

  let poll;
  let participants;
  try {
    [poll, participants] = await Promise.all([
      getPollDetail(prismaPollDatabase, actor, id),
      listParticipants(prismaPollDatabase, actor, id),
    ]);
  } catch {
    notFound();
  }
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const statuses = {
    draft: publicT("status.draft"),
    open: publicT("status.open"),
    closed: publicT("status.closed"),
  };
  const editorCopy = {
    title: t("editor.title"),
    description: t("editor.description"),
    scope: t("editor.scope"),
    scopes: {
      member_plus: t("scope.member_plus"),
      intern_manager_plus: t("scope.intern_manager_plus"),
      qualified_manager_plus: t("scope.qualified_manager_plus"),
      admin: t("scope.admin"),
    },
    deadline: t("editor.deadline"),
    options: t("editor.options"),
    option: t("editor.option", { number: "{number}" }),
    addOption: t("editor.addOption"),
    removeOption: t("editor.removeOption", { number: "{number}" }),
    approveReject: t("editor.approveReject"),
    approve: t("editor.approve"),
    reject: t("editor.reject"),
    allowOther: t("editor.allowOther"),
    otherHint: t("editor.otherHint"),
    save: t("editor.save"),
    saving: t("editor.saving"),
    saved: t("editor.saved"),
    error: t("editor.error"),
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/dashboard/polls/${id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-800"
        >
          <ArrowLeft className="size-4" />
          {t("viewPoll")}
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <PollStatusBadge status={poll.status} labels={statuses} />
              <span className="text-xs font-medium text-slate-500">
                {t(`scope.${poll.scope}`)}
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {poll.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {publicT("closes", {
                date: dateFormat.format(new Date(poll.deadline)),
              })}
            </p>
          </div>
          <PollAdminActions
            pollId={poll.id}
            status={poll.status}
            deadline={poll.deadline}
            copy={{
              publish: t("actions.publish"),
              publishConfirm: t("actions.publishConfirm"),
              published: t("actions.published"),
              close: t("actions.close"),
              closeConfirm: t("actions.closeConfirm"),
              closed: t("actions.closed"),
              extend: t("actions.extend"),
              extended: t("actions.extended"),
              working: t("actions.working"),
              error: t("actions.error"),
            }}
          />
        </div>
      </div>

      {poll.status === "draft" && (
        <PollEditor copy={editorCopy} initial={poll} />
      )}

      {poll.status === "closed" && poll.results && (
        <Card>
          <CardHeader>
            <CardTitle>{publicT("resultsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PollResults
              results={poll.results}
              otherLabel={publicT("vote.other")}
              votesLabel={(count) => publicT("votes", { count })}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRoundCheck className="size-5 text-emerald-700" />
            {t("participantsTitle", { count: participants.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-emerald-700" />
            {t("participantsPrivacy")}
          </div>
          {participants.length === 0 ? (
            <p className="py-5 text-center text-sm text-slate-500">
              {t("noParticipants")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {participants.map((participant) => (
                <li
                  key={participant.email}
                  className="flex flex-col justify-between gap-1 py-3 text-sm sm:flex-row sm:items-center"
                >
                  <span>
                    <span className="font-medium text-slate-900">{participant.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{participant.email}</span>
                  </span>
                  <time className="text-xs text-slate-500">
                    {dateFormat.format(new Date(participant.votedAt))}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
