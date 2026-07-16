import type {
  NormalizedBallotInput,
  NormalizedPollInput,
  PollActor,
  PollAudienceMode,
  PollFeedbackPolicy,
  PollKind,
  PollResultsDTO,
  PollScope,
  PollStatus,
  UserRole,
} from "./types";

const POLL_SCOPES: PollScope[] = [
  "member_plus",
  "intern_manager_plus",
  "qualified_manager_plus",
  "admin",
];

const POLL_KINDS: PollKind[] = ["choice", "approval"];
const POLL_AUDIENCE_MODES: PollAudienceMode[] = [
  "role_scope",
  "explicit_list",
];
const POLL_FEEDBACK_POLICIES: PollFeedbackPolicy[] = [
  "disabled",
  "optional",
  "required_on_reject",
  "required",
];

const ROLES_BY_SCOPE: Record<PollScope, UserRole[]> = {
  member_plus: ["member", "manager", "admin", "dev"],
  intern_manager_plus: ["manager", "admin", "dev"],
  qualified_manager_plus: ["manager", "admin", "dev"],
  admin: ["admin", "dev"],
};

export const POLL_LIMITS = {
  title: 120,
  description: 4_000,
  option: 200,
  other: 500,
  feedback: 1_000,
  minOptions: 2,
  maxOptions: 10,
} as const;

export class PollValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "PollValidationError";
  }
}

export function canActorAccessScope(
  actor: Pick<PollActor, "role" | "isIntern">,
  scope: PollScope,
): boolean {
  if (actor.role === "admin" || actor.role === "dev") return true;
  if (actor.role === "member") return scope === "member_plus";
  if (scope === "admin") return false;
  if (scope === "qualified_manager_plus") return !actor.isIntern;
  return true;
}

export function rolesForPollScope(scope: PollScope): UserRole[] {
  return [...ROLES_BY_SCOPE[scope]];
}

export function effectivePollStatus(
  status: PollStatus,
  deadline: Date,
  now = new Date(),
): PollStatus {
  if (status === "open" && deadline.getTime() <= now.getTime()) {
    return "closed";
  }
  return status;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PollValidationError("input", "input must be an object");
  }
  return value as Record<string, unknown>;
}

function normalizedText(
  value: unknown,
  field: string,
  maxLength: number,
  allowEmpty = false,
): string {
  if (typeof value !== "string") {
    throw new PollValidationError(field, `${field} must be text`);
  }
  const text = value.trim();
  if (!allowEmpty && text.length === 0) {
    throw new PollValidationError(field, `${field} is required`);
  }
  if (text.length > maxLength) {
    throw new PollValidationError(field, `${field} is too long`);
  }
  return text;
}

function normalizedBasisPoints(value: unknown, field: string): number {
  const threshold = value ?? 0;
  if (
    typeof threshold !== "number" ||
    !Number.isInteger(threshold) ||
    threshold < 0 ||
    threshold > 10_000
  ) {
    throw new PollValidationError(field, `${field} must be 0-10000`);
  }
  return threshold;
}

