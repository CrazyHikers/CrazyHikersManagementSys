import { Badge } from "@/components/ui/badge";
import type { PollStatus } from "@/lib/polls/types";

export function PollStatusBadge({
  status,
  labels,
}: {
  status: PollStatus;
  labels: Record<PollStatus, string>;
}) {
  const classes = {
    draft: "border-slate-200 bg-slate-100 text-slate-700",
    open: "border-emerald-200 bg-emerald-100 text-emerald-800",
    closed: "border-amber-200 bg-amber-100 text-amber-900",
  }[status];

  return (
    <Badge variant="outline" className={classes}>
      {labels[status]}
    </Badge>
  );
}
