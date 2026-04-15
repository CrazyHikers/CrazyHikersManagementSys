"use client";

import { useConfirmedRegistrationCount } from "./registrations-store";

/**
 * Live count for the "报名管理" info card at the top of the activity detail
 * page. Reads from the shared RegistrationsStore so optimistic debounced
 * attendance saves reflect immediately without a page refresh.
 */
export function RegistrationCountDisplay({
  maximumRegistration,
}: {
  maximumRegistration: number | null;
}) {
  const count = useConfirmedRegistrationCount();
  return (
    <>
      {count}
      {maximumRegistration ? ` / ${maximumRegistration}` : ""}
    </>
  );
}
