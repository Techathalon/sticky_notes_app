import { env } from '../config';

interface BrevoRecipient {
  email: string;
  name?: string;
}

interface SendEmailParams {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Generic transactional email sender using Brevo REST API v3
 */
export async function sendEmail({
  to,
  subject,
  htmlContent,
  textContent,
}: SendEmailParams): Promise<void> {
  if (!env.BREVO_API_KEY) {
    console.warn('[email] BREVO_API_KEY not configured — skipping email dispatch');
    return;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: env.FROM_NAME,
        email: env.FROM_EMAIL,
      },
      to,
      subject,
      htmlContent,
      textContent,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[email] Brevo API error (${response.status}):`, errorBody);
    throw new Error(`Failed to send email via Brevo: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as { messageId?: string };
  console.info(`[email] Email sent successfully via Brevo:`, result?.messageId ?? 'ok');
}

/**
 * Password Reset Email
 */
export async function sendResetEmail(to: string, name: string, resetLink: string): Promise<void> {
  // Always log the reset link to console for debugging
  console.info(`\n========================================`);
  console.info(`[RESET LINK] Email: ${to}`);
  console.info(`[RESET LINK] URL:   ${resetLink}`);
  console.info(`========================================\n`);

  const recipientName = name || 'there';
  const subject = 'Reset your Sticky Notes password';

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Sticky Notes password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7fb; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!-- Outer wrapper table ensures outer background color and padding in all webmail clients (Roundcube, Gmail, etc.) -->
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f7fb" style="background-color: #f6f7fb; width: 100%; margin: 0; padding: 0;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <!-- Centered Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <tr>
            <td style="padding: 36px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: left;">
              <h2 style="color: #1a1a2e; margin-top: 0; margin-bottom: 20px; font-size: 22px; font-weight: 700;">Sticky Notes</h2>
              <p style="font-size: 16px; color: #333333; line-height: 1.5; margin: 0 0 14px 0;">Hi ${recipientName},</p>
              <p style="font-size: 15px; color: #555555; line-height: 1.6; margin: 0 0 28px 0;">
                We received a request to reset your password. Tap the button below to set a new password:
              </p>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 28px auto;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #6366F1;">
                    <a href="${resetLink}" target="_blank" style="background-color: #6366F1; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; border: 1px solid #6366F1;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size: 13px; color: #888888; line-height: 1.5; margin: 0 0 24px 0;">
                This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
              <p style="font-size: 12px; color: #aaaaaa; line-height: 1.5; margin: 0; word-break: break-all;">
                Or copy and paste this link into your browser:<br/>
                <a href="${resetLink}" target="_blank" style="color: #6366F1; text-decoration: underline;">${resetLink}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textContent = `Hi ${recipientName},\n\nWe received a request to reset your Sticky Notes password.\n\nReset your password here:\n${resetLink}\n\nThis link will expire in 24 hours. If you didn't request this, you can safely ignore this email.`;

  try {
    await sendEmail({
      to: [{ email: to, name: recipientName }],
      subject,
      htmlContent,
      textContent,
    });
  } catch (err) {
    console.error(`[email] Failed to send reset email: ${(err as Error).message}`);
    if (env.NODE_ENV === 'production') {
      throw err;
    }
  }
}
