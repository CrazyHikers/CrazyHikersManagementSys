import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PollEditor } from "./poll-editor";

const copy = {
  title: "Title",
  description: "Description",
  scope: "Who can vote",
  scopes: {
    member_plus: "All members and above",
    intern_manager_plus: "Intern managers and above",
    qualified_manager_plus: "Qualified managers and above",
    admin: "Admins only",
  },
  deadline: "Deadline",
  options: "Options",
  option: "Option {number}",
  addOption: "Add option",
  removeOption: "Remove option {number}",
  approveReject: "Use Approve / Reject",
  approve: "Approve",
  reject: "Reject",
  allowOther: "Allow Other free text",
  otherHint: "Up to 500 characters",
  save: "Save draft",
  saving: "Saving...",
  saved: "Draft saved",
  error: "Could not save poll",
};

describe("PollEditor", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ poll: { id: "poll-9" } }),
      })),
    );
  });

  it("creates a scoped draft using the approve/reject shortcut", async () => {
    render(<PollEditor copy={copy} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Use Approve / Reject" }),
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Adopt the policy" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Policy details" },
    });
    fireEvent.change(screen.getByLabelText("Who can vote"), {
      target: { value: "intern_manager_plus" },
    });
    fireEvent.change(screen.getByLabelText("Deadline"), {
      target: { value: "2099-07-30T12:00" },
    });
    fireEvent.click(screen.getByLabelText("Allow Other free text"));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(request).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      title: "Adopt the policy",
      description: "Policy details",
      scope: "intern_manager_plus",
      allowOther: true,
      options: ["Approve", "Reject"],
    });
    expect(push).toHaveBeenCalledWith("/dashboard/polls/poll-9/manage");
  });
});
