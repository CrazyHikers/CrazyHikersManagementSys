export type UserRole = "dev" | "admin" | "manager" | "member";

export type PollActor = {
  email: string;
  role: UserRole;
  isIntern: boolean;
};

export type PollScope =
  | "member_plus"
  | "intern_manager_plus"
  | "qualified_manager_plus"
  | "admin";

export type PollKind = "choice" | "approval";

export type PollAudienceMode = "role_scope" | "explicit_list";

export type PollCreatorType = "admin" | "system";

export type PollFeedbackPolicy =
  | "disabled"
  | "optional"
  | "required_on_reject"
  | "required";

export type PollOutcome = "passed" | "rejected" | "no_quorum";

export type PollStatus = "draft" | "open" | "closed";

export type PollOptionDTO = {
  id: string;
  label: string;
  sortOrder: number;
};

export type PollResultOptionDTO = {
  id: string;
  label: string;
  count: number;
  percentage: number;
};

export type PollResultsDTO = {
  total: number;
  options: PollResultOptionDTO[];
  other: {
    count: number;
    percentage: number;
    texts: string[];
  };
};

export type PollListItemDTO = {
  id: string;
  title: string;
  description: string;
  scope: PollScope;
  status: PollStatus;
  deadline: string;
  participantCount: number;
  hasVoted: boolean;
  allowOther: boolean;
};

export type PollDetailDTO = PollListItemDTO & {
  options: PollOptionDTO[];
  results?: PollResultsDTO;
};

export type PollParticipantDTO = {
  email: string;
  name: string;
  votedAt: string;
};

export type NormalizedPollInput = {
  title: string;
  description: string;
  kind: PollKind;
  audienceMode: PollAudienceMode;
  scope: PollScope;
  anonymous: boolean;
  feedbackPolicy: PollFeedbackPolicy;
  autoSettle: boolean;
  minimumParticipationBps: number;
  minimumApprovalBps: number;
  deadline: Date;
  allowOther: boolean;
  options: string[];
};

export type NormalizedBallotInput = {
  optionId: string | null;
  otherText: string | null;
};
