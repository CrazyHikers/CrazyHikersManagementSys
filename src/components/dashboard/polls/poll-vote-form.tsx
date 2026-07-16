"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PollOptionDTO } from "@/lib/polls/types";

type VoteCopy = {
  choose: string;
  other: string;
  otherPlaceholder: string;
  review: string;
  confirmTitle: string;
  confirmBody: string;
  cancel: string;
  confirm: string;
  submitting: string;
  success: string;
  error: string;
};

export function PollVoteForm({
  pollId,
  options,
  allowOther,
  copy,
}: {
  pollId: string;
  options: PollOptionDTO[];
  allowOther: boolean;
  copy: VoteCopy;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | "other" | null>(null);
  const [otherText, setOtherText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedLabel =
    selection === "other"
      ? otherText.trim()
      : options.find((option) => option.id === selection)?.label;
  const ready = !!selection && (selection !== "other" || !!otherText.trim());

  async function submitVote() {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const body =
        selection === "other"
          ? { otherText: otherText.trim() }
          : { optionId: selection };
      const response = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(copy.error);
      toast.success(copy.success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.error);
      setSubmitting(false);
    }
  }

  if (reviewing) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <h3 className="font-semibold text-emerald-950">{copy.confirmTitle}</h3>
            <p className="mt-1 text-sm text-emerald-900/70">{copy.confirmBody}</p>
          </div>
        </div>
        <div className="my-5 rounded-xl bg-white p-4 font-medium text-slate-900 ring-1 ring-emerald-950/10">
          {selectedLabel}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => setReviewing(false)}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            disabled={submitting}
            onClick={submitVote}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            <CheckCircle2 className="size-4" />
            {submitting ? copy.submitting : copy.confirm}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) setReviewing(true);
      }}
      className="space-y-4"
    >
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-slate-700">
          {copy.choose}
        </legend>
        {options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 has-checked:border-emerald-600 has-checked:bg-emerald-50/60"
          >
            <input
              type="radio"
              name="poll-option"
              value={option.id}
              checked={selection === option.id}
              onChange={() => setSelection(option.id)}
              className="mt-0.5 size-4 accent-emerald-700"
            />
            <span className="text-sm font-medium text-slate-900">{option.label}</span>
          </label>
        ))}
        {allowOther && (
          <label className="block cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 has-checked:border-emerald-600 has-checked:bg-emerald-50/60">
            <span className="flex items-center gap-3 text-sm font-medium text-slate-900">
              <input
                type="radio"
                name="poll-option"
                value="other"
                checked={selection === "other"}
                onChange={() => setSelection("other")}
                className="size-4 accent-emerald-700"
              />
              {copy.other}
            </span>
            {selection === "other" && (
              <Textarea
                value={otherText}
                onChange={(event) => setOtherText(event.target.value)}
                placeholder={copy.otherPlaceholder}
                maxLength={500}
                rows={3}
                className="mt-3 bg-white"
              />
            )}
          </label>
        )}
      </fieldset>
      <Button
        type="submit"
        disabled={!ready}
        className="w-full bg-emerald-700 hover:bg-emerald-800 sm:w-auto"
      >
        {copy.review}
      </Button>
    </form>
  );
}
