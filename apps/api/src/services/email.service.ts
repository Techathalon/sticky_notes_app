// import * as postmark from 'postmark';
// import { env } from '../config';

// const client = new postmark.ServerClient(env.POSTMARK_API_TOKEN);

export async function sendResetEmail(to: string, _name: string, resetLink: string): Promise<void> {
  // Always log the reset link to console for debugging
  console.info(`\n========================================`);
  console.info(`[RESET LINK] Email: ${to}`);
  console.info(`[RESET LINK] URL:   ${resetLink}`);
  console.info(`========================================\n`);

  // TODO: Add Postmark tokens and re-enable email sending
  /*
  try {
    const result = await client.sendEmailWithTemplate({
      From: env.FROM_EMAIL as string,
      To: to,
      TemplateAlias: 'password-reset',
      TemplateModel: {
        product_name: 'Sticky Notes',
        name: _name || 'there',
        action_url: resetLink,
        product_url: 'http://localhost:8081',
        support_url: 'http://localhost:8081/support',
        company_name: 'Sticky Notes',
        company_address: '',
        operating_system: 'Mobile',
        browser_name: 'Sticky Notes App',
      },
    });
    console.log(result);
    if (result.Message !== 'OK') {
      console.error(`[email] Failed to send reset email: ${result.Message}`);
      throw new Error(`Failed to send email: ${result.Message}`);
    }
    console.info(`[email] Reset email sent to ${to}`);
  } catch (err) {
    console.error(`[email] Failed to send reset email: ${(err as Error).message}`);
    // In development, don't crash the request — reset link is already logged above
    if (env.NODE_ENV === 'production') {
      throw new Error(`Failed to send email: ${(err as Error).message}`);
    }
  }
  */
}
