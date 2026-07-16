import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PollVoteForm } from "./poll-vote-form";

const copy = {
  choose: "Choose one",
  identityAnonymous: "Anonymous vote",
  identityNamed: "Named vote — admins can see your choice after close",
  feedback: "Feedback",
  feedbackPlaceholder: "Explain your decision",
  other: "Other",
  otherPlaceholder: "Write your answer",
  review: "Review vote",
  confirmTitleAnonymous: "Confirm your anonymous vote",
  confirmTitleNamed: "Confirm your named vote",
  confirmBody: "Your choice cannot be changed after confirmation.",
  cancel: "Go back",
  confirmAnonymous: "Confirm anonymous vote",
  confirmNamed: "Confirm named vote",
  submitting: "Submitting...",
  success: "Vote recorded",
  error: "Could not record vote",
};

describe("PollVoteForm", () => {
  afterEach(cleanup);
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })),
    );
  });

  it("reviews and confirms one immutable anonymous option vote", async () => {
    render(
      <PollVoteForm
        pollId="poll-1"
        options={[
          { id: "yes", label: "Approve", sortOrder: 0 },
          { id: "no", label: "Reject", sortOrder: 1 },
        ]}
        allowOther
        anonymous
        feedbackPolicy="disabled"
        copy={copy}
      />,
    );

    fireEvent.click(screen.getByLabelText("Approve"));
    fireEvent.click(screen.getByRole("button", { name: "Review vote" }));

    expect(screen.getByText("Confirm your anonymous vote")).toBeTruthy();
    expect(screen.getByText("Approve")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm anonymous vote" }),
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/polls/poll-1/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: "yes" }),
      }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("only offers free text when Other is enabled", () => {
    const { rerender } = render(
      <PollVoteForm
        pollId="poll-1"
        options={[{ id: "yes", label: "Approve", sortOrder: 0 }]}
        allowOther={false}
        anonymous
        feedbackPolicy="disabled"
        copy={copy}
      />,
    );
    expect(screen.queryByLabelText("Other")).toBeNull();

    rerender(
      <PollVoteForm
        pollId="poll-1"
        options={[{ id: "yes", label: "Approve", sortOrder: 0 }]}
        allowOther
        anonymous
        feedbackPolicy="disabled"
        copy={copy}
      />,
    );
    expect(screen.getByLabelText("Other")).toBeTruthy();
  });

  it("requires reject feedback and submits a named ballot payload", async () => {
    render(
      <PollVoteForm
        pollId="promotion-poll"
        options={[
          { id: "approve", label: "Approve", sortOrder: 0, semanticKey: "approve" },
          { id: "reject", label: "Reject", sortOrder: 1, semanticKey: "reject" },
        ]}
        allowOther={false}
        anonymous={false}
        feedbackPolicy="required_on_reject"
        copy={copy}
      />,
    );

    expect(screen.getByText("Named vote — admins can see your choice after close")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Reject"));
    expect(
      (screen.getByRole("button", { name: "Review vote" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Feedback"), {
      target: { value: "Needs more experience" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review vote" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm named vote" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/polls/promotion-poll/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionId: "reject",
          feedback: "Needs more experience",
        }),
      }),
    );
  });
});
