// Props every activity-card variant must accept. The homepage list builds
// this shape from cached activity data and hands it to whichever card
// component the template registry resolves to.

export type ActivityCardProps = {
  id: string;
  title: string;
  description: string;
  coverImgUrl: string | null;
  date: string;
  deadline: string;
  capacity: number;
  currentRegistrations: number;
  maximumRegistration: number | null;
  submissionCount: number;
  managerNames: string;
  registered?: boolean;
  managing?: boolean;
  pendingInvitation?: boolean;
  sameDayConflict?: {
    activityId: string;
    title: string;
    role: "member" | "manager";
  };
  template?: string | null;
};
