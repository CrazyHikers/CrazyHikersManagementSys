export type UserRole = "dev" | "admin" | "manager" | "member";

export type PollScope = "member_plus" | "manager_plus" | "admin";

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
  scope: PollScope;
  deadline: Date;
  allowOther: boolean;
  options: string[];
};

export type NormalizedBallotInput = {
  optionId: string | null;
  otherText: string | null;
};
