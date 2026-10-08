import React from "react";
import {
  PenTool,
  FileText,
  Search,
  GraduationCap,
  Briefcase,
  Layers,
  Sparkles,
  Camera,
  FolderKanban,
} from "lucide-react";
import { LexisMode } from "../types";

interface ModeSwitcherProps {
  currentMode: LexisMode;
  onSelectMode: (mode: LexisMode) => void;
  isLoading: boolean;
}

const MODES: Array<{
  id: LexisMode;
  label: string;
  badge?: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    id: "transform",
    label: "Writing & Rewrite",
    icon: PenTool,
    description: "Polish, rephrase, shorten, fix grammar, and elevate text.",
  },
  {
    id: "document",
    label: "Document & PDF",
    badge: "New",
    icon: FileText,
    description: "Summarize, extract, explain, simplify, and Q&A documents.",
  },
  {
    id: "research",
    label: "Research Mode",
    badge: "Web",
    icon: Search,
    description: "Real-time topic research with verified citations.",
  },
  {
    id: "study",
    label: "Study Mode",
    badge: "Smart",
    icon: GraduationCap,
    description: "Flashcards, quizzes, study summaries, and practice questions.",
  },
  {
    id: "job",
    label: "Job & Career",
    badge: "ATS",
    icon: Briefcase,
    description: "CV match analysis, tailored cover letters, and interview prep.",
  },
  {
    id: "workflow",
    label: "Finished Workflows",
    badge: "Guided",
    icon: Layers,
    description: "Reports, proposals, letters, assignments, and presentations.",
  },
  {
    id: "workspace",
    label: "Workspace",
    badge: "New",
    icon: FolderKanban,
    description: "Multi-document hubs, notes, and grounded AI intelligence.",
  },
];

export const ModeSwitcher: React.FC<ModeSwitcherProps> = ({
  currentMode,
  onSelectMode,
  isLoading,
}) => {
  return (
    <div className="w-full bg-[#0c0c0e] rounded-2xl border border-slate-800 p-2 sm:p-2.5 shadow-lg">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;

          return (
            <button
              key={mode.id}
              type="button"
              id={`mode-btn-${mode.id}`}
              onClick={() => onSelectMode(mode.id)}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-98 select-none ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-950/50"
                  : "bg-slate-900/60 text-slate-300 border border-slate-800 hover:bg-slate-800/80 hover:text-white"
              }`}
              title={mode.description}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span className="whitespace-nowrap">{mode.label}</span>
              {mode.badge && (
                <span
                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {mode.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
