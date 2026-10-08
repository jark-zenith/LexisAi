import React, { useState, useEffect, useRef } from "react";
import {
  PenTool,
  FolderKanban,
  FileText,
  Search,
  GraduationCap,
  Briefcase,
  Layers,
  Sparkles,
  History,
  Keyboard,
  HelpCircle,
  Plus,
  Coins,
  Zap,
  User as UserIcon,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Lock,
} from "lucide-react";
import { LexisMode, PlanType, FREE_ACTIONS_LIMIT, PRO_ACTIONS_LIMIT } from "../../types";
import { useAuth } from "../../context/AuthContext";

export interface NavItemConfig {
  id: LexisMode;
  label: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
}

export const MAIN_NAV_ITEMS: NavItemConfig[] = [
  {
    id: "transform",
    label: "Writing Studio",
    icon: PenTool,
    description: "Polish, rewrite, simplify, and elevate text",
  },
  {
    id: "workspace",
    label: "Workspaces",
    icon: FolderKanban,
    description: "Multi-document hubs, notes & AI agent",
    badge: "Hubs",
  },
  {
    id: "document",
    label: "Document Intelligence",
    icon: FileText,
    description: "PDF & document summaries, extraction, Q&A",
  },
  {
    id: "research",
    label: "Deep Research",
    icon: Search,
    description: "Web grounding with verifiable citations",
    badge: "Live",
  },
  {
    id: "study",
    label: "Study Assistant",
    icon: GraduationCap,
    description: "Flashcards, quizzes & Feynman explanations",
  },
  {
    id: "job",
    label: "Career & Job",
    icon: Briefcase,
    description: "CV matching, cover letters & interview prep",
  },
  {
    id: "workflow",
    label: "Synthesize Pipeline",
    icon: Layers,
    description: "Multi-step reports, proposals & briefs",
  },
];

