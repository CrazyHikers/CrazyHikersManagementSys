import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResend() {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Crazy Hiker <onboarding@resend.dev>";

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
    subject: "Sign in to Crazy Hiker",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>Sign in to Crazy Hiker</h2>
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
    ? `<p>Please join the group chat using the QR code below:</p><img src="${qrCodeUrl}" alt="Group Chat QR Code" style="width:200px;height:200px;" />`
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
        <p>Best regards,<br/>Crazy Hiker Team</p>
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
        <p>Thank you,<br/>Crazy Hiker Team</p>
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
        <p>Best regards,<br/>Crazy Hiker Team</p>
      </div>
    `,
  });
}

export async function sendPromotionReferralEmail(
  voterEmail: string,
  voterName: string,
  requesterName: string,
  voteUrl: string
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
        <p>Best regards,<br/>Crazy Hiker Team</p>
      </div>
    `,
  });
}

export async function sendPromotionVoteEmail(
  voterEmail: string,
  voterName: string,
  requesterName: string,
  voteUrl: string
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
        <p>Best regards,<br/>Crazy Hiker Team</p>
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
        <p>Best regards,<br/>Crazy Hiker Team</p>
      </div>
    `,
  });
}
