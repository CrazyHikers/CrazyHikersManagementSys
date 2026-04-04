import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || "re_placeholder");
}

const FROM_EMAIL = "Crazy Hiker <noreply@crazyhiker.com>";

export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = { from: FROM_EMAIL, to, subject };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (attachments) payload.attachments = attachments;
  return getResend().emails.send(payload);
}

export async function sendMagicLinkEmail(email: string, url: string) {
  return sendEmail({
    to: email,
    subject: "Sign in to Crazy Hiker",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>Sign in to Crazy Hiker</h2>
        <p>Click the button below to sign in to your manager account.</p>
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