interface AppSidebarProps {
  currentMode: LexisMode;
  onSelectMode: (mode: LexisMode) => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onNewTask: () => void;
  historyCount: number;
  onOpenHistory: () => void;
  onOpenShortcuts: () => void;
  onOpenFeedback: () => void;
  onOpenUpgrade: () => void;
  onOpenCredits: () => void;
  plan: PlanType;
  usageCount: number;
  credits: number;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentMode,
  onSelectMode,
  isCollapsed,
  onToggleCollapsed,
  isMobileOpen,
  onCloseMobile,
  onNewTask,
  historyCount,
  onOpenHistory,
  onOpenShortcuts,
  onOpenFeedback,
  onOpenUpgrade,
  onOpenCredits,
  plan,
  usageCount,
  credits,
}) => {
  const { user, isAuthenticated, openAuthModal, openSettingsModal, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isPro = plan === PlanType.PRO;
  const limit = isPro ? PRO_ACTIONS_LIMIT : FREE_ACTIONS_LIMIT;
  const isLimitReached = usageCount >= limit;
  const remainingActions = Math.max(0, limit - usageCount);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavClick = (mode: LexisMode) => {
    onSelectMode(mode);
    onCloseMobile();
  };

  const handleNewActionClick = () => {
    onNewTask();
    if (currentMode !== "transform" && currentMode !== "workspace") {
      onSelectMode("transform");
    }
    onCloseMobile();
  };

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

  // Sidebar inner content reused across desktop and mobile drawer
  const renderSidebarContent = (isMobileView = false) => {
    const collapsed = !isMobileView && isCollapsed;

    return (
      <div className="flex flex-col h-full select-none">
        {/* Top Header: Brand Identity */}
        <div
          className={`flex items-center justify-between border-b border-slate-800/80 shrink-0 ${
            collapsed ? "px-3 py-4" : "px-4 py-3.5"
          }`}
        >
          <div
            className={`flex items-center gap-2.5 min-w-0 ${
              collapsed ? "justify-center w-full" : ""
            }`}
          >
            <div
              onClick={() => handleNavClick("transform")}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center font-bold text-white shadow-md shadow-blue-950/60 cursor-pointer shrink-0"
              title="LexisAi Home"
            >
              <span className="text-base font-extrabold italic tracking-tighter">L</span>
            </div>

            {!collapsed && (
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white">
                    Lexis<span className="text-blue-500">AI</span>
                  </span>
                  {isPro ? (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                      PRO
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-slate-800 text-slate-400 border border-slate-700/60 uppercase tracking-wider">
                      FREE
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 truncate">
                  AI Productivity & Research
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Mobile Close Button */}
          {isMobileView ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            !collapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* Primary Action Button ("+ New Task") */}
        <div className={`p-3 shrink-0 ${collapsed ? "px-2" : ""}`}>
          <button
            type="button"
            id="sidebar-new-task-btn"
            onClick={handleNewActionClick}
            className={`w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-950/50 cursor-pointer active:scale-98 ${
              collapsed ? "p-2.5" : "px-3.5 py-2.5"
            }`}
            title="Start a new AI task or reset composer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!collapsed && <span>New Task</span>}
          </button>
        </div>

        {/* Main Navigation Destinations */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-1 scrollbar-none">
          {!collapsed && (
            <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Workspaces & Tools
            </div>
          )}

          {MAIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentMode === item.id;

            return (
              <button
                key={item.id}
                type="button"
                id={`sidebar-nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer relative group ${
                  collapsed
                    ? "justify-center p-2.5"
                    : "gap-2.5 px-3 py-2 text-left"
                } ${
                  isActive
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 font-bold"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent"
                }`}
                title={collapsed ? `${item.label} — ${item.description}` : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />

                {!collapsed && (
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-slate-800 text-blue-400 border border-blue-500/20">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}

                {/* Floating tooltip in collapsed mode */}
                {collapsed && (
                  <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    <span className="font-bold">{item.label}</span>
                    <p className="text-[10px] text-slate-400">{item.description}</p>
                  </div>
                )}
              </button>
            );
          })}

          {/* Utilities Section */}
          <div className="pt-3">
            {!collapsed && (
              <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Utilities
              </div>
            )}

            <button
              type="button"
              id="sidebar-history-btn"
              onClick={() => {
                onOpenHistory();
                onCloseMobile();
              }}
              className={`w-full flex items-center rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer relative group ${
                collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2 text-left"
              }`}
              title={collapsed ? `History (${historyCount})` : undefined}
            >
              <History className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0" />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <span>History</span>
                  {historyCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                      {historyCount}
                    </span>
                  )}
                </div>
              )}
            </button>

            <button
              type="button"
              id="sidebar-shortcuts-btn"
              onClick={() => {
                onOpenShortcuts();
                onCloseMobile();
              }}
              className={`w-full flex items-center rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer relative group ${
                collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2 text-left"
              }`}
              title={collapsed ? "Keyboard Shortcuts" : undefined}
            >
              <Keyboard className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0" />
              {!collapsed && <span>Shortcuts</span>}
            </button>

            <button
              type="button"
              id="sidebar-feedback-btn"
              onClick={() => {
                onOpenFeedback();
                onCloseMobile();
              }}
              className={`w-full flex items-center rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer relative group ${
                collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2 text-left"
              }`}
              title={collapsed ? "Help & Feedback" : undefined}
            >
              <HelpCircle className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0" />
              {!collapsed && <span>Feedback</span>}
            </button>
          </div>
        </div>

        {/* Bottom Section: Plan Quota + Credits + User Profile */}
        <div className="mt-auto shrink-0 border-t border-slate-800/80 p-3 space-y-2.5 bg-[#0a0a0c]">
          {/* Plan & Usage Summary Card */}
          {!collapsed ? (
            <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/90 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  {isPro ? "Pro Plan" : "Free Plan"}
                </span>
                <span
                  className={`font-mono font-bold ${
                    isLimitReached ? "text-amber-400" : "text-slate-200"
                  }`}
                >
                  {usageCount}/{limit} {isPro ? "/mo" : "/day"}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isLimitReached
                      ? "bg-amber-400"
                      : isPro
                      ? "bg-blue-500"
                      : "bg-blue-600"
                  }`}
                  style={{
                    width: `${Math.min(100, (usageCount / limit) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-0.5">
                {credits > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCredits();
                      onCloseMobile();
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Coins className="w-3 h-3" />
                    <span>{credits} AI Credits</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenUpgrade();
                      onCloseMobile();
                    }}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    {isPro ? "Manage Plan" : "Upgrade to Pro"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onOpenCredits();
                    onCloseMobile();
                  }}
                  className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Buy Credits
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenUpgrade}
              className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 text-blue-400 flex items-center justify-center cursor-pointer transition-colors"
              title={`Plan: ${usageCount}/${limit} actions used. Click to upgrade.`}
            >
              <Zap className="w-4 h-4" />
            </button>
          )}

          {/* User Account Card */}
          <div className="relative" ref={userMenuRef}>
            {isAuthenticated && user ? (
              <div>
                <button
                  type="button"
                  id="sidebar-user-profile-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`w-full flex items-center rounded-xl p-2 bg-slate-900/50 hover:bg-slate-800/70 border border-slate-800/80 transition-colors cursor-pointer text-left ${
                    collapsed ? "justify-center" : "gap-2.5"
                  }`}
                  title={collapsed ? user.fullName || user.email : undefined}
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
                    {initials}
                  </div>

                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white truncate">
                          {user.fullName || "User"}
                        </span>
                        {user.isVerified && (
                          <ShieldCheck
                            className="w-3.5 h-3.5 text-emerald-400 shrink-0"
                            title="Verified Account"
                          />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block">
                        {user.email}
                      </span>
                    </div>
                  )}
                </button>

                {/* Popover User Menu */}
                {showUserMenu && (
                  <div
                    className={`absolute bottom-full mb-2 bg-[#121215] border border-slate-800 rounded-xl p-1.5 shadow-2xl z-50 min-w-[200px] ${
                      collapsed ? "left-0" : "left-0 right-0"
                    }`}
                  >
                    <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                      <p className="text-xs font-bold text-white truncate">
                        {user.fullName || "Account"}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        openSettingsModal();
                        onCloseMobile();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Account Settings</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        signOut();
                        onCloseMobile();
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
              <div>
                {!collapsed ? (
                  <button
                    type="button"
                    id="sidebar-signin-btn"
                    onClick={() => {
                      openAuthModal("signin");
                      onCloseMobile();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 text-blue-400" />
                    <span>Sign In / Register</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAuthModal("signin")}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                    title="Sign In to your account"
                  >
                    <LogIn className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Expand Button for Collapsed Mode */}
          {collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="w-full p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. Desktop Fixed / Sticky Sidebar */}
      <aside
        id="app-desktop-sidebar"
        className={`hidden lg:flex flex-col h-[100dvh] bg-[#0c0c0e] border-r border-slate-800/80 transition-all duration-200 z-20 shrink-0 ${
          isCollapsed ? "w-[68px]" : "w-64"
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* 2. Mobile Slide-Over Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] h-full bg-[#0c0c0e] border-r border-slate-800 shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
