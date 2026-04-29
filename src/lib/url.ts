/**
 * Returns the canonical base URL for the current deployment, with no
 * trailing slash. Used to build user-facing links in emails, push
 * notifications, and the like — anything where the URL the user sees
 * should land them on the same deployment that sent it.
 *
 * Resolution order:
 *   1. Production deploys → `AUTH_URL` (the canonical domain, e.g.
 *      https://crazyhikers.ch).
 *   2. Vercel previews → the branch URL (`<project>-git-<branch>-<team>
 *      .vercel.app`) when present — stable across commits on the same
 *      branch, so links don't go stale on every push. Falls back to the
 *      per-deploy `VERCEL_URL` if the branch URL isn't available.
 *   3. Local dev / anything else → `AUTH_URL` or `http://localhost:3000`.
 *
 * Do NOT use this for URLs that must match a fixed third-party
 * registration — e.g. the Discord OAuth `redirect_uri` is tied to what's
 * registered in the Developer Portal and must stay on the canonical
 * domain regardless of deployment.
 */
export function getBaseUrl(): string {
  const authUrl = process.env.AUTH_URL?.replace(/\/$/, "");

  if (process.env.VERCEL_ENV === "production" && authUrl) {
    return authUrl;
  }

  const branchHost = process.env.VERCEL_BRANCH_URL;
  if (branchHost) return `https://${branchHost}`;

  const deployHost = process.env.VERCEL_URL;
  if (deployHost) return `https://${deployHost}`;

  return authUrl ?? "http://localhost:3000";
}
