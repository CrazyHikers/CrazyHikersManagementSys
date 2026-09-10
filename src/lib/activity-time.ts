// Activity deadlines must not depend on the server's (usually UTC) timezone.
// The IANA zone applies Swiss summer/winter offsets for the actual deadline.
export function formatActivityDeadline(value: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(new Date(value));
}
