import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  History,
  HelpCircle,
  AlertCircle,
  Download,
  Zap,
  Coins,
  FolderKanban,
  User as UserIcon,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { PlanType, FREE_ACTIONS_LIMIT, PRO_ACTIONS_LIMIT } from "../types";
import { useAuth } from "../context/AuthContext";

interface HeaderProps {
  historyCount: number;
  onOpenHistory: () => void;
  onOpenShortcuts: () => void;
  onOpenUpgrade: () => void;
  onOpenCredits?: () => void;
  onOpenWorkspace?: () => void;
  isWorkspaceActive?: boolean;
  usageCount: number;
  credits?: number;
  plan: PlanType;
  hasApiKey: boolean | null;
  canInstall?: boolean;
  onInstall?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  historyCount,
  onOpenHistory,
  onOpenShortcuts,
  onOpenUpgrade,
  onOpenCredits,
  onOpenWorkspace,
  isWorkspaceActive = false,
  usageCount,
  credits = 0,
  plan,
  hasApiKey,
  canInstall,
  onInstall,
}) => {
  const { user, isAuthenticated, openAuthModal, openSettingsModal, openTermsModal, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isPro = plan === PlanType.PRO;
  const limit = isPro ? PRO_ACTIONS_LIMIT : FREE_ACTIONS_LIMIT;
  const isLimitReached = usageCount >= limit;
  const remainingActions = Math.max(0, limit - usageCount);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      id="app-header"
      className="bg-[#09090b]/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white italic shadow-md shadow-blue-900/40 shrink-0">
            L
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Lexis<span className="text-blue-500">AI</span>
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-600/10 text-blue-400 border border-blue-500/20 uppercase tracking-widest">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Rewrite, summarize, polish, and generate text instantly
            </p>
          </div>
        </div>

        {/* Right: Actions & Main Navigation */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Main Navigation: Workspace */}
          {onOpenWorkspace && (
            <button
              id="nav-workspace-btn"
              type="button"
              onClick={onOpenWorkspace}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                isWorkspaceActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-950/40"
                  : "bg-slate-900/90 text-slate-200 border border-slate-800 hover:bg-slate-800 hover:text-white"
              }`}
              title="Open Lexis Workspace dashboard"
            >
              <FolderKanban className={`w-3.5 h-3.5 ${isWorkspaceActive ? "text-white" : "text-blue-400"}`} />
              <span>Workspace</span>
            </button>
          )}

          {/* AI Credits Badge (if user has credits) */}
          {credits > 0 && (
            <button
              id="header-credits-badge-btn"
              type="button"
              onClick={onOpenCredits || onOpenUpgrade}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:border-emerald-400/60 transition-colors cursor-pointer"
              title={`AI Credits Balance: ${credits} action${credits === 1 ? "" : "s"} available`}
            >
              <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-mono text-[11px] font-bold text-emerald-300">{credits}</span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase hidden sm:inline">Credits</span>
            </button>
          )}

          {/* Plan & Usage Display Pill */}
          <button
            id="usage-badge-btn"
            type="button"
            onClick={onOpenUpgrade}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isPro
                ? "bg-blue-950/40 border-blue-500/30 text-blue-300 hover:border-blue-400/50"
                : "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300"
            }`}
            title={
              isPro
                ? `LexisAi Pro: ${remainingActions} actions remaining this month (${usageCount}/${limit})`
                : `Free Plan: ${remainingActions} of ${limit} free actions remaining today (resets tomorrow)`
            }
          >
            <span className={`text-[11px] font-bold ${isPro ? "text-blue-400" : "text-slate-400"}`}>
              {isPro ? "Pro:" : "Free:"}
            </span>
            <span
              className={`font-mono text-[11px] font-bold ${
                isLimitReached
                  ? "text-amber-400"
                  : isPro
                  ? "text-blue-300"
                  : "text-blue-400"
              }`}
            >
              {isPro ? `${usageCount}/${limit}` : `${remainingActions}/${limit} left today`}
            </span>
          </button>

          {/* LexisAi Pro Upgrade Button / Plan Badge */}
          {!isPro ? (
            <div className="flex items-center gap-1.5">
              <button
                id="header-buy-credits-btn"
                type="button"
                onClick={onOpenCredits || onOpenUpgrade}
                className="hidden md:inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 transition-all cursor-pointer active:scale-95"
                title="Buy AI Credits (from KSh 100)"
              >
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Buy Credits</span>
              </button>

              <button
                id="header-pro-upgrade-btn"
                type="button"
                onClick={onOpenUpgrade}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-400/30 shadow-md shadow-blue-950/40 transition-all cursor-pointer active:scale-95"
                title="Upgrade to LexisAi Pro (KSh 1,000 / 30 days)"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span className="hidden sm:inline">LexisAi Pro &bull; KSh 1,000</span>
                <span className="sm:hidden">Pro</span>
              </button>
            </div>
          ) : (
            <button
              id="header-pro-badge-btn"
              type="button"
              onClick={onOpenUpgrade}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold text-blue-300 bg-blue-950/60 border border-blue-500/40 shadow-xs transition-all cursor-pointer hover:bg-blue-900/50"
              title="LexisAi Pro Active"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Pro Active</span>
            </button>
          )}

          {/* Optional PWA Install Prompt Button */}
          {canInstall && onInstall && (
            <button
              id="install-pwa-btn"
              onClick={onInstall}
              className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-xs font-bold text-white bg-blue-600/20 hover:bg-blue-600 hover:text-white border border-blue-500/40 text-blue-300 transition-all cursor-pointer active:scale-95"
              title="Install LexisAi as standalone app"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Status Indicator */}
          <div
            className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300"
            title={hasApiKey ? "Gemini AI Engine Active" : "Checking AI connection..."}
          >
            {hasApiKey === true ? (
              <>
                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] inline-block" />
                <span className="text-blue-400 font-medium">AI Ready</span>
              </>
            ) : hasApiKey === false ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-amber-400">Key Required</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span>Connecting</span>
              </>
            )}
          </div>

          {/* Shortcuts Button */}
          <button
            id="shortcuts-btn"
            onClick={onOpenShortcuts}
            aria-label="Keyboard Shortcuts"
            className="p-2.5 sm:p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer active:scale-95"
            title="Keyboard Shortcuts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* History Button */}
          <button
            id="history-btn"
            onClick={onOpenHistory}
            className="relative flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-xs font-semibold text-slate-200 bg-slate-900/80 hover:bg-slate-800 hover:text-white border border-slate-800 transition-colors cursor-pointer active:scale-95"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30">
                {historyCount}
              </span>
            )}
          </button>

          {/* User Authentication Menu / Sign In Button */}
          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                id="user-profile-menu-btn"
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 transition-all cursor-pointer"
                title={`Signed in as ${user.displayName || user.fullName}`}
              >
                <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-[11px] shrink-0">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="max-w-[100px] truncate hidden md:inline">
                  {user.displayName || user.fullName.split(" ")[0]}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-[#0e131f] border border-slate-800 shadow-2xl py-1.5 z-50 text-xs text-slate-300 animate-in fade-in slide-in-from-top-1">
                  <div className="px-3.5 py-2 border-b border-slate-800/80">
                    <p className="font-bold text-white truncate">{user.fullName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600/10 text-blue-400 border border-blue-500/20">
                        {isPro ? "Pro Member" : "Free Tier"}
                      </span>
                      {user.emailVerified && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        openSettingsModal();
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-800/70 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Account Settings</span>
                    </button>

                    {onOpenWorkspace && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenWorkspace();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-800/70 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <FolderKanban className="w-3.5 h-3.5 text-blue-400" />
                        <span>My Workspaces</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        openTermsModal("terms");
                      }}
                      className="w-full px-3.5 py-2 text-left hover:bg-slate-800/70 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>Legal &amp; Privacy</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-800/80 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        await signOut();
                      }}
                      className="w-full px-3.5 py-2 text-left text-red-400 hover:bg-red-950/30 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              id="header-signin-btn"
              type="button"
              onClick={() => openAuthModal("signin")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-950/40 transition-all cursor-pointer active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

