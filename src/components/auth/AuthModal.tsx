import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  verifyEmailApi,
  resendVerificationApi,
  forgotPasswordApi,
  resetPasswordApi,
} from "../../utils/authClient";

const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";

function loadGoogleIdentityServices(): Promise<any> {
  const googleWindow = window as any;
  if (googleWindow.google?.accounts?.id) {
    return Promise.resolve(googleWindow.google);
  }

  let script = document.querySelector<HTMLScriptElement>(
    'script[data-google-identity-services="true"]'
  );
  const shouldAppend = !script;

  if (!script) {
    script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentityServices = "true";
  }

  return new Promise((resolve, reject) => {
    script!.addEventListener(
      "load",
      () => {
        const loadedGoogle = (window as any).google;
        if (loadedGoogle?.accounts?.id) {
          resolve(loadedGoogle);
        } else {
          reject(new Error("Google sign-in could not initialize. Please refresh and try again."));
        }
      },
      { once: true }
    );

    script!.addEventListener(
      "error",
      () => {
        script?.remove();
        reject(new Error("Could not load Google's sign-in service. Check your connection and try again."));
      },
      { once: true }
    );

    if (shouldAppend) {
      document.head.appendChild(script!);
    }
  });
}

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalTab,
    setAuthModalTab,
    signIn,
    signUp,
    signInWithGoogle,
    openTermsModal,
    resetTokenForModal,
  } = useAuth();

  // Form input states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Verification & reset token states
  const [verificationToken, setVerificationToken] = useState("");
  const [resetToken, setResetToken] = useState(resetTokenForModal || "");
  const [resendCooldown, setResendCooldown] = useState(0);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const initializedGoogleClientIdRef = useRef<string | null>(null);
  const googleSignInActionsRef = useRef({ signInWithGoogle, closeAuthModal });
  googleSignInActionsRef.current = { signInWithGoogle, closeAuthModal };

  // Sync reset token when modal opens with token
  useEffect(() => {
    if (resetTokenForModal) {
      setResetToken(resetTokenForModal);
    }
  }, [resetTokenForModal]);

  // Clear messages when tab changes
  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [authModalTab]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  useEffect(() => {
    if (!isAuthModalOpen || (authModalTab !== "signin" && authModalTab !== "signup")) {
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      setErrorMessage(
        "Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID for the frontend and GOOGLE_CLIENT_ID for the server."
      );
      return;
    }

    let cancelled = false;

    loadGoogleIdentityServices()
      .then((google) => {
        const button = googleButtonRef.current;
        if (cancelled || !button) return;

        if (initializedGoogleClientIdRef.current !== clientId) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: { credential?: string }) => {
              if (typeof response?.credential !== "string" || !response.credential.trim()) {
                setErrorMessage("Google did not return a valid ID token. Please try again.");
                setIsLoading(false);
                return;
              }

              setErrorMessage(null);
              setIsLoading(true);
              try {
                const actions = googleSignInActionsRef.current;
                await actions.signInWithGoogle({ credential: response.credential });
                actions.closeAuthModal();
              } catch (err: any) {
                setErrorMessage(err.message || "Google authentication failed. Please try again.");
              } finally {
                setIsLoading(false);
              }
            },
            cancel_on_tap_outside: true,
          });
          initializedGoogleClientIdRef.current = clientId;
        }

        button.replaceChildren();
        google.accounts.id.renderButton(button, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: authModalTab === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.max(200, Math.min(400, Math.floor(button.clientWidth || 320))),
        });
      })
      .catch((err: any) => {
        if (!cancelled) {
          setErrorMessage(err.message || "Could not load Google sign-in. Please refresh and try again.");
        }
      });

    return () => {
      cancelled = true;
      googleButtonRef.current?.replaceChildren();
    };
  }, [isAuthModalOpen, authModalTab]);

  if (!isAuthModalOpen) return null;

  // Real-time password strength calculation
  const calculateStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score; // 0 to 4
  };

  const passwordScore = calculateStrength(password);
  const strengthLabels = ["Weak", "Fair", "Good", "Strong", "Very Strong"];
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-400"];

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setIsLoading(true);
      await signIn({ email: email.trim(), password });
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage("Please enter your full name (minimum 2 characters).");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    if (!ageConfirmed) {
      setErrorMessage("You must confirm you are at least 13 years of age.");
      return;
    }

    if (!termsAccepted) {
      setErrorMessage("You must accept the Terms of Service and Privacy Policy.");
      return;
    }

    try {
      setIsLoading(true);
      await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        ageConfirmed: true,
        termsAccepted: true,
        marketingConsent,
      });
      closeAuthModal();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const msg = await forgotPasswordApi(email.trim());
      setSuccessMessage(msg || "Password reset instructions have been generated.");
    } catch (err: any) {
      setErrorMessage(err.message || "Unable to send password reset instructions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim()) {
      setErrorMessage("Reset token is required.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const msg = await resetPasswordApi({ token: resetToken.trim(), newPassword: password });
      setSuccessMessage(msg || "Password reset successfully. You can now sign in.");
      setTimeout(() => setAuthModalTab("signin"), 1800);
    } catch (err: any) {
      setErrorMessage(err.message || "Password reset failed. Token may be invalid or expired.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken.trim()) {
      setErrorMessage("Please enter the verification code or token.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      await verifyEmailApi(verificationToken.trim());
      setSuccessMessage("🎉 Your email has been verified successfully!");
      setTimeout(() => closeAuthModal(), 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Verification code is invalid or expired.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setErrorMessage("Please enter your email address to resend verification.");
      return;
    }
    if (resendCooldown > 0) return;

    try {
      setIsLoading(true);
      const msg = await resendVerificationApi(email.trim());
      setSuccessMessage(msg || "Verification link generated.");
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to resend verification email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-[#0e131f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white italic text-xs shadow-md shadow-blue-900/40">
              L
            </div>
            <h2 id="auth-modal-title" className="text-base font-bold text-white tracking-tight">
              {authModalTab === "signup" && "Create your LexisAi Account"}
              {authModalTab === "signin" && "Welcome back to LexisAi"}
              {authModalTab === "forgot" && "Reset your Password"}
              {authModalTab === "reset" && "Set a New Password"}
              {authModalTab === "verify" && "Verify your Email"}
            </h2>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher for Sign In / Sign Up */}
        {(authModalTab === "signin" || authModalTab === "signup") && (
          <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/40 shrink-0">
            <button
              type="button"
              onClick={() => setAuthModalTab("signin")}
              className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                authModalTab === "signin"
                  ? "border-blue-500 text-blue-400 bg-blue-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthModalTab("signup")}
              className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                authModalTab === "signup"
                  ? "border-blue-500 text-blue-400 bg-blue-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Notifications / Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* GOOGLE SIGN IN BUTTON */}
          {(authModalTab === "signin" || authModalTab === "signup") && (
            <div className="space-y-3">
              <div
                ref={googleButtonRef}
                className={`w-full min-h-[40px] flex items-center justify-center ${isLoading ? "pointer-events-none opacity-50" : ""}`}
                aria-label={authModalTab === "signup" ? "Sign up with Google" : "Sign in with Google"}
              />

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-[#0e131f] px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  or with email
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>
            </div>
          )}

          {/* SIGN IN FORM */}
          {authModalTab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setAuthModalTab("forgot")}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {authModalTab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength bar */}
                {password.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex gap-1 h-1.5">
                      {[0, 1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`flex-1 rounded-full transition-all ${
                            passwordScore > level ? strengthColors[passwordScore] : "bg-slate-800"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Strength: <span className="font-semibold text-slate-300">{strengthLabels[passwordScore]}</span> (must include 8+ chars, uppercase, lowercase, numbers &amp; symbols)
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Age eligibility confirmation checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  required
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-300 leading-tight">
                  I confirm that I am at least 13 years of age and eligible to use this service.
                </span>
              </label>

              {/* Terms and Privacy policy acceptance checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-300 leading-tight">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      openTermsModal("terms");
                    }}
                    className="text-blue-400 hover:underline cursor-pointer"
                  >
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      openTermsModal("privacy");
                    }}
                    className="text-blue-400 hover:underline cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  .
                </span>
              </label>

              {/* Optional marketing consent */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-400 leading-tight">
                  Send me product updates and AI writing tips (optional).
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Free Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {authModalTab === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-xs text-slate-400">
                Enter your registered email address below. If an account exists, you will receive password reset instructions.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setAuthModalTab("signin")}
                  className="text-xs text-blue-400 hover:underline cursor-pointer"
                >
                  &larr; Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD FORM */}
          {authModalTab === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token here"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-950/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save New Password"}
              </button>
            </form>
          )}

          {/* EMAIL VERIFICATION FORM */}
          {authModalTab === "verify" && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <p className="text-xs text-slate-400">
                Please enter the verification code or token sent to your email to confirm your account.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Verification Code / Token
                </label>
                <input
                  type="text"
                  required
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value)}
                  placeholder="Paste verification token"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify Email"}
              </button>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Didn&apos;t receive it?</span>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isLoading || resendCooldown > 0}
                  className="text-blue-400 hover:underline cursor-pointer disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend email"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
