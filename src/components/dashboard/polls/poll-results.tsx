import type { PollResultsDTO } from "@/lib/polls/types";

export function PollResults({
  results,
  otherLabel,
  votesLabel,
}: {
  results: PollResultsDTO;
  otherLabel: string;
  votesLabel: (count: number) => string;
}) {
  const rows = [
    ...results.options,
    ...(results.other.count > 0
      ? [
          {
            id: "other",
            label: otherLabel,
            count: results.other.count,
            percentage: results.other.percentage,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      {rows.map((row, index) => (
        <div key={row.id}>
          <div className="mb-2 flex items-end justify-between gap-4">
            <span className="font-medium text-slate-900">{row.label}</span>
            <span className="whitespace-nowrap text-sm tabular-nums text-slate-500">
              {votesLabel(row.count)} · {row.percentage}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className={
                index === 0
                  ? "h-full rounded-full bg-emerald-700"
                  : "h-full rounded-full bg-lime-600"
              }
              style={{ width: `${row.percentage}%` }}
            />
          </div>
        </div>
      ))}
      {results.other.texts.length > 0 && (
        <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200">
          <h3 className="mb-3 text-sm font-semibold text-stone-800">{otherLabel}</h3>
          <ul className="space-y-2 text-sm text-stone-700">
            {results.other.texts.map((text, index) => (
              <li key={`${text}-${index}`} className="rounded-lg bg-white px-3 py-2">
                {text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
