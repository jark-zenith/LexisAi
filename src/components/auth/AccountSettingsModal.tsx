import React, { useState } from "react";
import {
  X,
  User,
  Shield,
  Lock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  Calendar,
  Globe,
  LogOut,
  FileText,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const AccountSettingsModal: React.FC = () => {
  const {
    user,
    isSettingsModalOpen,
    closeSettingsModal,
    updateProfile,
    changePassword,
    deleteAccount,
    signOut,
    openTermsModal,
    openAuthModal,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "privacy" | "danger">("profile");

  // Profile Form
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [region, setRegion] = useState(user?.region || "");
  const [marketingConsent, setMarketingConsent] = useState(user?.marketingConsent || false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Deletion Confirmation
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmPhrase, setDeleteConfirmPhrase] = useState("");
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  React.useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setDisplayName(user.displayName || "");
      setRegion(user.region || "");
      setMarketingConsent(user.marketingConsent || false);
    }
  }, [user]);

  if (!isSettingsModalOpen || !user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        displayName: displayName.trim(),
        region: region.trim() || null,
        marketingConsent,
      });
      setStatusMessage({ text: "Profile details updated successfully.", type: "success" });
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to update profile.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatusMessage(null);

    if (newPassword.length < 8) {
      setStatusMessage({ text: "New password must be at least 8 characters long.", type: "error" });
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setStatusMessage({ text: "New passwords do not match.", type: "error" });
      setIsLoading(false);
      return;
    }

    try {
      const msg = await changePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      setStatusMessage({ text: msg || "Password changed successfully.", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to change password.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      await deleteAccount({
        password: deletePassword || undefined,
        confirmPhrase: deleteConfirmPhrase || undefined,
      });
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Account deletion could not be completed.", type: "error" });
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-[#0e131f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-sm">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <h2 id="account-settings-title" className="text-base font-bold text-white tracking-tight">
                Account Settings
              </h2>
              <p className="text-xs text-slate-400">
                {user.email} &bull; Member since {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={closeSettingsModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 shrink-0 overflow-x-auto">
          <button
            onClick={() => { setActiveTab("profile"); setStatusMessage(null); }}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "profile" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="w-4 h-4" />
            Profile Details
          </button>
          <button
            onClick={() => { setActiveTab("security"); setStatusMessage(null); }}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "security" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lock className="w-4 h-4" />
            Security &amp; Password
          </button>
          <button
            onClick={() => { setActiveTab("privacy"); setStatusMessage(null); }}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "privacy" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            Privacy &amp; Terms
          </button>
          <button
            onClick={() => { setActiveTab("danger"); setStatusMessage(null); }}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "danger" ? "border-red-500 text-red-400" : "border-transparent text-slate-400 hover:text-red-400"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            Danger Zone
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-200"
                  : "bg-red-950/40 border border-red-500/30 text-red-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* TAB 1: PROFILE */}
          {activeTab === "profile" && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Short or friendly name"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs cursor-not-allowed"
                  />
                  {user.emailVerified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-bold shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openAuthModal("verify")}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/20 cursor-pointer shrink-0"
                    >
                      Verify Now
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Country / Region (Optional)
                </label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Kenya, United States, Germany"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  Age Eligibility: Confirmed 13+ years old
                </div>
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  Authentication Provider:{" "}
                  <span className="capitalize">{user.authProvider}</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-950/50 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : "Save Profile Details"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SECURITY */}
          {activeTab === "security" && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {user.authProvider !== "google" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters with numbers & symbols"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-950/50 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PRIVACY & LEGAL */}
          {activeTab === "privacy" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Terms of Service Version</span>
                  <span className="font-mono text-blue-400 font-bold">{user.termsAcceptedVersion}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Accepted On</span>
                  <span className="text-slate-400">{new Date(user.termsAcceptedAt).toLocaleString()}</span>
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => openTermsModal("terms")}
                    className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Terms
                  </button>
                  <button
                    type="button"
                    onClick={() => openTermsModal("privacy")}
                    className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    View Privacy Policy
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => {
                    setMarketingConsent(e.target.checked);
                    updateProfile({ marketingConsent: e.target.checked });
                  }}
                  className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-300">
                  Receive product notifications, AI release notes, and writing tips.
                </span>
              </label>
            </div>
          )}

          {/* TAB 4: DANGER ZONE */}
          {activeTab === "danger" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 space-y-2 text-xs">
                <h4 className="font-bold text-red-300 flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Irreversible Account Deletion
                </h4>
                <p className="text-red-200/80 leading-relaxed">
                  Deleting your account will permanently purge your user profile, all private workspaces, uploaded documents, OCR files, notes, AI chat conversations, active sessions, and credit balances. This action is immediate and cannot be recovered.
                </p>
              </div>

              {!showDeleteConfirmDialog ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmDialog(true)}
                  className="px-4 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  I want to delete my account
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900 border border-red-500/40 space-y-3.5 text-xs">
                  <p className="font-semibold text-white">
                    Please confirm re-authentication to permanently delete your account:
                  </p>

                  {user.authProvider !== "google" ? (
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">
                        Enter your current password:
                      </label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Your password"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">
                        Type <span className="font-mono text-red-400">DELETE MY ACCOUNT</span> to confirm:
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmPhrase}
                        onChange={(e) => setDeleteConfirmPhrase(e.target.value)}
                        placeholder="DELETE MY ACCOUNT"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirmDialog(false)}
                      className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleDeleteAccount}
                      className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? "Deleting..." : "Permanently Delete Everything"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={async () => {
              await signOut();
              closeSettingsModal();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
          <button
            type="button"
            onClick={closeSettingsModal}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
