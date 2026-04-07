import nodemailer from "nodemailer"

// ─────────────────────────────────────────────
// Transporter
// ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

const FROM = process.env.SMTP_FROM ?? `"Advisor System" <${process.env.SMTP_USER}>`
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Advisor Review System"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

// ─────────────────────────────────────────────
// Base HTML wrapper
// ─────────────────────────────────────────────
function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, Helvetica, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background-color: #4f46e5; padding: 28px 40px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
    .body { padding: 36px 40px; color: #374151; font-size: 15px; line-height: 1.7; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; margin: 8px 0 24px; padding: 12px 28px; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .footer { padding: 20px 40px 28px; color: #9ca3af; font-size: 12px; line-height: 1.6; }
    .link-fallback { word-break: break-all; color: #4f46e5; font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${APP_NAME}</h1>
    </div>
    <div class="body">
      ${body}
    </div>
    <hr class="divider" />
    <div class="footer">
      <p>This email was sent by ${APP_NAME}. If you did not request this, please ignore it.</p>
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

// ─────────────────────────────────────────────
// Send helper
// ─────────────────────────────────────────────
async function sendMail(options: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  })
}

// ─────────────────────────────────────────────
// Verify Connection (useful for startup check)
// ─────────────────────────────────────────────
export async function verifyMailerConnection(): Promise<boolean> {
  try {
    await transporter.verify()
    return true
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────
// Email: Verify Email Address
// ─────────────────────────────────────────────
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`

  const html = baseTemplate(
    "Verify your email address",
    `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Welcome to ${APP_NAME}! Before you can sign in, please verify your email address by clicking the button below.</p>
    <a href="${verifyUrl}" class="btn">Verify Email Address</a>
    <p>This link will expire in <strong>24 hours</strong>.</p>
    <p>If the button above doesn't work, copy and paste this link into your browser:</p>
    <p><a href="${verifyUrl}" class="link-fallback">${verifyUrl}</a></p>
    `
  )

  const text = `
Hi ${name},

Welcome to ${APP_NAME}! Please verify your email address by visiting the link below.

${verifyUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.
  `.trim()

  await sendMail({
    to,
    subject: `Verify your email — ${APP_NAME}`,
    html,
    text,
  })
}

// ─────────────────────────────────────────────
// Email: Password Reset
// ─────────────────────────────────────────────
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  const html = baseTemplate(
    "Reset your password",
    `
    <p>Hi <strong>${name}</strong>,</p>
    <p>We received a request to reset the password for your ${APP_NAME} account.</p>
    <a href="${resetUrl}" class="btn">Reset Password</a>
    <p>This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
    <p>If the button above doesn't work, copy and paste this link into your browser:</p>
    <p><a href="${resetUrl}" class="link-fallback">${resetUrl}</a></p>
    `
  )

  const text = `
Hi ${name},

We received a request to reset your password for ${APP_NAME}.

Visit the link below to choose a new password:
${resetUrl}

This link will expire in 1 hour.

If you did not request this, please ignore this email.
  `.trim()

  await sendMail({
    to,
    subject: `Reset your password — ${APP_NAME}`,
    html,
    text,
  })
}

// ─────────────────────────────────────────────
// Email: Document Approved Notification
// ─────────────────────────────────────────────
export async function sendApprovalNotificationEmail(
  to: string,
  studentName: string,
  documentName: string,
  documentType: "SRS" | "OPPM",
  projectName: string,
  feedback: string
): Promise<void> {
  const html = baseTemplate(
    `${documentType} Approved`,
    `
    <p>Hi <strong>${studentName}</strong>,</p>
    <p>Great news! Your advisor has reviewed and <strong>approved</strong> your <strong>${documentType}</strong> document for the project <strong>${projectName}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0 24px;">
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;width:140px;">Document</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;">${documentName}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Type</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;">${documentType}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;">Project</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;">${projectName}</td>
      </tr>
    </table>
    <p><strong>Advisor Feedback:</strong></p>
    <blockquote style="margin:0 0 16px;padding:12px 16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;color:#166534;">
      ${feedback.replace(/\n/g, "<br/>")}
    </blockquote>
    <p>You may now proceed to the next phase of your project. Well done!</p>
    `
  )

  const text = `
Hi ${studentName},

Your advisor has approved your ${documentType} document for project "${projectName}".

Document: ${documentName}
Type: ${documentType}

Advisor Feedback:
${feedback}

You may now proceed to the next phase. Well done!
  `.trim()

  await sendMail({
    to,
    subject: `✅ ${documentType} Approved — ${projectName}`,
    html,
    text,
  })
}

// ─────────────────────────────────────────────
// Email: Feedback Sent (without approval)
// ─────────────────────────────────────────────
export async function sendFeedbackEmail(
  to: string,
  studentName: string,
  documentName: string,
  documentType: "SRS" | "OPPM",
  projectName: string,
  feedback: string
): Promise<void> {
  const html = baseTemplate(
    `Feedback on your ${documentType}`,
    `
    <p>Hi <strong>${studentName}</strong>,</p>
    <p>Your advisor has reviewed your <strong>${documentType}</strong> document for the project <strong>${projectName}</strong> and has provided the following feedback.</p>
    <p><strong>Document:</strong> ${documentName}</p>
    <p><strong>Advisor Feedback:</strong></p>
    <blockquote style="margin:0 0 16px;padding:12px 16px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;color:#1e40af;">
      ${feedback.replace(/\n/g, "<br/>")}
    </blockquote>
    <p>Please review the feedback carefully and update your document accordingly before resubmitting.</p>
    `
  )

  const text = `
Hi ${studentName},

Your advisor has reviewed your ${documentType} document for project "${projectName}".

Document: ${documentName}

Advisor Feedback:
${feedback}

Please review the feedback and update your document before resubmitting.
  `.trim()

  await sendMail({
    to,
    subject: `📝 Feedback on your ${documentType} — ${projectName}`,
    html,
    text,
  })
}