export function validatePollInput(input: unknown): NormalizedPollInput {
  const value = asRecord(input);
  const title = normalizedText(value.title, "title", POLL_LIMITS.title);
  const description = normalizedText(
    value.description ?? "",
    "description",
    POLL_LIMITS.description,
    true,
  );

  const kind = (value.kind ?? "choice") as PollKind;
  if (typeof kind !== "string" || !POLL_KINDS.includes(kind)) {
    throw new PollValidationError("kind", "kind is invalid");
  }

  const audienceMode = (value.audienceMode ?? "role_scope") as PollAudienceMode;
  if (
    typeof audienceMode !== "string" ||
    !POLL_AUDIENCE_MODES.includes(audienceMode)
  ) {
    throw new PollValidationError("audienceMode", "audienceMode is invalid");
  }
  if (audienceMode !== "role_scope") {
    throw new PollValidationError(
      "audienceMode",
      "explicit electorates must be configured by the system",
    );
  }

  if (
    typeof value.scope !== "string" ||
    !POLL_SCOPES.includes(value.scope as PollScope)
  ) {
    throw new PollValidationError("scope", "scope is invalid");
  }
  const scope = value.scope as PollScope;

  const anonymous = value.anonymous ?? true;
  if (typeof anonymous !== "boolean") {
    throw new PollValidationError("anonymous", "anonymous must be a boolean");
  }

  const feedbackPolicy = (value.feedbackPolicy ??
    "disabled") as PollFeedbackPolicy;
  if (
    typeof feedbackPolicy !== "string" ||
    !POLL_FEEDBACK_POLICIES.includes(feedbackPolicy)
  ) {
    throw new PollValidationError(
      "feedbackPolicy",
      "feedbackPolicy is invalid",
    );
  }

  const autoSettle = value.autoSettle ?? false;
  if (typeof autoSettle !== "boolean") {
    throw new PollValidationError("autoSettle", "autoSettle must be a boolean");
  }

  const minimumParticipationBps = normalizedBasisPoints(
    value.minimumParticipationBps,
    "minimumParticipationBps",
  );
  const minimumApprovalBps = normalizedBasisPoints(
    value.minimumApprovalBps,
    "minimumApprovalBps",
  );

  if (kind === "choice") {
    if (feedbackPolicy !== "disabled") {
      throw new PollValidationError(
        "feedbackPolicy",
        "choice polls do not collect ballot feedback",
      );
    }
    if (autoSettle) {
      throw new PollValidationError(
        "autoSettle",
        "choice polls cannot settle automatically",
      );
    }
    if (minimumParticipationBps !== 0 || minimumApprovalBps !== 0) {
      const field =
        minimumParticipationBps !== 0
          ? "minimumParticipationBps"
          : "minimumApprovalBps";
      throw new PollValidationError(
        field,
        "choice polls cannot configure settlement thresholds",
      );
    }
  }

  if (typeof value.deadline !== "string") {
    throw new PollValidationError("deadline", "deadline is required");
  }
  const deadline = new Date(value.deadline);
  if (Number.isNaN(deadline.getTime())) {
    throw new PollValidationError("deadline", "deadline is invalid");
  }

  if (typeof value.allowOther !== "boolean") {
    throw new PollValidationError(
      "allowOther",
      "allowOther must be a boolean",
    );
  }

  if (
    !Array.isArray(value.options) ||
    value.options.length < POLL_LIMITS.minOptions ||
    value.options.length > POLL_LIMITS.maxOptions
  ) {
    throw new PollValidationError(
      "options",
      `options must contain ${POLL_LIMITS.minOptions}-${POLL_LIMITS.maxOptions} items`,
    );
  }
  const options = value.options.map((option) =>
    normalizedText(option, "options", POLL_LIMITS.option),
  );
  const normalizedLabels = options.map((option) => option.toLocaleLowerCase());
  if (new Set(normalizedLabels).size !== normalizedLabels.length) {
    throw new PollValidationError("options", "options must be unique");
  }

  if (kind === "approval") {
    if (value.allowOther) {
      throw new PollValidationError(
        "allowOther",
        "approval polls cannot accept other responses",
      );
    }
    if (options.length !== 2) {
      throw new PollValidationError(
        "options",
        "approval polls require approve and reject options",
      );
    }
  }

  return {
    title,
    description,
    kind,
    audienceMode,
    scope,
    anonymous,
    feedbackPolicy,
    autoSettle,
    minimumParticipationBps,
    minimumApprovalBps,
    deadline,
    allowOther: value.allowOther,
    options,
  };
}

export function validateBallotInput(
  input: unknown,
  poll: {
    allowOther: boolean;
    optionIds: string[];
    feedbackPolicy?: PollFeedbackPolicy;
    rejectOptionId?: string | null;
  },
): NormalizedBallotInput {
  const value = asRecord(input);
  const optionId =
    typeof value.optionId === "string" && value.optionId.length > 0
      ? value.optionId
      : null;
  const hasOtherText = typeof value.otherText === "string";
  const feedbackPolicy = poll.feedbackPolicy ?? "disabled";
  const feedback =
    typeof value.feedback === "string" && value.feedback.trim().length > 0
      ? normalizedText(value.feedback, "feedback", POLL_LIMITS.feedback)
      : null;

  if ((optionId ? 1 : 0) + (hasOtherText ? 1 : 0) !== 1) {
    throw new PollValidationError(
      "ballot",
      "choose exactly one option or other response",
    );
  }

  if (feedbackPolicy === "disabled" && feedback) {
    throw new PollValidationError("feedback", "feedback is disabled");
  }
  if (feedbackPolicy === "required" && !feedback) {
    throw new PollValidationError("feedback", "feedback is required");
  }
  if (
    feedbackPolicy === "required_on_reject" &&
    optionId === poll.rejectOptionId &&
    !feedback
  ) {
    throw new PollValidationError(
      "feedback",
      "feedback is required when rejecting",
    );
  }

  if (optionId) {
    if (!poll.optionIds.includes(optionId)) {
      throw new PollValidationError("optionId", "option does not belong to poll");
    }
    return { optionId, otherText: null, feedback };
  }

  if (!poll.allowOther) {
    throw new PollValidationError("otherText", "other responses are disabled");
  }
  return {
    optionId: null,
    otherText: normalizedText(
      value.otherText,
      "otherText",
      POLL_LIMITS.other,
    ),
    feedback,
  };
}

function percentage(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 1_000) / 10;
}

export function aggregatePollResults(
  options: Array<{ id: string; label: string; sortOrder: number }>,
  ballots: Array<{ optionId: string | null; otherText: string | null }>,
): PollResultsDTO {
  const total = ballots.length;
  const countByOption = new Map<string, number>();
  const otherTexts: string[] = [];

  for (const ballot of ballots) {
    if (ballot.optionId) {
      countByOption.set(
        ballot.optionId,
        (countByOption.get(ballot.optionId) ?? 0) + 1,
      );
    } else if (ballot.otherText) {
      otherTexts.push(ballot.otherText);
    }
  }

  return {
    total,
    options: [...options]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((option) => {
        const count = countByOption.get(option.id) ?? 0;
        return {
          id: option.id,
          label: option.label,
          count,
          percentage: percentage(count, total),
        };
      }),
    other: {
      count: otherTexts.length,
      percentage: percentage(otherTexts.length, total),
      texts: otherTexts,
    },
  };
}
