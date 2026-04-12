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
  return sendEmail({
    to: email,
    subject: "Sign in to Crazy Hikers",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>Sign in to Crazy Hikers</h2>
        <p>Click the button below to sign in to your account.</p>
        <a href="${url}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Sign In
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">
          This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendRegistrationConfirmation(
  email: string,
  memberName: string,
  activityTitle: string,
  qrCodeUrl?: string
) {
  const qrSection = qrCodeUrl
    ? `<p>Please join the group chat using the QR code below:</p><img src="${qrCodeUrl}" alt="Group Chat QR Code" style="max-width:200px;height:auto;" />`
    : "";

  return sendEmail({
    to: email,
    subject: `Registration Confirmed - ${activityTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>Registration Confirmed</h2>
        <p>Dear ${memberName},</p>
        <p>Your registration for <strong>${activityTitle}</strong> has been confirmed.</p>
        ${qrSection}
        <p>Best regards,<br/>Crazy Hikers Team</p>
      </div>
    `,
  });
}

export async function sendWaiverExpiryNotification(
  email: string,
  memberName: string,
  waiverFormUrl: string
) {
  return sendEmail({
    to: email,
    subject: "Waiver Expiry Notification",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>Waiver Expiring Soon</h2>
        <p>Dear ${memberName},</p>
        <p>Your waiver is expiring in 7 days. Please submit a new waiver:</p>
        <a href="${waiverFormUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Submit Waiver
        </a>
        <p>Thank you,<br/>Crazy Hikers Team</p>
      </div>
    `,
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
        <p>You have been invited to co-manage <strong>${activityTitle}</strong>.</p>
        <a href="${acceptUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Accept Invitation
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
