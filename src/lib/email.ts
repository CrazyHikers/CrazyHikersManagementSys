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

export async function sendWelcomeSignupEmail(email: string, url: string) {
  // Used after a fresh signup. Same destination URL shape as reset
  // (/{locale}/reset-password?token=…&email=…) — the receiving endpoint
  // upserts the user, so the same flow handles both "first password" and
  // "replace existing password".
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error(`Refusing to send welcome email to ${email}: invalid URL`);
  }
  return sendEmail({
    to: email,
    subject: "欢迎加入 Crazy Hikers！请设置密码 / Welcome — set your password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>欢迎加入 Crazy Hikers / Welcome to Crazy Hikers</h2>
        <p>感谢注册！点击下方按钮设置你的密码并完成账户创建。</p>
        <p>Thanks for signing up. Click the button below to set your password and finish creating your account.</p>
        <a href="${url}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          设置密码 / Set Password
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">
          或将以下链接复制到浏览器打开 / Or copy and paste this link:<br/>
          <a href="${url}" style="color: #16a34a; word-break: break-all;">${url}</a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">
          此链接1小时内有效。如果不是你本人操作，请忽略此邮件。<br/>
          This link expires in 1 hour. If you didn't sign up, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `欢迎加入 Crazy Hikers / Welcome to Crazy Hikers\n\n点击以下链接设置密码 / Click to set your password:\n\n${url}\n\n此链接1小时内有效。\nThis link expires in 1 hour.`,
  });
}

export async function sendPasswordResetEmail(email: string, url: string) {
  // The reset flow doesn't go through Auth.js's magic-link callback (which
  // fails to issue a JWT cookie under JWT session strategy), so this email
  // links straight to /reset-password?token=…&email=… instead.
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error(`Refusing to send password reset to ${email}: invalid URL`);
  }
  return sendEmail({
    to: email,
    subject: "重置密码 — Crazy Hikers / Reset your password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2>重置密码 / Reset Password</h2>
        <p>点击下方按钮重置你的账户密码。</p>
        <p>Click the button below to reset your account password.</p>
        <a href="${url}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          重置密码 / Reset Password
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">
          或将以下链接复制到浏览器打开 / Or copy and paste this link:<br/>
          <a href="${url}" style="color: #16a34a; word-break: break-all;">${url}</a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 16px;">
          此链接1小时内有效。如果不是你本人操作，请忽略此邮件。<br/>
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `重置密码 / Reset Password\n\n点击以下链接重置密码 / Click to reset your password:\n\n${url}\n\n此链接1小时内有效。如果不是你本人操作，请忽略此邮件。\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
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
