import { MessageSquareText, UserRoundCheck } from "lucide-react";
import type { PollNamedBallotDTO } from "@/lib/polls/types";

export function NamedBallots({
  ballots,
  title,
  empty,
  feedbackLabel,
}: {
  ballots: PollNamedBallotDTO[];
  title: string;
  empty: string;
  feedbackLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40">
      <header className="flex items-center gap-2 border-b border-amber-200 px-5 py-4 text-amber-950">
        <UserRoundCheck className="size-5" />
        <h2 className="font-semibold">{title}</h2>
      </header>
      {ballots.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-amber-900/65">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-amber-200/70">
          {ballots.map((ballot) => (
            <li key={ballot.email} className="grid gap-3 bg-white/70 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <p className="font-medium text-slate-950">{ballot.name}</p>
                <p className="text-xs text-slate-500">{ballot.email}</p>
                {ballot.feedback && (
                  <div className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
                    <MessageSquareText className="mt-1 size-4 shrink-0 text-amber-700" />
                    <p>
                      <span className="sr-only">{feedbackLabel}: </span>
                      {ballot.feedback}
                    </p>
                  </div>
                )}
              </div>
              <span
                className={
                  ballot.semanticKey === "reject"
                    ? "h-fit rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                    : "h-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                }
              >
                {ballot.optionLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
