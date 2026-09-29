import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import LogoMark from "@/components/layout/LogoMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initMsg91Sdk,
  sendMsg91Otp,
  verifyMsg91Otp,
  retryMsg91Otp,
} from "@/services/msg91Otp";
import {
  verifyForgotPasswordOtp,
  submitPasswordReset,
} from "@/lib/session";

type Step = "PHONE_ENTRY" | "CREATE_PASSWORD" | "SUCCESS";
type PhoneOtpState = "IDLE" | "SENDING" | "OTP_SENT" | "VERIFYING" | "RESENDING";

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Multi-step progression
  const [step, setStep] = useState<Step>("PHONE_ENTRY");

  // Step 1: Phone & OTP states
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneOtpState, setPhoneOtpState] = useState<PhoneOtpState>("IDLE");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [reqId, setReqId] = useState<string | undefined>(undefined);
  const [resendTimer, setResendTimer] = useState(0);

  // Authoritative password reset authorization token issued by backend
  const [resetToken, setResetToken] = useState<string | null>(null);

  // Step 2: New Password states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // OTP 6-box input refs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load and initialize MSG91 SDK once on mount
  useEffect(() => {
    initMsg91Sdk("kotson-msg91-captcha");
  }, []);

  // Resend Countdown Timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if ((phoneOtpState === "OTP_SENT" || phoneOtpState === "RESENDING") && resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [phoneOtpState, resendTimer]);

  // Clean phone input: retain only digits, max 10
  const handlePhoneChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, "").slice(0, 10);
    setPhone(digitsOnly);
    if (phoneError) setPhoneError("");

    // Reset OTP verification if phone number changes
    if (phoneOtpState !== "IDLE") {
      setPhoneOtpState("IDLE");
      setOtpDigits(["", "", "", "", "", ""]);
      setReqId(undefined);
      setOtpError("");
    }
  };

  // Send OTP handler
  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      setPhoneError("Enter a valid 10-digit mobile number.");
      return;
    }
    setPhoneError("");
    setOtpError("");
    setPhoneOtpState("SENDING");

    try {
      const res = await sendMsg91Otp(phone);
      if (res.success) {
        setPhoneOtpState("OTP_SENT");
        setReqId(res.reqId);
        setResendTimer(30);
        setOtpDigits(["", "", "", "", "", ""]);
        toast.success("Verification code sent to your phone");
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
      } else {
        setPhoneOtpState("IDLE");
        const msg = res.error || "We couldn't send the verification code. Please try again.";
        setOtpError(msg);
        toast.error(msg);
      }
    } catch {
      setPhoneOtpState("IDLE");
      setOtpError("We couldn't send the verification code. Please try again.");
    }
  };

  // Resend / Retry OTP handler
  const handleRetryOtp = async () => {
    if (resendTimer > 0 || phoneOtpState === "RESENDING" || phoneOtpState === "SENDING") return;
    setOtpError("");
    setPhoneOtpState("RESENDING");

    try {
      const res = await retryMsg91Otp(reqId);
      if (res.success) {
        setPhoneOtpState("OTP_SENT");
        if (res.reqId) setReqId(res.reqId);
        setResendTimer(30);
        setOtpDigits(["", "", "", "", "", ""]);
        toast.success("New verification code sent");
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
      } else {
        setPhoneOtpState("OTP_SENT");
        const msg = res.error || "Could not resend verification code. Please wait before trying again.";
        setOtpError(msg);
        toast.error(msg);
      }
    } catch {
      setPhoneOtpState("OTP_SENT");
      setOtpError("Could not resend verification code. Please try again.");
    }
  };

  // Verify OTP handler
  const handleVerifyOtp = async () => {
    const fullOtp = otpDigits.join("").trim();
    if (fullOtp.length !== 6) {
      setOtpError("Please enter the complete 6-digit OTP.");
      return;
    }
    setOtpError("");
    setPhoneOtpState("VERIFYING");

    try {
      // 1. Client-side verification with MSG91 Custom Web SDK
      const res = await verifyMsg91Otp(fullOtp, reqId);
      if (!res.success || !res.token) {
        setPhoneOtpState("OTP_SENT");
        const msg = res.error || "The verification code is incorrect. Please try again.";
        setOtpError(msg);
        toast.error(msg);
        return;
      }

      // 2. Authoritative Server-Side MSG91 Verification & Password Reset Authorization
      const verifyRes = await verifyForgotPasswordOtp({
        phone: `+91${phone}`,
        msg91_verification_token: res.token,
        msg91_request_id: res.reqId,
      });

      if (verifyRes.ok && verifyRes.reset_token) {
        setResetToken(verifyRes.reset_token);
        setStep("CREATE_PASSWORD");
        toast.success("Phone verified. Please enter your new password.");
      } else {
        setPhoneOtpState("OTP_SENT");
        setOtpError("Verification failed on the server. Please try again.");
        toast.error("Verification failed on the server. Please try again.");
      }
    } catch (err: any) {
      setPhoneOtpState("OTP_SENT");
      const errorMsg =
        err?.message || "Verification failed. Please check the OTP and try again.";
      setOtpError(errorMsg);
      toast.error(errorMsg);
    }
  };

  // Handle individual digit input change
  const handleOtpDigitChange = (index: number, val: string) => {
    const char = val.slice(-1).replace(/\D/g, "");
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);
    if (otpError) setOtpError("");

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation in OTP boxes
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste full 6-digit OTP
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    }
  };

  // Handle Reset Password Submission
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) {
      toast.error("Password reset session expired. Please start again.");
      setStep("PHONE_ENTRY");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordError("");
    setIsResetting(true);

    try {
      const res = await submitPasswordReset({
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (res.ok) {
        setResetToken(null);
        setStep("SUCCESS");
        toast.success("Your password has been updated successfully.");
      } else {
        toast.error(res.message || "Unable to reset your password right now. Please try again.");
      }
    } catch (err: any) {
      const msg = err?.message || "Unable to reset your password right now. Please try again.";
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-[#FBF9F5]">
      <AuthBrandPanel
        eyebrow="ACCOUNT RECOVERY"
        heading="Better sleep starts naturally."
        description="Reset your password securely with phone verification."
      />

      <div className="flex flex-col justify-center px-4 py-8 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[440px] bg-white sm:rounded-2xl p-6 sm:p-8 sm:shadow-sm sm:border sm:border-stone-200/80">
          <Link to="/" className="lg:hidden inline-block mb-4" aria-label="Kotson Home">
            <LogoMark className="w-[140px] sm:w-[160px]" />
          </Link>

          {/* SCREEN 1: PHONE NUMBER & OTP */}
          {step === "PHONE_ENTRY" && (
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                Forgot password?
              </h1>
              <p className="mt-1.5 text-xs text-neutral-500">
                Enter the phone number linked to your Kotson account.
              </p>

              <div className="mt-6 space-y-4">
                {/* Phone Number Field */}
                <div>
                  <Label htmlFor="forgot-phone" className="text-xs font-semibold text-neutral-800">
                    Phone number <span className="text-rose-500">*</span>
                  </Label>
                  <div className="mt-1.5 flex rounded-md border border-stone-200 bg-white overflow-hidden shadow-xs focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20">
                    <span className="inline-flex items-center px-3.5 text-xs font-semibold text-neutral-600 bg-stone-100/80 border-r border-stone-200 select-none">
                      +91
                    </span>
                    <input
                      id="forgot-phone"
                      name="tel"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="Enter your 10-digit phone number"
                      required
                      autoComplete="tel"
                      disabled={phoneOtpState === "OTP_SENT" || phoneOtpState === "VERIFYING"}
                      className="flex-1 h-11 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 placeholder:font-normal outline-none bg-transparent disabled:bg-stone-50"
                      data-testid="forgot-password-phone-input"
                    />
                  </div>
                  {phoneError && (
                    <p className="mt-1 text-xs text-rose-600 font-medium" data-testid="forgot-phone-error">
                      {phoneError}
                    </p>
                  )}

                  {/* Dedicated CAPTCHA container if required by MSG91 widget */}
                  <div id="kotson-msg91-captcha" className="empty:hidden my-2"></div>

                  {/* Action button: SEND OTP */}
                  {phoneOtpState !== "OTP_SENT" && phoneOtpState !== "VERIFYING" && phoneOtpState !== "RESENDING" && (
                    <Button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={phone.length !== 10 || phoneOtpState === "SENDING"}
                      className="mt-3.5 w-full h-11 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold tracking-wide uppercase text-xs shadow-xs transition-colors"
                      data-testid="forgot-password-send-otp-button"
                    >
                      {phoneOtpState === "SENDING" ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          SENDING...
                        </span>
                      ) : (
                        "SEND OTP"
                      )}
                    </Button>
                  )}
                </div>

                {/* OTP Section (Visible after OTP is requested) */}
                {(phoneOtpState === "OTP_SENT" || phoneOtpState === "VERIFYING" || phoneOtpState === "RESENDING") && (
                  <div className="p-4 rounded-xl border border-stone-200/90 bg-[#FAF8F5]/80 space-y-3.5 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs text-neutral-500">We&apos;ve sent a verification code to:</span>
                        <span className="text-xs font-semibold text-neutral-800 mt-0.5">
                          +91 ••••••{phone.slice(6)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPhoneOtpState("IDLE");
                          setOtpDigits(["", "", "", "", "", ""]);
                          setOtpError("");
                        }}
                        className="text-xs text-[#7C9C59] hover:text-[#6c8a4c] font-medium underline cursor-pointer"
                        data-testid="forgot-password-change-phone-button"
                      >
                        Change
                      </button>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-neutral-800 mb-1.5 block">
                        OTP <span className="text-rose-500">*</span>
                      </Label>
                      <div
                        className="flex items-center justify-between gap-1.5 sm:gap-2 max-w-[340px]"
                        onPaste={handleOtpPaste}
                      >
                        {otpDigits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => {
                              otpInputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            aria-label={`Digit ${index + 1} of OTP`}
                            className="w-10 sm:w-11 h-12 text-center text-lg font-semibold text-neutral-900 rounded-lg border border-stone-300 bg-white focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 outline-none transition-all shadow-xs"
                            data-testid={`forgot-otp-input-${index}`}
                          />
                        ))}
                      </div>
                      {otpError && (
                        <p className="mt-1.5 text-xs text-rose-600 font-medium" data-testid="forgot-otp-error">
                          {otpError}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpDigits.join("").trim().length !== 6 || phoneOtpState === "VERIFYING"}
                        className="h-9 px-4 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold tracking-wide uppercase transition-colors"
                        data-testid="forgot-password-verify-otp-button"
                      >
                        {phoneOtpState === "VERIFYING" ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            VERIFYING...
                          </span>
                        ) : (
                          "VERIFY OTP"
                        )}
                      </Button>

                      <div className="text-xs text-neutral-600">
                        {resendTimer > 0 ? (
                          <span>
                            Resend OTP in <strong className="font-semibold text-neutral-800">{resendTimer}s</strong>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRetryOtp}
                            disabled={phoneOtpState === "RESENDING"}
                            className="font-medium text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                            data-testid="forgot-password-resend-otp-button"
                          >
                            {phoneOtpState === "RESENDING" ? "Resending..." : "Resend OTP"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Secondary CTA: Back to Sign In */}
                <div className="pt-2 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
                    data-testid="back-to-login-link"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 2: CREATE NEW PASSWORD */}
          {step === "CREATE_PASSWORD" && (
            <div>
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-[#7C9C59] mb-3">
                <KeyRound className="w-5 h-5" />
              </div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                Create new password
              </h1>
              <p className="mt-1.5 text-xs text-neutral-500">
                Enter a new secure password for your Kotson account.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleResetPassword} noValidate>
                {/* New Password */}
                <div>
                  <Label htmlFor="new-password" className="text-xs font-semibold text-neutral-800">
                    New password <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="new-password"
                      name="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (passwordError) setPasswordError("");
                      }}
                      placeholder="Create a new password"
                      required
                      autoComplete="new-password"
                      className="h-11 pr-10 text-sm placeholder:text-neutral-400 placeholder:font-normal border-stone-200 focus-visible:ring-emerald-700"
                      data-testid="reset-new-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-500">At least 8 characters.</p>
                </div>

                {/* Confirm New Password */}
                <div>
                  <Label htmlFor="confirm-new-password" className="text-xs font-semibold text-neutral-800">
                    Confirm new password <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="confirm-new-password"
                      name="confirm-new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (passwordError) setPasswordError("");
                      }}
                      placeholder="Re-enter your new password"
                      required
                      autoComplete="new-password"
                      className="h-11 pr-10 text-sm placeholder:text-neutral-400 placeholder:font-normal border-stone-200 focus-visible:ring-emerald-700"
                      data-testid="reset-confirm-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <p className="text-xs text-rose-600 font-medium" data-testid="reset-password-error">
                    {passwordError}
                  </p>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  disabled={isResetting || !newPassword || !confirmPassword}
                  className="w-full h-11 mt-2 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold tracking-wide uppercase text-xs shadow-xs transition-colors"
                  data-testid="reset-password-submit-button"
                >
                  {isResetting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      UPDATING PASSWORD...
                    </span>
                  ) : (
                    "RESET PASSWORD"
                  )}
                </Button>

                {/* Secondary CTA: Back to Sign In */}
                <div className="pt-2 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            </div>
          )}

          {/* SCREEN 3: SUCCESS */}
          {step === "SUCCESS" && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mb-4 shadow-xs">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-neutral-900" data-testid="password-updated-heading">
                Password updated
              </h1>
              <p className="mt-2 text-sm text-neutral-600 max-w-[320px] mx-auto">
                Your password has been updated successfully.
              </p>

              <div className="mt-6">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => navigate("/login")}
                  className="w-full h-11 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold tracking-wide uppercase text-xs shadow-xs transition-colors"
                  data-testid="password-updated-signin-button"
                >
                  SIGN IN
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
