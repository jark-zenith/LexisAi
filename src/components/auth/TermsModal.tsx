import React, { useState } from "react";
import { X, Shield, FileText, Lock, CheckCircle2, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const TermsModal: React.FC = () => {
  const { isTermsModalOpen, closeTermsModal, termsModalTab } = useAuth();
  const [activeTab, setActiveTab] = useState<"terms" | "privacy" | "security">(termsModalTab || "terms");

  // Keep synced if prop changes
  React.useEffect(() => {
    if (termsModalTab) {
      setActiveTab(termsModalTab);
    }
  }, [termsModalTab]);

  if (!isTermsModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-[#0e131f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id="terms-modal-title" className="text-base font-bold text-white tracking-tight">
                LexisAi Legal &amp; Data Security
              </h2>
              <p className="text-xs text-slate-400">
                Policy Version: v1.0-2026 &bull; Last updated October 2026
              </p>
            </div>
          </div>
          <button
            onClick={closeTermsModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 shrink-0">
          <button
            onClick={() => setActiveTab("terms")}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "terms"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            Terms of Service
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "privacy"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            Privacy Policy
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "security"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lock className="w-4 h-4" />
            Data Isolation &amp; Security
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-300 text-xs sm:text-sm leading-relaxed">
          {activeTab === "terms" && (
            <div className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  1. Age Eligibility &amp; Account Responsibility
                </h3>
                <p className="text-slate-400">
                  By registering for LexisAi, you confirm that you are at least 13 years of age (or the minimum legal age required in your jurisdiction to consent to online services). You are responsible for safeguarding your login credentials and for all activities that occur under your account.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  2. User-Owned Content &amp; Intellectual Property
                </h3>
                <p className="text-slate-400">
                  You retain full ownership of all texts, documents, notes, and research materials you submit or upload to LexisAi. LexisAi does not claim any intellectual property rights over your original text or the transformed text outputs generated on your behalf.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  3. Subscriptions &amp; AI Credits
                </h3>
                <p className="text-slate-400">
                  Free accounts receive 5 free AI writing actions per day. LexisAi Pro subscriptions (KSh 1,000 / 30 days) and prepaid AI Credit packages are processed securely via Paystack. Paid subscriptions and credit allocations are verified authoritatively on the server.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  4. Acceptable Use
                </h3>
                <p className="text-slate-400">
                  You agree not to use LexisAi to generate unlawful, defamatory, infringing, or abusive material, or attempt to compromise system isolation, circumvent rate limits, or access other users&apos; private workspaces.
                </p>
              </section>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                  1. Information We Collect
                </h3>
                <p className="text-slate-400">
                  We collect your email address, full name, display name, and securely salted password hash (never stored in plaintext). When signing in via Google, we collect your verified email, display name, and optional avatar URL provided by Google OAuth.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                  2. Storage &amp; Encryption
                </h3>
                <p className="text-slate-400">
                  Passwords are cryptographic hashes computed with scrypt and a unique salt. Session tokens use 256-bit entropy. We never sell your personal information or share private documents with unauthorized third parties.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                  3. Right to Erasure (Account Deletion)
                </h3>
                <p className="text-slate-400">
                  You may delete your account at any time through Account Settings. Deletion is irreversible and immediately purges your account profile, all workspaces, uploaded documents, notes, AI chat history, active sessions, and credit balances.
                </p>
              </section>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-blue-200">
                <p className="font-semibold text-xs text-blue-300 mb-1">
                  Cross-Account Isolation Architecture
                </p>
                <p className="text-xs text-blue-200/80">
                  LexisAi enforces server-side ownership verification on every read, write, update, and delete operation across all private resources.
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-blue-400" />
                  1. Document Intelligence Agent Isolation
                </h3>
                <p className="text-slate-400">
                  When you converse with the AI agent inside a workspace, the server retrieves context strictly from documents that belong to your authenticated user account. It is mathematically impossible for another user to prompt the agent to inspect or leak your private files.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-blue-400" />
                  2. Anti-Enumeration &amp; Rate Limiting
                </h3>
                <p className="text-slate-400">
                  Authentication endpoints implement strict sliding-window rate limiting to protect against brute-force attacks. Password reset and verification resend operations provide generic responses to prevent user identity enumeration.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex justify-end shrink-0">
          <button
            onClick={closeTermsModal}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
