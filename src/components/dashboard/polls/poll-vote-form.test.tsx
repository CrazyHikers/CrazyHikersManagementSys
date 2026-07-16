import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PollVoteForm } from "./poll-vote-form";

const copy = {
  choose: "Choose one",
  other: "Other",
  otherPlaceholder: "Write your answer",
  review: "Review vote",
  confirmTitle: "Confirm your anonymous vote",
  confirmBody: "Your choice cannot be changed after confirmation.",
  cancel: "Go back",
  confirm: "Confirm anonymous vote",
  submitting: "Submitting...",
  success: "Vote recorded",
  error: "Could not record vote",
};

describe("PollVoteForm", () => {
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
        copy={copy}
      />,
    );
    expect(screen.queryByLabelText("Other")).toBeNull();

    rerender(
      <PollVoteForm
        pollId="poll-1"
        options={[{ id: "yes", label: "Approve", sortOrder: 0 }]}
        allowOther
        copy={copy}
      />,
    );
    expect(screen.getByLabelText("Other")).toBeTruthy();
  });
});
