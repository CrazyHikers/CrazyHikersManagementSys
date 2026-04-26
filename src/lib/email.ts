import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResend() {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Crazy Hikers <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  // Refuse to dispatch an email with no body. Without this check, a caller
  // that forgets to pass html/text (or passes an empty string due to a
  // template bug) would silently deliver a blank email.
  if (!html?.trim() && !text?.trim()) {
    throw new Error(`Refusing to send email to ${to} with empty body`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = { from: FROM_EMAIL, to: [to], subject };
  if (html) payload.html = html;
  if (text) payload.text = text;
  const { data, error } = await getResend().emails.send(payload);

  if (error) {
    console.error("[EMAIL] Send failed:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log("[EMAIL] Sent to", to, "id:", data?.id);
  return data;
}

export async function sendMagicLinkEmail(email: string, url: string) {
  // Fail fast on a missing/malformed URL — otherwise the template would
  // render an "<a href="">" button and the email would look mostly blank
  // to the recipient. Surfacing the error lets the caller retry or alert.
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error(`Refusing to send magic link to ${email}: invalid URL`);
  }

  // The signin page reuses the magic-link mechanism for "forgot password"
  // by passing callbackUrl=/set-password. Detect that here so the email
  // can be unambiguously labeled as a password reset — otherwise users
  // who requested a reset see a generic "Sign in" email and mistake it
  // for the wrong message.
  const isPasswordReset = (() => {
    try {
      const callback = new URL(url).searchParams.get("callbackUrl") || "";
      return callback.includes("/set-password");
    } catch {
      return false;
    }
  })();

  const subject = isPasswordReset
    ? "重置密码 — Crazy Hikers / Reset your password"
    : "登录 Crazy Hikers / Sign in";
  const heading = isPasswordReset ? "重置密码 / Reset Password" : "登录 / Sign In";
  const introZh = isPasswordReset
    ? "点击下方按钮重置你的账户密码。点击后你将被引导设置新密码。"
    : "点击下方按钮登录你的账户。";
  const introEn = isPasswordReset
    ? "Click the button below to reset your password. You'll be asked to set a new one after clicking."
    : "Click the button below to sign in to your account.";
  const buttonLabel = isPasswordReset ? "重置密码 / Reset Password" : "登录 / Sign In";

  return sendEmail({
    to: email,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>${heading}</h2>
        <p>${introZh}</p>
        <p>${introEn}</p>
        <a href="${url}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          ${buttonLabel}
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">
          或将以下链接复制到浏览器打开 / Or copy and paste this link:<br/>
          <a href="${url}" style="color: #16a34a; word-break: break-all;">${url}</a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">
          此链接24小时内有效。如果不是你本人操作，请忽略此邮件。<br/>
          This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `${heading}\n\n${introZh}\n${introEn}\n\n${url}\n\n此链接24小时内有效。如果不是你本人操作，请忽略此邮件。\nThis link expires in 24 hours. If you didn't request this, you can safely ignore this email.`,
  });
}

export async function sendComanagerInvitation(
  email: string,
  comanagerName: string,
  activityTitle: string,
  acceptUrl: string
) {
  return sendEmail({
    to: email,
    subject: `Co-manager Invitation - ${activityTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>Co-manager Invitation</h2>
        <p>Dear ${comanagerName},</p>
        <p>You have been invited to co-manage <strong>${activityTitle}</strong>. Click below to accept or decline the invitation.</p>
        <a href="${acceptUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          View Invitation
        </a>
        <p>Best regards,<br/>Crazy Hikers Team</p>
      </div>
    `,
  });
}

export type ActivityLink = {
  title: string;
  url: string;
};

export type CandidateActivities = {
  managed: ActivityLink[];
  comanaged: ActivityLink[];
  attended: ActivityLink[];
};

function renderActivitySection(label: string, activities: ActivityLink[]): string {
  if (activities.length === 0) return "";
  const items = activities
    .map((a) => `<li><a href="${a.url}" style="color: #16a34a;">${a.title}</a></li>`)
    .join("");
  return `<p style="margin-bottom: 4px;"><strong>${label}:</strong></p><ul style="margin-top: 0;">${items}</ul>`;
}

function renderCandidateActivities(activities: CandidateActivities): string {
  const sections = [
    renderActivitySection("Managed", activities.managed),
    renderActivitySection("Co-managed", activities.comanaged),
    renderActivitySection("Attended", activities.attended),
  ].filter(Boolean);
  if (sections.length === 0) return "";
  return `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" /><p><strong>Activity History:</strong></p>${sections.join("")}`;
}

export async function sendPromotionReferralEmail(
  voterEmail: string,
  voterName: string,
  requesterName: string,
  voteUrl: string,
  activities: CandidateActivities
) {
  return sendEmail({
    to: voterEmail,
    subject: `Manager Referral Request - ${requesterName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>Manager Referral Request</h2>
        <p>Dear ${voterName},</p>
        <p><strong>${requesterName}</strong> has requested to become an intern manager and listed you as a referral.</p>
        <p>Please review their profile and approve or reject this request. This link expires in 24 hours.</p>
        <a href="${voteUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Review Request
        </a>
        ${renderCandidateActivities(activities)}
        <p>Best regards,<br/>Crazy Hikers Team</p>
      </div>
    `,
  });
}

export async function sendPromotionVoteEmail(
  voterEmail: string,
  voterName: string,
  requesterName: string,
  voteUrl: string,
  activities: CandidateActivities
) {
  return sendEmail({
    to: voterEmail,
    subject: `Promotion Vote - ${requesterName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>Promotion Vote</h2>
        <p>Dear ${voterName},</p>
        <p><strong>${requesterName}</strong> is requesting promotion from intern to qualified manager.</p>
        <p>Please cast your vote within 24 hours. You may optionally provide a reason for your decision.</p>
        <a href="${voteUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Cast Your Vote
        </a>
        ${renderCandidateActivities(activities)}
        <p>Best regards,<br/>Crazy Hikers Team</p>
      </div>
    `,
  });
}

export async function sendPromotionResultEmail(
  userEmail: string,
  userName: string,
  promoted: boolean,
  newRole: string,
  reasons?: string[]
) {
  const reasonsHtml = reasons && reasons.length > 0
    ? `<p>Feedback from voters:</p><ul>${reasons.map(r => `<li>${r}</li>`).join("")}</ul>`
    : "";

  return sendEmail({
    to: userEmail,
    subject: promoted ? "Promotion Approved!" : "Promotion Request Update",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>${promoted ? "Congratulations!" : "Promotion Update"}</h2>
        <p>Dear ${userName},</p>
        ${promoted
          ? `<p>Your promotion request has been approved! You are now a <strong>${newRole}</strong>.</p>`
          : `<p>Unfortunately, your promotion request was not approved at this time.</p>`
        }
        ${reasonsHtml}
        <p>Best regards,<br/>Crazy Hikers Team</p>
      </div>
    `,
  });
}
