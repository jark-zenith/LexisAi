import React from "react";
import { PenTool, FolderKanban, FileText, History, Menu } from "lucide-react";
import { LexisMode } from "../../types";

interface MobileNavigationProps {
  currentMode: LexisMode;
  onSelectMode: (mode: LexisMode) => void;
  historyCount: number;
  onOpenHistory: () => void;
  onOpenDrawer: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  currentMode,
  onSelectMode,
  historyCount,
  onOpenHistory,
  onOpenDrawer,
}) => {
  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0c0c0e]/95 backdrop-blur-md border-t border-slate-800/80 px-2 pt-1 pb-[calc(env(safe-area-inset-bottom,0px)+4px)] flex items-center justify-around select-none"
    >
      {/* Studio / Transform */}
      <button
        type="button"
        id="mobile-nav-transform"
        onClick={() => onSelectMode("transform")}
        className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 rounded-xl transition-colors cursor-pointer ${
          currentMode === "transform"
            ? "text-blue-400 font-bold"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <PenTool className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] leading-none">Studio</span>
      </button>

      {/* Workspaces */}
      <button
        type="button"
        id="mobile-nav-workspace"
        onClick={() => onSelectMode("workspace")}
        className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 rounded-xl transition-colors cursor-pointer ${
          currentMode === "workspace"
            ? "text-blue-400 font-bold"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <FolderKanban className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] leading-none">Workspaces</span>
      </button>

      {/* Documents */}
      <button
        type="button"
        id="mobile-nav-document"
        onClick={() => onSelectMode("document")}
        className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 rounded-xl transition-colors cursor-pointer ${
          currentMode === "document"
            ? "text-blue-400 font-bold"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <FileText className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] leading-none">Docs</span>
      </button>

      {/* History */}
      <button
        type="button"
        id="mobile-nav-history"
        onClick={onOpenHistory}
        className="flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer relative"
      >
        <div className="relative">
          <History className="w-5 h-5 mb-0.5" />
          {historyCount > 0 && (
            <span className="absolute -top-1 -right-2 px-1 py-0.2 text-[9px] font-mono rounded-full bg-blue-600 text-white font-bold leading-none">
              {historyCount}
            </span>
          )}
        </div>
        <span className="text-[10px] leading-none">History</span>
      </button>

      {/* All Tools / More Menu */}
      <button
        type="button"
        id="mobile-nav-more"
        onClick={onOpenDrawer}
        className="flex flex-col items-center justify-center min-w-[54px] min-h-[44px] py-1 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] leading-none">More</span>
      </button>
    </nav>
  );
};
