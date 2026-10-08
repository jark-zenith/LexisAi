import React, { useEffect, useState } from "react";
import {
  X,
  Sparkles,
  Check,
  Zap,
  AlertCircle,
  ShieldCheck,
  Loader2,
  CreditCard,
  Coins,
  BadgeCheck,
} from "lucide-react";
import {
  FREE_ACTIONS_LIMIT,
  PRO_ACTIONS_LIMIT,
  PlanType,
  CREDIT_PACKAGES,
  CreditPackage,
} from "../types";
import {
  fetchPaystackConfig,
  initializeTransactionOnServer,
  verifyTransactionOnServer,
  PaystackConfig,
} from "../utils/paystackClient";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  usageCount: number;
  plan?: PlanType;
  credits?: number;
  isLimitReached?: boolean;
  initialTab?: "pro" | "credits";
  onUpgradeSuccess?: () => void;
  onCreditsPurchased?: (newTotal: number) => void;
  defaultEmail?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  usageCount,
  plan = PlanType.FREE,
  credits = 0,
  isLimitReached = false,
  initialTab = "pro",
  onUpgradeSuccess,
  onCreditsPurchased,
  defaultEmail = "",
}) => {
  const isPro = plan === PlanType.PRO;

  const [activeTab, setActiveTab] = useState<"pro" | "credits">(initialTab);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("credits_100");
  const [email, setEmail] = useState<string>(defaultEmail || "user@example.com");
  const [paystackConfig, setPaystackConfig] = useState<PaystackConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMessage(null);
      setSuccessMessage(null);
      setPaymentStatusMessage(null);
      fetchPaystackConfig().then((cfg) => {
        setPaystackConfig(cfg);
      });
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isProcessing]);

  if (!isOpen) return null;

  const selectedPackage =
    CREDIT_PACKAGES.find((pkg) => pkg.id === selectedPackageId) || CREDIT_PACKAGES[1];

  // Handler for Pro Subscription Upgrade (KSh 1,000 / 30 days)
  const handlePaystackProUpgrade = async () => {
    if (isPro) return;

    if (!email || !email.includes("@")) {
      setErrorMessage("Please provide a valid email address for your subscription receipt.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPaymentStatusMessage("Initializing secure Paystack checkout...");

    try {
      const initRes = await initializeTransactionOnServer(email.trim(), 100000, "KES", {
        paymentType: "subscription",
      });

      if (!initRes.success || !initRes.reference) {
        throw new Error(initRes.error || "Unable to initialize Paystack transaction.");
      }

      const reference = initRes.reference;
      const publicKey = initRes.publicKey || paystackConfig?.publicKey;

      if (typeof window !== "undefined" && window.PaystackPop && publicKey) {
        try {
          setPaymentStatusMessage("Opening Paystack payment popup...");

          const handleSuccessCallback = function (response: { reference: string; status?: string }) {
            setPaymentStatusMessage("Verifying transaction securely on server...");
            verifyTransactionOnServer(response.reference || reference)
              .then((verifyRes) => {
                if (verifyRes.success && verifyRes.isPro) {
                  setPaymentStatusMessage(null);
                  setSuccessMessage("Payment confirmed! Welcome to LexisAi Pro.");
                  if (onUpgradeSuccess) {
                    onUpgradeSuccess();
                  }
                  setTimeout(() => {
                    setIsProcessing(false);
                    onClose();
                  }, 1200);
                } else {
                  throw new Error(verifyRes.error || "Payment verification failed on server.");
                }
              })
              .catch((verErr: any) => {
                setErrorMessage(verErr.message || "Failed to verify transaction on server.");
                setIsProcessing(false);
                setPaymentStatusMessage(null);
              });
          };

          const handleCloseCallback = function () {
            setIsProcessing(false);
            setPaymentStatusMessage(null);
          };

          const popOptions: any = {
            key: publicKey,
            email: email.trim(),
            amount: 100000,
            currency: "KES",
            channels: ["card", "mobile_money"],
            ref: reference,
            callback: handleSuccessCallback,
            onClose: handleCloseCallback,
          };

          const handler = window.PaystackPop.setup(popOptions);
          handler.openIframe();
          return;
        } catch (setupErr: any) {
          console.warn("PaystackPop inline setup error, falling back to hosted checkout URL:", setupErr);
          if (initRes.authorizationUrl) {
            setPaymentStatusMessage("Redirecting to Paystack secure checkout...");
            window.location.href = initRes.authorizationUrl;
            return;
          }
          throw setupErr;
        }
      } else if (initRes.authorizationUrl) {
        setPaymentStatusMessage("Redirecting to Paystack secure checkout...");
        window.location.href = initRes.authorizationUrl;
      } else {
        throw new Error(
          paystackConfig?.hasSecretKey === false
            ? "Paystack Secret Key is not configured in server environment variables. Please configure PAYSTACK_SECRET_KEY in settings."
            : "Paystack initialization did not return an inline key or checkout URL."
        );
      }
    } catch (err: any) {
      console.error("Paystack upgrade error:", err);
      setErrorMessage(err.message || "An error occurred during Paystack checkout.");
      setIsProcessing(false);
      setPaymentStatusMessage(null);
    }
  };

  // Handler for Purchasing AI Credits Packages
  const handlePaystackCreditsPurchase = async () => {
    if (!email || !email.includes("@")) {
      setErrorMessage("Please provide a valid email address for your purchase receipt.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPaymentStatusMessage(
      `Initializing checkout for ${selectedPackage.actions} AI Credits (KSh ${selectedPackage.priceKes})...`
    );

    try {
      const initRes = await initializeTransactionOnServer(
        email.trim(),
        selectedPackage.amountInKobo,
        "KES",
        {
          paymentType: "credits",
          packageId: selectedPackage.id,
        }
      );

      if (!initRes.success || !initRes.reference) {
        throw new Error(initRes.error || "Unable to initialize credit package payment.");
      }

      const reference = initRes.reference;
      const publicKey = initRes.publicKey || paystackConfig?.publicKey;

      if (typeof window !== "undefined" && window.PaystackPop && publicKey) {
        try {
          setPaymentStatusMessage("Opening Paystack payment popup...");

          const handleSuccessCallback = function (response: { reference: string; status?: string }) {
            setPaymentStatusMessage("Verifying payment securely on server...");
            verifyTransactionOnServer(response.reference || reference)
              .then((verifyRes) => {
                if (verifyRes.success && typeof verifyRes.totalCredits === "number") {
                  setPaymentStatusMessage(null);
                  setSuccessMessage(
                    `Payment confirmed! ${verifyRes.creditsAdded || selectedPackage.actions} AI Credits added to your account.`
                  );
                  if (onCreditsPurchased) {
                    onCreditsPurchased(verifyRes.totalCredits);
                  }
                  setTimeout(() => {
                    setIsProcessing(false);
                    onClose();
                  }, 1400);
                } else {
                  throw new Error(verifyRes.error || "Credit verification failed on server.");
                }
              })
              .catch((verErr: any) => {
                setErrorMessage(verErr.message || "Failed to verify transaction on server.");
                setIsProcessing(false);
                setPaymentStatusMessage(null);
              });
          };

          const handleCloseCallback = function () {
            setIsProcessing(false);
            setPaymentStatusMessage(null);
          };

          const popOptions: any = {
            key: publicKey,
            email: email.trim(),
            amount: selectedPackage.amountInKobo,
            currency: "KES",
            channels: ["card", "mobile_money"],
            ref: reference,
            callback: handleSuccessCallback,
            onClose: handleCloseCallback,
          };

          const handler = window.PaystackPop.setup(popOptions);
          handler.openIframe();
          return;
        } catch (setupErr: any) {
          console.warn("PaystackPop inline setup error, falling back to hosted checkout URL:", setupErr);
          if (initRes.authorizationUrl) {
            setPaymentStatusMessage("Redirecting to Paystack secure checkout...");
            window.location.href = initRes.authorizationUrl;
            return;
          }
          throw setupErr;
        }
      } else if (initRes.authorizationUrl) {
        setPaymentStatusMessage("Redirecting to Paystack secure checkout...");
        window.location.href = initRes.authorizationUrl;
      } else {
        throw new Error(
          paystackConfig?.hasSecretKey === false
            ? "Paystack Secret Key is not configured in server environment variables. Please configure PAYSTACK_SECRET_KEY in settings."
            : "Paystack initialization did not return an inline key or checkout URL."
        );
      }
    } catch (err: any) {
      console.error("Paystack credits purchase error:", err);
      setErrorMessage(err.message || "An error occurred during Paystack checkout.");
      setIsProcessing(false);
      setPaymentStatusMessage(null);
    }
  };

  return (
    <div
      id="upgrade-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={() => !isProcessing && onClose()}
    >
      <div
        id="upgrade-modal"
        className="bg-[#0c0c0e] w-full max-w-xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Banner if Limit Reached */}
        {isLimitReached && (
          <div
            id="modal-limit-banner"
            className={`${
              !isPro
                ? "bg-blue-950/60 border-b border-blue-500/30 p-4 sm:p-5 text-center flex flex-col items-center gap-2.5"
                : "bg-amber-500/10 border-b border-amber-500/30 px-5 py-3 flex items-center gap-2.5 text-amber-300 text-xs font-semibold"
            }`}
          >
            {!isPro ? (
              <>
                <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg select-none">
                  💙
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                    You've used today's 5 free actions. 💙
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                    Your free actions reset tomorrow. You can also upgrade to Pro for higher usage and AI Credits.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 mt-2 w-full sm:w-auto">
                  <button
                    id="banner-upgrade-to-pro-btn"
                    type="button"
                    onClick={() => {
                      setActiveTab("pro");
                      const el = document.getElementById("pro-subscribe-button");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-400/40 shadow-lg shadow-blue-900/30 cursor-pointer transition-all active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>Upgrade to Pro (KSh 1,000 / 30 days)</span>
                  </button>
                  <button
                    id="banner-continue-tomorrow-btn"
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer rounded-xl hover:bg-slate-800/60"
                  >
                    Continue using LexisAi tomorrow
                  </button>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  You have reached your LexisAi Pro monthly allowance of {PRO_ACTIONS_LIMIT} actions.
                </span>
              </>
            )}
          </div>
        )}

        {/* Modal Header */}
        <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-slate-800/80 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3 text-blue-400" />
              Plans & Monetization
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {activeTab === "pro"
                ? isPro
                  ? "Your LexisAi Pro Membership"
                  : "Upgrade to LexisAi Pro"
                : "Buy AI Credits"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Choose the option that fits your workflow: monthly Pro subscription or flexible, pay-as-you-go AI credits.
            </p>
          </div>
          <button
            id="close-upgrade-modal-btn"
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option Navigation Tabs */}
        <div className="px-5 sm:px-6 pt-4">
          <div className="flex p-1 bg-slate-900/90 rounded-xl border border-slate-800 gap-1">
            <button
              id="tab-pro-subscription"
              type="button"
              onClick={() => {
                setActiveTab("pro");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "pro"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Pro Subscription</span>
            </button>
            <button
              id="tab-ai-credits"
              type="button"
              onClick={() => {
                setActiveTab("credits");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "credits"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-emerald-300" />
              <span>Buy AI Credits</span>
              {credits > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-950 text-emerald-200 border border-emerald-500/40 font-mono">
                  {credits}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: Pro Subscription View */}
        {activeTab === "pro" && (
          <div className="p-5 sm:px-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Free Plan Card */}
              <div
                id="plan-card-free"
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  !isPro
                    ? "bg-slate-900/60 border-slate-700/80 ring-1 ring-slate-700/50"
                    : "bg-slate-950/40 border-slate-800/60 opacity-75"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Free Plan
                    </span>
                    {!isPro && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">Free</span>
                    <span className="text-xs text-slate-400">/ forever</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Perfect for casual everyday writing tasks.</p>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        <strong>5 successful actions</strong> per day
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Resets each new day automatically</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Failed/cancelled requests do not count</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 font-medium">
                  {!isPro ? (
                    <span>
                      Usage today: <strong className="text-white">{usageCount}</strong> / 5 ({Math.max(0, 5 - usageCount)} left)
                    </span>
                  ) : (
                    <span>Free daily allowance (5 actions/day)</span>
                  )}
                </div>
              </div>

              {/* Pro Plan Card */}
              <div
                id="plan-card-pro"
                className={`p-4 rounded-xl border flex flex-col justify-between relative transition-all ${
                  isPro
                    ? "bg-blue-950/20 border-blue-500/50 ring-2 ring-blue-500/30"
                    : "bg-gradient-to-b from-blue-950/30 to-slate-900/60 border-blue-500/40 shadow-lg shadow-blue-950/20"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      LexisAi Pro
                    </span>
                    {isPro && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-500/40">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">KSh 1,000</span>
                    <span className="text-xs text-slate-400">/ 30 days</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">For power creators and users needing heavier, frequent AI usage.</p>

                  <div className="mt-4 pt-3 border-t border-blue-900/30 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-200">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 font-bold" />
                      <span>
                        <strong>No daily 5-action restriction</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>
                        <strong>{PRO_ACTIONS_LIMIT} monthly actions</strong> (substantially higher usage)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>Includes AI Credits for power tasks</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>100% Ad-Free, secure Paystack activation</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-blue-900/40 text-[11px] text-blue-300 font-medium">
                  {isPro ? (
                    <span>
                      Pro usage this month: <strong className="text-white">{usageCount}</strong> / {PRO_ACTIONS_LIMIT}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>KSh 1,000 / 30 days &bull; No ads &bull; Instant activation</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Email input for Pro subscription */}
            {!isPro && (
              <div className="space-y-1.5">
                <label htmlFor="pro-email-input" className="block text-xs font-semibold text-slate-300">
                  Email Address for Subscription Receipt
                </label>
                <input
                  id="pro-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@domain.com"
                  disabled={isProcessing}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            )}

            {/* Status / Error feedback */}
            {paymentStatusMessage && (
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center gap-2 text-xs text-blue-300 font-medium animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                <span>{paymentStatusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 font-medium">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 font-medium">
                <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Pro Action Button Box */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-400" />
                  LexisAi Pro — KSh 1,000 / 30 days
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isPro
                    ? "Your Pro membership is currently active."
                    : "Pay securely with Paystack (Card, Mobile Money / M-Pesa). Pro activates immediately upon verification."}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isPro ? (
                  <button
                    id="pro-subscribe-button"
                    type="button"
                    disabled={true}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600/30 border border-blue-500/40 cursor-default opacity-90 shadow-md"
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-300" />
                    <span>Pro Active</span>
                  </button>
                ) : (
                  <button
                    id="pro-subscribe-button"
                    type="button"
                    onClick={handlePaystackProUpgrade}
                    disabled={isProcessing}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-400/40 shadow-lg shadow-blue-900/30 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-3.5 h-3.5 text-blue-200" />
                        <span>Upgrade with Paystack (KSh 1,000)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Buy AI Credits View */}
        {activeTab === "credits" && (
          <div className="p-5 sm:px-6 space-y-4">
            {/* Current Balance Banner */}
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Your AI Credit Balance</div>
                  <div className="text-[11px] text-slate-400">
                    1 credit = 1 successful AI writing action. Credits do not expire.
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-lg font-black text-emerald-400">
                  {credits}
                </span>
                <span className="text-[11px] text-slate-400 ml-1">credits</span>
              </div>
            </div>

            {/* Credit Packages Selection */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                Select Credit Package (KES Only)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {CREDIT_PACKAGES.map((pkg) => {
                  const isSelected = selectedPackageId === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      id={`credit-pkg-${pkg.id}`}
                      type="button"
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                        isSelected
                          ? "bg-emerald-950/30 border-emerald-500/80 ring-2 ring-emerald-500/40 shadow-md shadow-emerald-950/30"
                          : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                      }`}
                    >
                      {pkg.badge && (
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                          {pkg.badge}
                        </span>
                      )}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">{pkg.name || pkg.label}</span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                              isSelected
                                ? "border-emerald-400 bg-emerald-500 text-white font-bold"
                                : "border-slate-700"
                            }`}
                          >
                            {isSelected ? "✓" : ""}
                          </span>
                        </div>
                        <div className="mt-2">
                          <span className="text-xl font-black text-white">
                            KSh {pkg.priceKes}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-emerald-400 mt-1">
                          {pkg.actions} AI actions
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400">
                        {pkg.description || `Includes ${pkg.actions} actions`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email input for Credits receipt */}
            <div className="space-y-1.5">
              <label htmlFor="credits-email-input" className="block text-xs font-semibold text-slate-300">
                Email Address for Purchase Receipt
              </label>
              <input
                id="credits-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@domain.com"
                disabled={isProcessing}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            {/* Status / Error feedback */}
            {paymentStatusMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 font-medium animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                <span>{paymentStatusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 font-medium">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 font-medium">
                <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Pay for Credits Action Box */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  {selectedPackage.actions} AI Actions &bull; KSh {selectedPackage.priceKes}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  One-time payment via Paystack (Card, Mobile Money / M-Pesa). Credits are added instantly after verification.
                </p>
              </div>

              <button
                id="buy-credits-submit-button"
                type="button"
                onClick={handlePaystackCreditsPurchase}
                disabled={isProcessing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/40 shadow-lg shadow-emerald-900/30 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Pay KSh {selectedPackage.priceKes}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Paystack Secure Checkout &bull; KES Only &bull; 256-bit Encryption</span>
          </div>
          <button
            id="modal-got-it-btn"
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
