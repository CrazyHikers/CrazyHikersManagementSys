import { PollValidationError } from "./rules";
import { PollServiceError } from "./service";

export function pollErrorStatus(error: unknown): number {
  if (error instanceof PollValidationError) return 400;
  if (!(error instanceof PollServiceError)) return 500;

  switch (error.code) {
    case "POLL_NOT_FOUND":
      return 404;
    case "FORBIDDEN":
      return 403;
    case "INVALID_DEADLINE_EXTENSION":
      return 400;
    default:
      return 409;
  }
}

export function pollErrorCode(error: unknown): string {
  if (error instanceof PollValidationError) return "INVALID_INPUT";
  if (error instanceof PollServiceError) return error.code;
  return "INTERNAL_ERROR";
}
