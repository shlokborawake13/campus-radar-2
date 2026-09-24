/**
 * Normalizes an Indian phone number to standard E.164 format (+91XXXXXXXXXX).
 * 
 * @param {string} phone 
 * @returns {string} E.164 formatted phone number
 */
function normalizeToE164(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return `+91${digitsOnly.slice(1)}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return `+${digitsOnly}`;
  }
  if (phone.startsWith('+')) {
    return `+${digitsOnly}`;
  }
  return `+${digitsOnly}`;
}

/**
 * Masks a phone number for safe server-side logging.
 * e.g., +919373047518 -> +91 ******7518
 */
function maskPhone(phone) {
  if (!phone) return '';
  const normalized = normalizeToE164(phone);
  if (normalized.length < 6) return normalized;
  const lastFour = normalized.slice(-4);
  return `+91 ******${lastFour}`;
}

/**
 * Delivers a phone OTP via TextBee SMS Gateway API.
 * 
 * @param {string} phoneNumber - Recipient Indian mobile number
 * @param {string} otp - 6-digit verification code
 * @returns {Promise<{success: boolean, provider: string, batchId?: string}>}
 */
async function sendSmsOtp(phoneNumber, otp) {
  // In automated test environments (MOCK_OTP_DELIVERY=true), simulate delivery without hitting provider limits
  if (process.env.MOCK_OTP_DELIVERY === 'true') {
    console.log('[SMS OTP] Delivery request accepted (simulated)');
    return {
      success: true,
      provider: 'mock',
      sid: `mock-sms-${Date.now()}`
    };
  }

  const apiKey = process.env.TEXTBEE_API_KEY;
  if (!apiKey) {
    console.error('[SMS OTP] Delivery failed: TEXTBEE_API_KEY is not configured');
    const err = new Error('SMS service is not configured');
    err.code = 'PROVIDER_CONFIGURATION_ERROR';
    throw err;
  }

  const normalizedPhone = normalizeToE164(phoneNumber);
  if (!normalizedPhone || normalizedPhone.length < 12) {
    console.error('[SMS OTP] Delivery failed: Invalid recipient phone number');
    const err = new Error('Invalid destination phone number');
    err.code = 'SMS_DELIVERY_FAILED';
    throw err;
  }

  // Exact required message format: "OTP ${otp}"
  const messageBody = `OTP ${otp}`;

  try {
    const response = await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipients: [normalizedPhone],
        message: messageBody
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && (data?.data?.success || data?.success)) {
      console.log('[SMS OTP] Delivery request accepted');
      return {
        success: true,
        provider: 'textbee',
        batchId: data?.data?.smsBatchId || data?.smsBatchId || 'ok'
      };
    }

    console.error('[SMS OTP] Delivery failed');
    const customErr = new Error('Unable to send SMS verification code. Please try again.');
    customErr.code = 'SMS_DELIVERY_FAILED';
    throw customErr;
  } catch (err) {
    if (err.code === 'SMS_DELIVERY_FAILED' || err.code === 'PROVIDER_CONFIGURATION_ERROR') {
      throw err;
    }
    console.error('[SMS OTP] Delivery failed');
    const customErr = new Error('Unable to send SMS verification code. Please try again.');
    customErr.code = 'SMS_DELIVERY_FAILED';
    throw customErr;
  }
}

// Export sendSmsOtp as the primary function, and sendPhoneOtp for compatibility
module.exports = {
  sendSmsOtp,
  sendPhoneOtp: sendSmsOtp,
  normalizeToE164,
  maskPhone
};
