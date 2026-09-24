const { Resend } = require('resend');

/**
 * Masks an email for safe logging without exposing student identities.
 * e.g., rahul.sharma@sanjivani.edu.in -> r******@sanjivani.edu.in
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!local) return email;
  const visible = local.slice(0, 1);
  return `${visible}******@${domain || ''}`;
}

/**
 * Builds the professional HTML email template for Campus Radar OTP.
 */
function buildOtpEmailHtml({ otp, purpose = 'registration' }) {
  const isReset = purpose === 'reset';
  const heading = isReset ? 'Reset Your Password' : 'Verify Your Email';
  const description = isReset
    ? 'You recently requested to reset your password for your Campus Radar account. Enter the verification code below to proceed.'
    : 'Welcome to Campus Radar! Please enter the 6-digit verification code below to verify your official Sanjivani University email address.';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #131b2e; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #1e293b; background: linear-gradient(180deg, #182238 0%, #131b2e 100%);">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); margin-bottom: 12px;">
                <span style="font-size: 22px;">📡</span>
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Campus Radar</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Sanjivani University Collegiate Platform</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #f8fafc;">${heading}</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">${description}</p>

              <!-- OTP Code Display Box -->
              <div style="text-align: center; margin: 28px 0; padding: 20px; background-color: #0b0f19; border: 1px solid #38bdf8; border-radius: 12px;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 8px; font-weight: 600;">Verification Code</div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffffff; text-indent: 8px;">${otp}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 8px;">Expires in 10 minutes</div>
              </div>

              <!-- Security Warning -->
              <div style="padding: 14px 16px; background-color: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; border-radius: 6px; margin: 24px 0 16px 0;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #fca5a5;">
                  <strong>Security Notice:</strong> Never share this code with anyone. Campus Radar staff will never ask for your verification code. If you did not make this request, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0e1524; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                Sanjivani University &bull; Kopargaon, Maharashtra &bull; Official Student Community
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Attempts delivery via Gmail Apps Script Webhook.
 */
async function sendViaGmailWebhook(email, subject, htmlContent, textContent) {
  const webhookUrl = process.env.GMAIL_WEBHOOK_URL;
  if (!webhookUrl) return null;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email.trim().toLowerCase(),
        subject,
        html: htmlContent,
        text: textContent
      })
    });

    const textRes = await res.text();
    let jsonRes;
    try {
      jsonRes = JSON.parse(textRes);
    } catch {
      jsonRes = { status: res.ok ? 'ok' : 'error', raw: textRes };
    }

    if (jsonRes.status === 'ok' || res.ok) {
      console.log(`[OTP] Email delivery accepted by Gmail Webhook for ${maskEmail(email)}`);
      return { success: true, provider: 'gmail_webhook' };
    }

    console.warn('[Gmail Webhook Non-OK]:', textRes);
    return null;
  } catch (err) {
    console.warn('[Gmail Webhook Fetch Error]:', err.message);
    return null;
  }
}

/**
 * Delivers an email OTP using Resend or Gmail Apps Script Webhook.
 * 
 * @param {string} email - Destination Sanjivani email
 * @param {string} otp - 6-digit verification code
 * @param {object} [options] - Optional custom subject/purpose
 * @returns {Promise<{success: boolean, provider: string, id?: string}>}
 */
async function sendEmailOtp(email, otp, options = {}) {
  // In automated test environments (MOCK_OTP_DELIVERY=true), simulate delivery without hitting provider limits
  if (process.env.MOCK_OTP_DELIVERY === 'true') {
    console.log(`[OTP] Email delivery simulated for test recipient ${maskEmail(email)}`);
    return {
      success: true,
      provider: 'mock',
      id: `mock-email-${Date.now()}`
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const fromAddress = process.env.RESEND_FROM || 'Campus Radar <onboarding@resend.dev>';
  const subject = options.subject || 'Campus Radar — Verify Your Email';
  const purpose = options.purpose || 'registration';

  const htmlContent = buildOtpEmailHtml({ otp, purpose });
  const textContent = `Your Campus Radar verification code is ${otp}. It expires in 10 minutes. Never share this code with anyone.`;

  // If Resend is using sandbox onboarding@resend.dev, it can only send to the account owner (shlokborawake93@gmail.com).
  // If the recipient is a student address (@sanjivani.edu.in) and Gmail Webhook is available, send via Gmail Webhook directly!
  const isResendSandbox = fromAddress.includes('onboarding@resend.dev');
  const isOwnerEmail = cleanEmail === 'shlokborawake93@gmail.com';

  if (isResendSandbox && !isOwnerEmail && process.env.GMAIL_WEBHOOK_URL) {
    const webhookRes = await sendViaGmailWebhook(cleanEmail, subject, htmlContent, textContent);
    if (webhookRes) return webhookRes;
  }

  // Attempt Resend delivery
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: [cleanEmail],
        subject,
        html: htmlContent,
        text: textContent
      });

      if (!error && data?.id) {
        console.log(`[OTP] Email delivery accepted by Resend for ${maskEmail(cleanEmail)} (ID: ${data.id})`);
        return {
          success: true,
          provider: 'resend',
          id: data.id
        };
      }

      console.warn('[Resend Rejected Request]:', error?.message || error);

      // If Resend failed with domain restriction / validation error, fallback to Gmail Webhook if available
      if (process.env.GMAIL_WEBHOOK_URL) {
        const fallbackRes = await sendViaGmailWebhook(cleanEmail, subject, htmlContent, textContent);
        if (fallbackRes) return fallbackRes;
      }

      const deliveryErr = new Error(error?.message || 'Failed to deliver email verification code');
      deliveryErr.code = 'EMAIL_DELIVERY_FAILED';
      deliveryErr.details = error?.message;
      throw deliveryErr;
    } catch (err) {
      if (err.code === 'EMAIL_DELIVERY_FAILED') throw err;

      // Fallback on unexpected exception
      if (process.env.GMAIL_WEBHOOK_URL) {
        const fallbackRes = await sendViaGmailWebhook(cleanEmail, subject, htmlContent, textContent);
        if (fallbackRes) return fallbackRes;
      }

      console.error('[Resend Exception]:', err.message);
      const customErr = new Error('Unable to send verification code. Please try again.');
      customErr.code = 'EMAIL_DELIVERY_FAILED';
      throw customErr;
    }
  }

  // If no Resend API key, try Gmail Webhook
  if (process.env.GMAIL_WEBHOOK_URL) {
    const webhookRes = await sendViaGmailWebhook(cleanEmail, subject, htmlContent, textContent);
    if (webhookRes) return webhookRes;
  }

  const err = new Error('No email delivery provider is configured');
  err.code = 'PROVIDER_CONFIGURATION_ERROR';
  throw err;
}

module.exports = {
  sendEmailOtp,
  maskEmail
};
