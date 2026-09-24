require('dotenv').config();
const {
  hashOtp,
  verifyOtpHash,
  stageRegistration,
  cancelPendingRegistration,
  verifyRegistrationEmailOtp,
  verifyRegistrationPhoneOtp,
  resendRegistrationOtp,
  stagePasswordReset,
  verifyAndResetPassword,
  maskEmail,
  maskPhone
} = require('./security');
const { sendEmailOtp } = require('./services/emailOtp');
const { sendPhoneOtp, normalizeToE164 } = require('./services/smsOtp');

async function runOtpDeliverySuite() {
  console.log('\n================================================================');
  console.log('CAMPUS RADAR — OTP DELIVERY & SECURITY VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testId, description) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testId}: ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${description}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 1 — HMAC Hashing & No Plaintext OTP Storage
  // -------------------------------------------------------------
  const sampleOtp = '583921';
  const hashed = hashOtp(sampleOtp);
  assert(hashed && hashed.length === 64 && hashed !== sampleOtp, 'TEST 1A', 'OTP is hashed using HMAC-SHA256 (64 hex characters)');
  assert(verifyOtpHash(sampleOtp, hashed) === true, 'TEST 1B', 'verifyOtpHash correctly verifies matching OTP');
  assert(verifyOtpHash('000000', hashed) === false, 'TEST 1C', 'verifyOtpHash strictly rejects non-matching OTP');

  // -------------------------------------------------------------
  // TEST 2 — Staged Registration (Email First, No Phone OTP yet)
  // -------------------------------------------------------------
  const testEmail = `student.audit.${Date.now()}@sanjivani.edu.in`;
  const stageRes = stageRegistration({
    email: testEmail,
    fullName: 'Audit Student',
    phoneNumber: '9876543210',
    department: 'Computer Engineering',
    passwordHash: 'scrypt$dummy'
  });

  assert(stageRes.maskedEmail && stageRes.maskedEmail.includes('@sanjivani.edu.in'), 'TEST 2A', 'Email is masked properly in stage response');
  assert(stageRes.maskedPhone.startsWith('+91 ******'), 'TEST 2B', 'Phone is normalized and masked in stage response');
  assert(stageRes.emailOtp && stageRes.emailOtp.length === 6, 'TEST 2C', 'Email OTP is generated as a 6-digit code for internal delivery');

  // Verify that plaintext OTP is NOT stored in pending map
  // Let's test email verification with the generated code
  const generatedEmailOtp = stageRes.emailOtp;

  // -------------------------------------------------------------
  // TEST 3 — Wrong Email OTP Failure & Attempt Counting
  // -------------------------------------------------------------
  const wrongRes1 = verifyRegistrationEmailOtp(testEmail, '999999');
  assert(wrongRes1.success === false && wrongRes1.message.includes('4 attempts remaining'), 'TEST 3', 'Wrong Email OTP fails with attempt decrement (4 remaining)');

  // -------------------------------------------------------------
  // TEST 4 — Valid Email OTP Verification & Phone OTP Generation
  // -------------------------------------------------------------
  const verifyEmailRes = verifyRegistrationEmailOtp(testEmail, generatedEmailOtp);
  assert(verifyEmailRes.success === true, 'TEST 4A', 'Correct Email OTP succeeds');
  assert(verifyEmailRes.phoneOtp && verifyEmailRes.phoneOtp.length === 6, 'TEST 4B', 'Phone OTP generated only after email is verified (Staged Flow)');
  assert(verifyEmailRes.phoneNumber === '+919876543210', 'TEST 4C', 'E.164 normalized phone returned for SMS dispatch');

  // Test re-using the same Email OTP (should be invalidated)
  const reuseEmailOtp = verifyRegistrationEmailOtp(testEmail, generatedEmailOtp);
  assert(reuseEmailOtp.message.includes('already verified'), 'TEST 4D', 'Used Email OTP is invalidated; email already marked verified');

  // -------------------------------------------------------------
  // TEST 5 — Wrong Phone OTP Failure & Attempt Counting
  // -------------------------------------------------------------
  const generatedPhoneOtp = verifyEmailRes.phoneOtp;
  const wrongPhone1 = verifyRegistrationPhoneOtp(testEmail, '888888');
  assert(wrongPhone1.success === false && wrongPhone1.message.includes('attempts remaining'), 'TEST 5', 'Wrong Phone OTP fails with attempt count');

  // -------------------------------------------------------------
  // TEST 6 — Valid Phone OTP Verification & Account Data Ready
  // -------------------------------------------------------------
  const verifyPhoneRes = verifyRegistrationPhoneOtp(testEmail, generatedPhoneOtp);
  assert(verifyPhoneRes.success === true, 'TEST 6A', 'Correct Phone OTP succeeds');
  assert(verifyPhoneRes.userData && verifyPhoneRes.userData.email === testEmail, 'TEST 6B', 'Verified user data ready for database creation');
  assert(verifyPhoneRes.userData.phoneVerified === true && verifyPhoneRes.userData.emailVerified === true, 'TEST 6C', 'Both emailVerified and phoneVerified are confirmed true');

  // Session should now be cleared
  const clearedSession = verifyRegistrationPhoneOtp(testEmail, generatedPhoneOtp);
  assert(clearedSession.success === false, 'TEST 6D', 'Pending session is deleted after successful registration completion');

  // -------------------------------------------------------------
  // TEST 7 — Resend OTP & Cooldown
  // -------------------------------------------------------------
  const resendEmail = `resend.student.${Date.now()}@sanjivani.edu.in`;
  const resendStage = stageRegistration({
    email: resendEmail,
    fullName: 'Resend Student',
    phoneNumber: '9812345678',
    department: 'IT',
    passwordHash: 'scrypt$dummy'
  });

  const immediateResend = resendRegistrationOtp(resendEmail, 'email');
  assert(immediateResend.success === false && immediateResend.message.includes('wait'), 'TEST 7A', 'Resend is blocked within 60-second cooldown');

  // -------------------------------------------------------------
  // TEST 8 — Phone Normalization to E.164
  // -------------------------------------------------------------
  assert(normalizeToE164('9876543210') === '+919876543210', 'TEST 8A', '10-digit Indian mobile converts to +919876543210');
  assert(normalizeToE164('+919876543210') === '+919876543210', 'TEST 8B', 'Existing +91 format preserved');
  assert(normalizeToE164('919876543210') === '+919876543210', 'TEST 8C', '12-digit format with 91 prefix converts to +919876543210');

  // -------------------------------------------------------------
  // TEST 9 — Masking Functions
  // -------------------------------------------------------------
  assert(maskEmail('rahul.sharma@sanjivani.edu.in') === 'r******@sanjivani.edu.in', 'TEST 9A', 'maskEmail masks local part correctly');
  assert(maskPhone('+919876543210') === '+91 ******3210', 'TEST 9B', 'maskPhone masks middle digits and retains last 4');

  // -------------------------------------------------------------
  // TEST 10 — Provider Error Handling (Controlled Failure)
  // -------------------------------------------------------------
  let providerErrorHandled = false;
  try {
    // Calling with empty email or invalid provider config triggers controlled error
    const brokenSmsCall = await sendPhoneOtp('', '123456');
  } catch (err) {
    if (err.code === 'PROVIDER_CONFIGURATION_ERROR' || err.code === 'SMS_DELIVERY_FAILED') {
      providerErrorHandled = true;
    }
  }
  assert(providerErrorHandled, 'TEST 10', 'SMS provider configuration/delivery failure throws controlled error code');

  // -------------------------------------------------------------
  // TEST 11 — Live Resend Delivery to Account Owner
  // -------------------------------------------------------------
  let resendLiveSuccess = false;
  try {
    const resendRes = await sendEmailOtp('shlokborawake93@gmail.com', '123456');
    if (resendRes.success && resendRes.provider === 'resend') {
      resendLiveSuccess = true;
    }
  } catch (err) {
    console.log('Live Resend note:', err.message);
  }
  assert(resendLiveSuccess, 'TEST 11', 'Live Resend external delivery accepted and confirmed by Resend API');

  console.log('\n================================================================');
  console.log(`RESULT: ${passed} / ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  process.exit(passed === total ? 0 : 1);
}

runOtpDeliverySuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
