import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PollEditor } from "@/components/dashboard/polls/poll-editor";

export default async function NewPollPage() {
  const [session, t] = await Promise.all([
    auth(),
    getTranslations("dashboard.pollAdmin"),
  ]);
  if (!session || !can(session, "polls.manage")) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          {t("createTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {t("createSubtitle")}
        </p>
      </header>
      <PollEditor copy={{
        title: t("editor.title"),
        description: t("editor.description"),
        kind: t("editor.kind"),
        kinds: {
          choice: t("editor.kindChoice"),
          approval: t("editor.kindApproval"),
        },
        scope: t("editor.scope"),
        scopes: {
          member_plus: t("scope.member_plus"),
          intern_manager_plus: t("scope.intern_manager_plus"),
          qualified_manager_plus: t("scope.qualified_manager_plus"),
          admin: t("scope.admin"),
        },
        deadline: t("editor.deadline"),
        anonymous: t("editor.anonymous"),
        anonymousHint: t("editor.anonymousHint"),
        feedbackPolicy: t("editor.feedbackPolicy"),
        feedbackPolicies: {
          disabled: t("editor.feedbackDisabled"),
          optional: t("editor.feedbackOptional"),
          required_on_reject: t("editor.feedbackRequiredOnReject"),
          required: t("editor.feedbackRequired"),
        },
        autoSettle: t("editor.autoSettle"),
        minimumParticipation: t("editor.minimumParticipation"),
        minimumApproval: t("editor.minimumApproval"),
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
      }} />
    </div>
  );
}
