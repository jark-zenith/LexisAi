import React, { useState, useRef, useEffect } from "react";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  FolderKanban,
  Coins,
  History,
  Sparkles,
  Download,
  ShieldCheck,
  User as UserIcon,
  LogIn,
  LogOut,
  Settings,
  ChevronDown,
  ChevronRight,
  PenTool,
  FileText,
  Search,
  GraduationCap,
  Briefcase,
  Layers,
} from "lucide-react";
import { LexisMode, PlanType, FREE_ACTIONS_LIMIT, PRO_ACTIONS_LIMIT, Workspace } from "../../types";
import { useAuth } from "../../context/AuthContext";

interface TopHeaderProps {
  currentMode: LexisMode;
  onSelectMode: (mode: LexisMode) => void;
  activeWorkspace: Workspace | null;
  onBackToWorkspacesDashboard?: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
  historyCount: number;
  onOpenHistory: () => void;
  onOpenUpgrade: () => void;
  onOpenCredits: () => void;
  usageCount: number;
  credits: number;
  plan: PlanType;
  hasApiKey: boolean | null;
  canInstall?: boolean;
  onInstall?: () => void;
}

const MODE_META: Record<LexisMode, { title: string; subtitle: string; icon: React.ElementType }> = {
  transform: {
    title: "Writing Studio",
    subtitle: "Rewrite, polish, summarize & generate",
    icon: PenTool,
  },
  workspace: {
    title: "Workspaces",
    subtitle: "Document hubs & grounded agent",
    icon: FolderKanban,
  },
  document: {
    title: "Document Intelligence",
    subtitle: "PDF extraction, summaries & Q&A",
    icon: FileText,
  },
  research: {
    title: "Deep Research",
    subtitle: "Live web grounding with citations",
    icon: Search,
  },
  study: {
    title: "Study Assistant",
    subtitle: "Flashcards, quizzes & explanations",
    icon: GraduationCap,
  },
  job: {
    title: "Career & Job",
    subtitle: "CV match, cover letters & interview",
    icon: Briefcase,
  },
  workflow: {
    title: "Synthesize Pipeline",
    subtitle: "Multi-step publication reports",
    icon: Layers,
  },
  ocr: {
    title: "Camera & Image OCR",
    subtitle: "Text extraction & document scans",
    icon: FileText,
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentMode,
  onSelectMode,
  activeWorkspace,
  onBackToWorkspacesDashboard,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenMobileSidebar,
  historyCount,
  onOpenHistory,
  onOpenUpgrade,
  onOpenCredits,
  usageCount,
  credits,
  plan,
  hasApiKey,
  canInstall,
  onInstall,
}) => {
  const { user, isAuthenticated, openAuthModal, openSettingsModal, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isPro = plan === PlanType.PRO;
  const limit = isPro ? PRO_ACTIONS_LIMIT : FREE_ACTIONS_LIMIT;
  const isLimitReached = usageCount >= limit;
  const remainingActions = Math.max(0, limit - usageCount);

  const modeInfo = MODE_META[currentMode] || MODE_META.transform;
  const ActiveIcon = modeInfo.icon;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : "U";

  return (
    <header
      id="app-top-header"
      className="h-14 sm:h-15 bg-[#09090b]/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-5 flex items-center justify-between shrink-0 z-10 transition-colors"
    >
      {/* Left: Mobile Menu + Desktop Sidebar Toggle + Title/Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="p-2 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 lg:hidden cursor-pointer transition-colors"
          title="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop sidebar toggle icon */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden lg:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 cursor-pointer transition-colors"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Active Breadcrumb / Title */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/25 text-blue-400 flex items-center justify-center shrink-0">
            <ActiveIcon className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0 flex items-center gap-1.5">
            {currentMode === "workspace" && activeWorkspace ? (
              <div className="flex items-center gap-1.5 text-xs truncate">
                <button
                  type="button"
                  onClick={onBackToWorkspacesDashboard}
                  className="font-semibold text-slate-400 hover:text-white cursor-pointer truncate"
                >
                  Workspaces
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span className="font-bold text-white truncate">
                  {activeWorkspace.name}
                </span>
              </div>
            ) : (
              <div className="flex flex-col min-w-0">
                <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate leading-tight">
                  {modeInfo.title}
                </h1>
                <span className="text-[10px] text-slate-400 truncate hidden md:block">
                  {modeInfo.subtitle}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls: Plan badge, AI Credits, History, Install & Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* PWA Install Button (if available) */}
        {canInstall && onInstall && (
          <button
            type="button"
            onClick={onInstall}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-all cursor-pointer"
            title="Install LexisAi as desktop/mobile app"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Install</span>
          </button>
        )}

        {/* AI Credits Badge (if user has credits) */}
        {credits > 0 && (
          <button
            type="button"
            id="top-credits-badge-btn"
            onClick={onOpenCredits}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:border-emerald-400/50 transition-colors cursor-pointer"
            title={`AI Credits Balance: ${credits} actions available. Click to top up.`}
          >
            <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono text-xs">{credits}</span>
            <span className="text-[10px] text-emerald-400 uppercase hidden sm:inline">
              Credits
            </span>
          </button>
        )}

        {/* Usage Quota Pill */}
        <button
          type="button"
          id="top-usage-badge-btn"
          onClick={onOpenUpgrade}
          className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
            isPro
              ? "bg-blue-950/30 border-blue-500/30 text-blue-300 hover:border-blue-400/50"
              : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
          title={
            isPro
              ? `LexisAi Pro: ${remainingActions} actions remaining this month`
              : `Free Plan: ${remainingActions} of ${limit} actions remaining today (resets tomorrow)`
          }
        >
          <span className={`text-[10px] font-bold ${isPro ? "text-blue-400" : "text-slate-400"}`}>
            {isPro ? "Pro" : "Free"}:
          </span>
          <span
            className={`font-mono text-xs font-bold ${
              isLimitReached ? "text-amber-400" : isPro ? "text-blue-300" : "text-slate-200"
            }`}
          >
            {remainingActions}
          </span>
          <span className="text-[10px] text-slate-400 hidden md:inline">left</span>
        </button>

        {/* History Quick Trigger */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 flex items-center gap-1.5 text-xs transition-colors cursor-pointer relative"
          title={`View session history (${historyCount})`}
        >
          <History className="w-4 h-4 text-slate-400" />
          <span className="hidden sm:inline font-medium">History</span>
          {historyCount > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-mono rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              {historyCount}
            </span>
          )}
        </button>

        {/* User Account Button (Mobile & quick access) */}
        <div className="relative" ref={userMenuRef}>
          {isAuthenticated && user ? (
            <div>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
                title={user.fullName || user.email}
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold text-xs flex items-center justify-center">
                  {initials}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#121215] border border-slate-800 rounded-xl p-1.5 shadow-2xl z-50">
                  <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                    <p className="text-xs font-bold text-white truncate">
                      {user.fullName || "User"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      openSettingsModal();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Account Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal("signin")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
