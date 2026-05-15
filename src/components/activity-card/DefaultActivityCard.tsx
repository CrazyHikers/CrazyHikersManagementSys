"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { ActivityCardProps } from "./activity-card-types";
import {
  CardActionButton,
  CardMetaLines,
  CardSpotsLeftBadge,
} from "./parts";

export function DefaultActivityCard(props: ActivityCardProps) {
  const {
    id,
    title,
    description,
    coverImgUrl,
    date,
    deadline,
    capacity,
    currentRegistrations,
    maximumRegistration,
    submissionCount,
    managerNames,
    registered,
    managing,
    pendingInvitation,
    sameDayConflict,
  } = props;

  return (
    <Link href={`/activities/${id}`} prefetch={false} className="block">
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex flex-col sm:flex-row">
          {coverImgUrl ? (
            <div className="sm:w-48 h-40 sm:h-auto flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImgUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}

          <div className="flex-1">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg leading-tight">{title}</CardTitle>
                <CardSpotsLeftBadge
                  capacity={capacity}
                  currentRegistrations={currentRegistrations}
                />
              </div>
              <CardDescription className="line-clamp-2">
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <CardMetaLines
                date={date}
                deadline={deadline}
                managerNames={managerNames}
                capacity={capacity}
                currentRegistrations={currentRegistrations}
                maximumRegistration={maximumRegistration}
                submissionCount={submissionCount}
              />
              <CardActionButton
                state={{ managing, pendingInvitation, registered, sameDayConflict }}
              />
            </CardContent>
          </div>
        </div>
      </Card>
    </Link>
  );
}
