import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { signup } from "@/lib/session";
import { apiGet } from "@/lib/api";
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
import { restorePendingCartItem } from "@/lib/pendingCart";

const REF_KEY = "kotson_ref";

type ReferralStatus = "idle" | "checking" | "valid" | "invalid";
type PhoneOtpState = "IDLE" | "SENDING" | "OTP_SENT" | "VERIFYING" | "VERIFIED" | "RESENDING";

export default function Register() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [refCode, setRefCode] = useState("");
  const [consent, setConsent] = useState(false);

  // OTP Verification States
  const [phoneOtpState, setPhoneOtpState] = useState<PhoneOtpState>("IDLE");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [reqId, setReqId] = useState<string | undefined>(undefined);
  const [verificationToken, setVerificationToken] = useState<string | undefined>(undefined);
  const [verifiedPhone, setVerifiedPhone] = useState<string>("");
  const [resendTimer, setResendTimer] = useState<number>(30);
  const [otpError, setOtpError] = useState<string>("");

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // UI visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation error states
  const [passwordError, setPasswordError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [consentError, setConsentError] = useState("");

  // Referral validation state
  const [referralStatus, setReferralStatus] = useState<ReferralStatus>("idle");
  const [referralMessage, setReferralMessage] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // Validate referral code against server
  const validateCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setReferralStatus("idle");
      setReferralMessage("");
      return;
    }
    setReferralStatus("checking");
    setReferralMessage("Checking referral code...");
    try {
      const res = await apiGet<{ valid: boolean; code?: string; message?: string }>(
        `/auth/validate-referral?code=${encodeURIComponent(trimmed)}`
      );
      if (res.valid) {
        setReferralStatus("valid");
        setReferralMessage("✓ Referral code applied");
      } else {
        setReferralStatus("invalid");
        setReferralMessage(res.message || "Referral code is invalid or unavailable.");
      }
    } catch {
      setReferralStatus("invalid");
      setReferralMessage("Referral code is invalid or unavailable.");
    }
  };

  // Pre-fill referral code from URL or stored attribution on load
  useEffect(() => {
    const fromUrl = params.get("ref") || params.get("referral");
    const storedSession = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(REF_KEY) : null;
    const storedLocal = typeof localStorage !== "undefined" ? localStorage.getItem(REF_KEY) : null;
    const code = (fromUrl || storedSession || storedLocal || "").trim().toUpperCase();
    if (code) {
      setRefCode(code);
      validateCode(code);
    }
  }, [params]);

  // Handle referral code typing with debounce
  const handleRefCodeChange = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setRefCode(upper);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!upper.trim()) {
      setReferralStatus("idle");
      setReferralMessage("");
      return;
    }

    setReferralStatus("checking");
    setReferralMessage("Checking referral code...");
    debounceRef.current = setTimeout(() => {
      validateCode(upper);
    }, 450);
  };

  // Clean phone input: retain only digits, max 10
  // CRITICAL EDGE CASE: If phone changes after OTP sent/verified, invalidate immediately
  const handlePhoneChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, "").slice(0, 10);
    setPhone(digitsOnly);
    if (phoneError) setPhoneError("");

    // Reset OTP verification if phone number changes
    if (phoneOtpState !== "IDLE") {
      setPhoneOtpState("IDLE");
      setOtpDigits(["", "", "", "", "", ""]);
      setVerificationToken(undefined);
      setReqId(undefined);
      setVerifiedPhone("");
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
      const res = await verifyMsg91Otp(fullOtp, reqId);
      if (res.success && res.token) {
        setPhoneOtpState("VERIFIED");
        setVerificationToken(res.token);
        setVerifiedPhone(phone);
        toast.success("Phone number verified successfully");
      } else {
        setPhoneOtpState("OTP_SENT");
        const msg = res.error || "The verification code is incorrect. Please try again.";
        setOtpError(msg);
        toast.error(msg);
      }
    } catch {
      setPhoneOtpState("OTP_SENT");
      setOtpError("The verification code is incorrect. Please try again.");
    }
  };

  // Handle individual digit input change
  const handleOtpDigitChange = (index: number, val: string) => {
    const cleanDigit = val.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanDigit;
    setOtpDigits(newDigits);
    if (otpError) setOtpError("");

    // Auto-advance to next input
    if (cleanDigit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation between boxes
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste full 6-digit OTP
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setOtpDigits(newDigits);
    if (otpError) setOtpError("");

    const nextIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[nextIndex]?.focus();
  };

  // Check if phone number is verified authoritatively in UI state
  const isPhoneVerified = phoneOtpState === "VERIFIED" && verifiedPhone === phone && !!verificationToken;

  // Registration mutation
  const mutation = useMutation({
    mutationFn: () => {
      const canonicalPhone = phone.trim() ? `+91${phone.trim()}` : "";
      return signup({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: canonicalPhone,
        password,
        referral_code: refCode.trim() ? refCode.trim().toUpperCase() : null,
        consent: true,
        msg91_verification_token: verificationToken,
        msg91_request_id: reqId,
      });
    },
    onSuccess: async (out) => {
      qc.clear();

      // Check and restore any pending product from logged-out Add to Cart
      const pendingRes = await restorePendingCartItem();
      if (pendingRes.restored) {
        toast.success(`Account created — ${pendingRes.item?.product_name || "item"} added to your cart`);
        qc.invalidateQueries({ queryKey: ["cart"] });
        navigate("/cart");
        return;
      }

      toast.success(
        out.guest_cart_merged > 0
          ? `Account created — ${out.guest_cart_merged} cart item(s) merged`
          : "Account created successfully"
      );
      const redirect = params.get("redirect") || (out.guest_cart_merged > 0 ? "/cart" : "/account");
      navigate(redirect);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Could not create account";
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validations
    let hasError = false;

    // Validate Full Name
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Please enter your full name (at least 2 characters).");
      hasError = true;
    }

    // Validate Phone Number & OTP verification
    if (phone.length !== 10) {
      setPhoneError("Enter a valid 10-digit mobile number.");
      hasError = true;
    } else if (!isPhoneVerified) {
      setPhoneError("Please verify your phone number with OTP.");
      toast.error("Please verify your mobile number with OTP before creating your account.");
      hasError = true;
    } else {
      setPhoneError("");
    }

    // Validate Password match
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      hasError = true;
    } else if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      hasError = true;
    } else {
      setPasswordError("");
    }

    // Validate Consent
    if (!consent) {
      setConsentError("You must agree to the Terms & Conditions and Privacy Policy.");
      hasError = true;
    } else {
      setConsentError("");
    }

    // Validate Referral Code if entered
    if (refCode.trim()) {
      if (referralStatus === "invalid") {
        toast.error(referralMessage || "Referral code is invalid or unavailable.");
        hasError = true;
      } else if (referralStatus === "checking") {
        toast.info("Please wait while we verify your referral code.");
        hasError = true;
      }
    }

    if (hasError) return;

    mutation.mutate();
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-[#FBF9F5]">
      <AuthBrandPanel
        eyebrow="JOIN KOTSON"
        heading="Your better sleep journey starts here."
        description="Create your Kotson account to manage orders, save addresses and access Refer & Earn."
      />

      <div className="flex flex-col justify-center px-4 py-8 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[440px] bg-white sm:rounded-2xl p-6 sm:p-8 sm:shadow-sm sm:border sm:border-stone-200/80">
          <Link to="/" className="lg:hidden inline-block mb-4" aria-label="Kotson Home">
            <LogoMark className="w-[140px] sm:w-[160px]" />
          </Link>

          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Create your account
          </h1>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div>
              <Label htmlFor="reg-name" className="text-xs font-semibold text-neutral-800">
                Full name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="reg-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
                autoComplete="name"
                className="mt-1.5 h-11 text-sm placeholder:text-neutral-400 placeholder:font-normal border-stone-200 focus-visible:ring-emerald-700"
                data-testid="register-name-input"
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="reg-email" className="text-xs font-semibold text-neutral-800">
                Email <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="reg-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                autoComplete="email"
                className="mt-1.5 h-11 text-sm placeholder:text-neutral-400 placeholder:font-normal border-stone-200 focus-visible:ring-emerald-700"
                data-testid="register-email-input"
              />
            </div>

            {/* Phone Number with +91 prefix and Send OTP button */}
            <div>
              <Label htmlFor="reg-phone" className="text-xs font-semibold text-neutral-800">
                Phone number <span className="text-rose-500">*</span>
              </Label>
              <div className="mt-1.5 flex rounded-md border border-stone-200 bg-white overflow-hidden shadow-xs focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20">
                <span className="inline-flex items-center px-3.5 text-xs font-semibold text-neutral-600 bg-stone-100/80 border-r border-stone-200 select-none">
                  +91
                </span>
                <input
                  id="reg-phone"
                  name="tel"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="Enter your 10-digit phone number"
                  required
                  autoComplete="tel"
                  disabled={isPhoneVerified}
                  className="flex-1 h-11 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 placeholder:font-normal outline-none bg-transparent disabled:bg-stone-50"
                  data-testid="register-phone-input"
                />
              </div>
              {phoneError && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{phoneError}</p>
              )}

              {/* Dedicated CAPTCHA container if required by MSG91 widget */}
              <div id="kotson-msg91-captcha" className="empty:hidden my-2"></div>

              {/* Action button: SEND OTP */}
              {!isPhoneVerified && phoneOtpState !== "OTP_SENT" && phoneOtpState !== "VERIFYING" && phoneOtpState !== "RESENDING" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendOtp}
                  disabled={phone.length !== 10 || phoneOtpState === "SENDING"}
                  className="mt-2.5 w-full h-10 border-stone-300 hover:bg-stone-50 text-neutral-800 text-xs font-semibold tracking-wide uppercase transition-colors"
                  data-testid="register-send-otp-button"
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

            {/* OTP Section (Visible after OTP is requested and phone is not yet verified) */}
            {!isPhoneVerified && (phoneOtpState === "OTP_SENT" || phoneOtpState === "VERIFYING" || phoneOtpState === "RESENDING") && (
              <div className="p-4 rounded-xl border border-stone-200/90 bg-[#FAF8F5]/80 space-y-3.5 transition-all">
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-500">We&apos;ve sent a verification code to:</span>
                  <span className="text-xs font-semibold text-neutral-800 mt-0.5">
                    +91 ••••••{phone.slice(6)}
                  </span>
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
                        data-testid={`otp-input-${index}`}
                      />
                    ))}
                  </div>
                  {otpError && (
                    <p className="mt-1.5 text-xs text-rose-600 font-medium">{otpError}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otpDigits.join("").trim().length !== 6 || phoneOtpState === "VERIFYING"}
                    className="h-9 px-4 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold tracking-wide uppercase transition-colors"
                    data-testid="register-verify-otp-button"
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
                        data-testid="register-resend-otp-button"
                      >
                        {phoneOtpState === "RESENDING" ? "Resending..." : "Resend OTP"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Verified Badge */}
            {isPhoneVerified && (
              <div
                className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/80 text-emerald-800"
                data-testid="phone-verified-badge"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold">✓ Phone number verified</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneOtpState("IDLE");
                    setVerificationToken(undefined);
                    setVerifiedPhone("");
                    setOtpDigits(["", "", "", "", "", ""]);
                  }}
                  className="text-[11px] text-emerald-800/80 hover:text-emerald-950 underline cursor-pointer"
                >
                  Change number
                </button>
              </div>
            )}

            {/* Password */}
            <div>
              <Label htmlFor="reg-password" className="text-xs font-semibold text-neutral-800">
                Password <span className="text-rose-500">*</span>
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="reg-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-11 pr-10 text-sm placeholder:text-neutral-400 placeholder:font-normal border-stone-200 focus-visible:ring-emerald-700"
                  data-testid="register-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">At least 8 characters.</p>
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="reg-confirm-password" className="text-xs font-semibold text-neutral-800">
                Confirm password <span className="text-rose-500">*</span>
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="reg-confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="Re-enter your password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-11 pr-10 text-sm placeholder:text-neutral-400 placeholder:font-normal border-stone-200 focus-visible:ring-emerald-700"
                  data-testid="register-confirm-password-input"
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
              {passwordError && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{passwordError}</p>
              )}
            </div>

            {/* Referral Code (Optional) */}
            <div>
              <Label htmlFor="reg-ref" className="text-xs font-semibold text-neutral-800">
                Referral code (optional)
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="reg-ref"
                  name="referral_code"
                  value={refCode}
                  onChange={(e) => handleRefCodeChange(e.target.value)}
                  placeholder="Enter referral code"
                  className="h-11 font-mono tracking-wider uppercase text-sm placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-400 border-stone-200 focus-visible:ring-emerald-700"
                  data-testid="register-referral-input"
                />
                {referralStatus === "checking" && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                  </div>
                )}
              </div>

              {/* Referral Validation Status Area */}
              {referralStatus === "checking" && (
                <p className="mt-1.5 text-xs text-neutral-500 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking referral code...</span>
                </p>
              )}
              {referralStatus === "valid" && (
                <div
                  className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50/80 px-2.5 py-1.5 rounded-md border border-emerald-200"
                  data-testid="register-referral-applied-badge"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>✓ Referral code applied</span>
                </div>
              )}
              {referralStatus === "invalid" && (
                <div
                  className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-900 bg-amber-50/80 px-2.5 py-1.5 rounded-md border border-amber-200"
                  data-testid="register-referral-invalid-badge"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>Referral code is invalid or unavailable.</span>
                </div>
              )}
            </div>

            {/* Consent Block */}
            <div className="pt-1">
              <div className="flex items-start gap-2.5">
                <input
                  id="reg-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    if (consentError) setConsentError("");
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700 focus:ring-offset-0 cursor-pointer accent-[#7C9C59]"
                  data-testid="register-consent-checkbox"
                />
                <label
                  htmlFor="reg-consent"
                  className="text-xs text-neutral-600 leading-relaxed cursor-pointer select-none block"
                >
                  I agree to Kotson&apos;s{" "}
                  <Link
                    to="/policies/policy_terms"
                    target="_blank"
                    className="font-medium text-emerald-800 underline hover:text-emerald-950"
                  >
                    Terms &amp; Conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/policies/policy_privacy"
                    target="_blank"
                    className="font-medium text-emerald-800 underline hover:text-emerald-950"
                  >
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
              {consentError && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{consentError}</p>
              )}
            </div>

            {/* Submit Button - disabled until phone is verified */}
            <Button
              type="submit"
              size="lg"
              disabled={mutation.isPending || !isPhoneVerified}
              className="w-full h-11 mt-2 bg-[#7C9C59] hover:bg-[#6c8a4c] disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold tracking-wide uppercase text-xs shadow-xs transition-colors"
              data-testid="register-form-submit-button"
            >
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </span>
              ) : (
                "CREATE ACCOUNT"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-neutral-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-emerald-800 hover:text-emerald-950 underline ml-1"
              data-testid="register-login-link"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
