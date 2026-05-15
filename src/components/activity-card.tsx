"use client";

import { DefaultActivityCard } from "@/components/activity-card/DefaultActivityCard";
import type { ActivityCardProps } from "@/components/activity-card/activity-card-types";
import { getTemplate } from "@/lib/events/templates";

export type { ActivityCardProps };

// Dispatcher: pick the template-specific card when the registry has
// one for this activity's tag, otherwise render the default. Generic
// callers (activity-list) don't need to know about templates at all.
export function ActivityCard(props: ActivityCardProps) {
  const Card = getTemplate(props.template)?.Card ?? DefaultActivityCard;
  return <Card {...props} />;
}
