const GITHUB_API = "https://api.github.com";

export type FeedbackType = "bug" | "feature" | "other";

const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "bug",
  feature: "enhancement",
  other: "feedback",
};

export async function createFeedbackIssue(opts: {
  title: string;
  body: string;
  type: FeedbackType;
}): Promise<{ url: string; number: number }> {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO;

  if (!token || !repo) {
    throw new Error("GITHUB_FEEDBACK_TOKEN and GITHUB_FEEDBACK_REPO must be set");
  }

  const res = await fetch(`${GITHUB_API}/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: opts.title,
      body: opts.body,
      labels: ["from-app", TYPE_LABEL[opts.type]],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { html_url: string; number: number };
  return { url: data.html_url, number: data.number };
}
