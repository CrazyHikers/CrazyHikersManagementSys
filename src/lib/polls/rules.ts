import type {
  NormalizedBallotInput,
  NormalizedPollInput,
  PollResultsDTO,
  PollScope,
  PollStatus,
  UserRole,
} from "./types";

const POLL_SCOPES: PollScope[] = ["member_plus", "manager_plus", "admin"];

const ROLES_BY_SCOPE: Record<PollScope, UserRole[]> = {
  member_plus: ["member", "manager", "admin", "dev"],
  manager_plus: ["manager", "admin", "dev"],
  admin: ["admin", "dev"],
};

export const POLL_LIMITS = {
  title: 120,
  description: 4_000,
  option: 200,
  other: 500,
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

export function canRoleAccessScope(
  role: UserRole,
  scope: PollScope,
): boolean {
  return ROLES_BY_SCOPE[scope].includes(role);
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

export function validatePollInput(input: unknown): NormalizedPollInput {
  const value = asRecord(input);
  const title = normalizedText(value.title, "title", POLL_LIMITS.title);
  const description = normalizedText(
    value.description ?? "",
    "description",
    POLL_LIMITS.description,
    true,
  );

  if (
    typeof value.scope !== "string" ||
    !POLL_SCOPES.includes(value.scope as PollScope)
  ) {
    throw new PollValidationError("scope", "scope is invalid");
  }
  const scope = value.scope as PollScope;

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

  return {
    title,
    description,
    scope,
    deadline,
    allowOther: value.allowOther,
    options,
  };
}

export function validateBallotInput(
  input: unknown,
  poll: { allowOther: boolean; optionIds: string[] },
): NormalizedBallotInput {
  const value = asRecord(input);
  const optionId =
    typeof value.optionId === "string" && value.optionId.length > 0
      ? value.optionId
      : null;
  const hasOtherText = typeof value.otherText === "string";

  if ((optionId ? 1 : 0) + (hasOtherText ? 1 : 0) !== 1) {
    throw new PollValidationError(
      "ballot",
      "choose exactly one option or other response",
    );
  }

  if (optionId) {
    if (!poll.optionIds.includes(optionId)) {
      throw new PollValidationError("optionId", "option does not belong to poll");
    }
    return { optionId, otherText: null };
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
