import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Lock,
  Mail,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  ChevronLeft,
  Radio
} from 'lucide-react';
import LegalModal from '../components/LegalModal';
import { apiService } from '../services/api';

export default function AuthView({ onAuthenticated }) {
  // Mode: 'login' | 'register' | 'verify_email' | 'verify_phone' | 'forgot_password'
  const [mode, setMode] = useState('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Registration specific
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState(null);

  // OTP Verification specific
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputsRef = useRef([]);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Forgot password specific
  const [resetOtp, setResetOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState('request'); // 'request' | 'reset'

  // UX Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Cooldown countdown timer
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => Math.max(prev - 1, 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleOtpChange = (index, value, isReset = false) => {
    if (value.length > 1) {
      // Paste support
      const pasted = value.slice(0, 6).split('');
      const targetState = isReset ? [...resetOtp] : [...otp];
      for (let i = 0; i < 6; i++) {
        if (pasted[i]) targetState[i] = pasted[i];
      }
      if (isReset) setResetOtp(targetState);
      else setOtp(targetState);
      return;
    }

    const currentList = isReset ? [...resetOtp] : [...otp];
    currentList[index] = value;
    if (isReset) setResetOtp(currentList);
    else setOtp(currentList);

    // Auto-advance
    if (value && index < 5 && otpInputsRef.current[index + 1]) {
      otpInputsRef.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0 && otpInputsRef.current[index - 1]) {
      otpInputsRef.current[index - 1].focus();
    }
  };

  // Immediate frontend institutional validation
  const validateDomain = (address) => {
    if (!address) return false;
    return address.trim().toLowerCase().endsWith('@sanjivani.edu.in');
  };

  // -----------------------------------------------------------------
  // 1. LOGIN HANDLER
  // -----------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!email || !password) {
      setErrorMessage('Please fill in both your Sanjivani email and password.');
      return;
    }

    if (!validateDomain(email)) {
      setErrorMessage('Only official @sanjivani.edu.in university accounts are allowed.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiService.login({
        email: email.trim(),
        password,
        remember: rememberDevice
      });

      if (res.success && res.user) {
        onAuthenticated(res.user);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------------------------------------------
  // 2. REGISTRATION INITIATE HANDLER
  // -----------------------------------------------------------------
  const handleRegisterInitiate = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!validateDomain(email)) {
      setErrorMessage('Must be an official @sanjivani.edu.in institutional address.');
      return;
    }

    const cleanPhone = phoneNumber.replace(/[\s\-()]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage('Please provide a valid Indian phone number (+91 XXXXX XXXXX).');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage('Password must contain both letters and numbers.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiService.registerInitiate({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: cleanPhone,
        department: department || null,
        password,
        confirmPassword,
        termsAccepted
      });

      if (res.success) {
        setMaskedEmail(res.maskedEmail);
        setMaskedPhone(res.maskedPhone);
        setCooldown(res.cooldownSeconds || 60);
        setOtp(['', '', '', '', '', '']);
        setMode('verify_email');
        setSuccessMessage(res.message);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit registration.');
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------------------------------------------
  // 3. EMAIL OTP VERIFY HANDLER
  // -----------------------------------------------------------------
  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    clearMessages();

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiService.verifyEmailOtp({
        email: email.trim().toLowerCase(),
        otp: otpCode
      });

      if (res.success) {
        setOtp(['', '', '', '', '', '']);
        setCooldown(60);
        setMode('verify_phone');
        setSuccessMessage(res.message);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------------------------------------------
  // 4. PHONE OTP VERIFY & ACCOUNT ACTIVATION HANDLER
  // -----------------------------------------------------------------
  const handleVerifyPhone = async (e) => {
    e.preventDefault();
    clearMessages();

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setErrorMessage('Please enter the full 6-digit phone verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiService.verifyPhoneOtp({
        email: email.trim().toLowerCase(),
        otp: otpCode
      });

      if (res.success && res.user) {
        setSuccessMessage('Account activated successfully! Redirecting to Campus Radar...');
        setTimeout(() => {
          onAuthenticated(res.user);
        }, 600);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Phone verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------------------------------------------
  // 5. RESEND OTP HANDLER
  // -----------------------------------------------------------------
  const handleResendOtp = async (type) => {
    if (cooldown > 0) return;
    clearMessages();
    setIsLoading(true);
    try {
      const res = await apiService.resendRegistrationOtp({
        email: email.trim().toLowerCase(),
        type
      });
      if (res.success) {
        setCooldown(60);
        setSuccessMessage(res.message);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Could not resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------------------------------------------
  // 6. FORGOT PASSWORD HANDLER
  // -----------------------------------------------------------------
  const handleForgotInitiate = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!validateDomain(email)) {
      setErrorMessage('Must be an official @sanjivani.edu.in address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiService.forgotPasswordInitiate(email.trim().toLowerCase());
      setMaskedEmail(res.maskedEmail || email);
      setForgotStep('reset');
      setCooldown(60);
      setSuccessMessage(res.message);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotReset = async (e) => {
    e.preventDefault();
    clearMessages();

    const code = resetOtp.join('');
    if (code.length !== 6) {
      setErrorMessage('Please enter the 6-digit reset code.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiService.resetPassword({
        email: email.trim().toLowerCase(),
        otp: code,
        newPassword,
        confirmPassword: confirmNewPassword
      });

      if (res.success) {
        setSuccessMessage('Password reset successfully! Please sign in with your new password.');
        setTimeout(() => {
          setMode('login');
          setForgotStep('request');
          setPassword('');
        }, 1500);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-bg flex flex-col justify-center items-center px-4 py-8 select-none">
      {/* Container Card */}
      <div className="w-full max-w-[440px] bg-white rounded-3xl border border-slate-border shadow-soft-card p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
        {/* Official Campus Radar Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm mb-3">
            <Radio className="w-7 h-7 text-primary stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-black text-slate-headline tracking-tight">
            <span className="text-primary font-black">Campus</span>&nbsp;Radar
          </h1>
          <p className="text-[11.5px] font-bold text-primary tracking-wide uppercase mt-1">
            Sanjivani University Collegiate Network
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-tertiary animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[12px] font-medium leading-tight">{errorMessage}</p>
          </div>
        )}

        {/* Global Success Banner */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-primary-dark animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[12px] font-medium leading-tight">{successMessage}</p>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 1: LOGIN                                                 */}
        {/* ============================================================ */}
        {mode === 'login' && (
          <div>
            <div className="mb-5">
              <h2 className="text-[17px] font-bold text-slate-headline">Welcome back</h2>
              <p className="text-[12px] text-slate-meta">Sign in with your verified institutional account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-headline mb-1">
                  Sanjivani College Email <span className="text-tertiary">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearMessages();
                    }}
                    placeholder="you@sanjivani.edu.in"
                    required
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-slate-headline placeholder-slate-meta/70 transition focus:outline-none focus:ring-2 ${
                      email && !validateDomain(email)
                        ? 'border-amber-400 focus:ring-amber-300'
                        : 'border-slate-border focus:ring-primary/40'
                    }`}
                  />
                  <Mail className="w-4 h-4 text-slate-meta absolute right-3.5 top-3" />
                </div>
                <p className="text-[11px] text-slate-meta mt-1">
                  Only official <strong className="text-slate-headline">@sanjivani.edu.in</strong> accounts are allowed.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[12px] font-bold text-slate-headline">
                    Password <span className="text-tertiary">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setMode('forgot_password');
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearMessages();
                    }}
                    placeholder="•••••••••••"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-border text-[13px] text-slate-headline placeholder-slate-meta/70 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-meta hover:text-slate-headline"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-slate-border focus:ring-primary"
                />
                <label htmlFor="remember" className="ml-2 text-[12px] font-medium text-slate-body">
                  Remember this device
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-[14px] shadow-emerald-fab flex items-center justify-center gap-2 transition duration-200 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Login</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="my-5 flex items-center">
              <div className="grow border-t border-slate-border" />
              <span className="shrink-0 px-3 text-[11px] font-bold text-slate-meta uppercase tracking-wider">
                OR
              </span>
              <div className="grow border-t border-slate-border" />
            </div>

            <div className="text-center">
              <p className="text-[12px] text-slate-meta mb-2">Don't have an account?</p>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setMode('register');
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-border hover:bg-slate-subtle text-slate-headline font-bold text-[13px] transition duration-200 active:scale-98"
              >
                Create New Account
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: CREATE NEW ACCOUNT                                    */}
        {/* ============================================================ */}
        {mode === 'register' && (
          <div>
            <button
              onClick={() => {
                clearMessages();
                setMode('login');
              }}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-meta hover:text-slate-headline mb-3"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>

            <div className="mb-4">
              <h2 className="text-[17px] font-bold text-slate-headline">Create your Campus Radar account</h2>
              <p className="text-[12px] text-slate-meta">
                Join the private social network for Sanjivani University students.
              </p>
            </div>

            <form onSubmit={handleRegisterInitiate} className="space-y-3">
              <div>
                <label className="block text-[12px] font-bold text-slate-headline mb-0.5">
                  Full Name <span className="text-tertiary">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline placeholder-slate-meta/70 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <User className="w-4 h-4 text-slate-meta absolute right-3.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-headline mb-0.5">
                  Sanjivani College Email <span className="text-tertiary">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@sanjivani.edu.in"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline placeholder-slate-meta/70 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <Mail className="w-4 h-4 text-slate-meta absolute right-3.5 top-2.5" />
                </div>
                <p className="text-[10px] text-slate-meta mt-0.5">
                  Must be an official @sanjivani.edu.in address.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-headline mb-0.5">
                  Phone Number <span className="text-tertiary">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline placeholder-slate-meta/70 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <Phone className="w-4 h-4 text-slate-meta absolute right-3.5 top-2.5" />
                </div>
                <p className="text-[10px] text-slate-meta mt-0.5">
                  Required for student verification.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-headline mb-0.5">
                  Department / Branch <span className="text-[10px] font-normal text-slate-meta">(Optional)</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Select department / branch</option>
                  <option value="Computer Science">Computer Science & Engineering</option>
                  <option value="Artificial Intelligence & ML">AI & Machine Learning</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics & Telecommunication">Electronics & Telecom</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="Electrical Engineering">Electrical Engineering</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Management & MBA">Management & MBA</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-bold text-slate-headline mb-0.5">
                    Password <span className="text-tertiary">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline placeholder-slate-meta/70 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-headline mb-0.5">
                    Confirm Password <span className="text-tertiary">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline placeholder-slate-meta/70 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="pt-1 flex items-start">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-slate-border focus:ring-primary mt-0.5 cursor-pointer"
                />
                <label htmlFor="terms" className="ml-2 text-[11px] text-slate-body leading-tight">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setLegalModalTab('terms');
                    }}
                    className="font-bold text-primary hover:text-primary-hover hover:underline cursor-pointer"
                  >
                    Terms of Service
                  </button>{' '}
                  and acknowledge the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setLegalModalTab('privacy');
                    }}
                    className="font-bold text-primary hover:text-primary-hover hover:underline cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  .
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-[14px] shadow-emerald-fab flex items-center justify-center gap-2 transition duration-200 active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Validating Credentials...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setMode('login');
                }}
                className="text-[12px] text-slate-meta hover:text-slate-headline"
              >
                Already have an account? <span className="font-bold text-primary">Login</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: EMAIL OTP VERIFICATION                               */}
        {/* ============================================================ */}
        {mode === 'verify_email' && (
          <div>
            <div className="text-center mb-5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-primary mx-auto flex items-center justify-center mb-2">
                <Mail className="w-5 h-5" />
              </div>
              <h2 className="text-[17px] font-bold text-slate-headline">Verify your Sanjivani email</h2>
              <p className="text-[12px] text-slate-meta mt-1">
                We've sent a 6-digit verification code to <br />
                <strong className="text-slate-headline font-mono">{maskedEmail || email}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifyEmail} className="space-y-5">
              <div>
                <label className="block text-[12px] font-bold text-slate-headline text-center mb-2">
                  Enter verification code
                </label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-[18px] font-black font-mono rounded-xl border border-slate-border focus:border-primary focus:ring-2 focus:ring-primary/30 transition text-slate-headline"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-[14px] shadow-emerald-fab flex items-center justify-center gap-2 transition duration-200 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify Email</span>
                )}
              </button>

              <div className="text-center pt-1">
                {cooldown > 0 ? (
                  <p className="text-[11px] text-slate-meta">
                    Didn't receive the code? Resend code in <span className="font-bold font-mono text-slate-headline">{cooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleResendOtp('email')}
                    disabled={isLoading}
                    className="text-[12px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Resend verification code
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 4: PHONE OTP VERIFICATION                               */}
        {/* ============================================================ */}
        {mode === 'verify_phone' && (
          <div>
            <div className="text-center mb-5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-primary mx-auto flex items-center justify-center mb-2">
                <Phone className="w-5 h-5" />
              </div>
              <h2 className="text-[17px] font-bold text-slate-headline">Verify your phone number</h2>
              <p className="text-[12px] text-slate-meta mt-1">
                We've sent a verification code to <br />
                <strong className="text-slate-headline font-mono">{maskedPhone || phoneNumber}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifyPhone} className="space-y-5">
              <div>
                <label className="block text-[12px] font-bold text-slate-headline text-center mb-2">
                  Enter 6-digit phone code
                </label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputsRef.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-[18px] font-black font-mono rounded-xl border border-slate-border focus:border-primary focus:ring-2 focus:ring-primary/30 transition text-slate-headline"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-[14px] shadow-emerald-fab flex items-center justify-center gap-2 transition duration-200 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Activating Student Identity...</span>
                  </>
                ) : (
                  <span>Verify Phone & Activate</span>
                )}
              </button>

              <div className="text-center pt-1">
                {cooldown > 0 ? (
                  <p className="text-[11px] text-slate-meta">
                    Resend code in <span className="font-bold font-mono text-slate-headline">{cooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleResendOtp('phone')}
                    disabled={isLoading}
                    className="text-[12px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 5: FORGOT PASSWORD                                      */}
        {/* ============================================================ */}
        {mode === 'forgot_password' && (
          <div>
            <button
              onClick={() => {
                clearMessages();
                setMode('login');
              }}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-meta hover:text-slate-headline mb-3"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>

            <div className="mb-4">
              <h2 className="text-[17px] font-bold text-slate-headline">Reset Password</h2>
              <p className="text-[12px] text-slate-meta">
                {forgotStep === 'request'
                  ? 'Enter your Sanjivani email to receive a password reset verification code.'
                  : `Enter the 6-digit code sent to ${maskedEmail} and choose a new password.`}
              </p>
            </div>

            {forgotStep === 'request' ? (
              <form onSubmit={handleForgotInitiate} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-slate-headline mb-1">
                    Sanjivani College Email <span className="text-tertiary">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@sanjivani.edu.in"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-[14px] shadow-emerald-fab flex items-center justify-center gap-2 transition duration-200 active:scale-98 disabled:opacity-50"
                >
                  {isLoading ? 'Sending Reset Code...' : 'Send Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotReset} className="space-y-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-headline text-center mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <div className="flex justify-center gap-1.5">
                    {resetOtp.map((digit, idx) => (
                      <input
                        key={idx}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value, true)}
                        className="w-10 h-11 text-center text-[16px] font-bold font-mono rounded-xl border border-slate-border text-slate-headline"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-headline mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters, letter + number"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-slate-headline mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-[14px] shadow-emerald-fab flex items-center justify-center gap-2 transition duration-200 active:scale-98 disabled:opacity-50"
                  >
                    {isLoading ? 'Resetting Password...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Safety Notice Footer */}
      <div className="mt-6 text-center text-[11px] text-slate-meta max-w-sm flex items-center justify-center gap-1.5">
        <Lock className="w-3.5 h-3.5 text-primary" />
        <span>End-to-end encrypted student isolation & verified institutional authentication.</span>
      </div>

      {/* Terms of Service & Privacy Policy Modal */}
      <LegalModal
        isOpen={!!legalModalTab}
        initialTab={legalModalTab || 'terms'}
        onClose={() => setLegalModalTab(null)}
      />
    </div>
  );
}
