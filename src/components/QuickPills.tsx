import React from "react";
import { Sparkles, Briefcase, AlignLeft, Scissors, HeartHandshake, Zap, MessageSquare, CheckCircle } from "lucide-react";
import { ToolAction, ToneType, FormatType } from "../types";

interface QuickPillConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  action: ToolAction;
  tone?: ToneType;
  format?: FormatType;
  customInstruction?: string;
  hint: string;
}

const QUICK_ACTIONS: QuickPillConfig[] = [
  {
    id: "quick-grammar",
    label: "Fix Grammar & Polish",
    icon: Sparkles,
    action: "improve",
    hint: "Fix all typos, punctuation, and awkward phrasing",
  },
  {
    id: "quick-pro",
    label: "Make Professional",
    icon: Briefcase,
    action: "rewrite",
    tone: "professional",
    format: "email",
    hint: "Rephrase for business and workplace communications",
  },
  {
    id: "quick-summarize",
    label: "Summarize / TL;DR",
    icon: AlignLeft,
    action: "summarize",
    tone: "concise",
    hint: "Extract key takeaways and main points",
  },
  {
    id: "quick-shorten",
    label: "Cut Fluff & Shorten",
    icon: Scissors,
    action: "shorten",
    tone: "concise",
    hint: "Make it direct, concise, and punchy",
  },
  {
    id: "quick-friendly",
    label: "Warm & Friendly",
    icon: HeartHandshake,
    action: "rewrite",
    tone: "friendly",
    format: "message",
    hint: "Make tone inviting, polite, and approachable",
  },
  {
    id: "quick-bulletize",
    label: "To Bullet Points",
    icon: CheckCircle,
    action: "bulletize",
    hint: "Format unstructured text into clean bullet points",
  },
  {
    id: "quick-casual-slack",
    label: "Quick Slack / Chat",
    icon: MessageSquare,
    action: "rewrite",
    tone: "casual",
    format: "message",
    hint: "Casual, clear message for instant messaging",
  },
];

interface QuickPillsProps {
  onSelectQuickAction: (action: QuickPillConfig) => void;
  isLoading: boolean;
  disabled: boolean;
}

export const QuickPills: React.FC<QuickPillsProps> = ({
  onSelectQuickAction,
  isLoading,
  disabled,
}) => {
  return (
    <div className="w-full overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800">
      <div className="flex items-center gap-2 min-w-max">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 pl-1">
          <Zap className="w-3.5 h-3.5 text-blue-500" />
          Quick 1-Click:
        </span>
        {QUICK_ACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={`quick-pill-${item.id}`}
              onClick={() => onSelectQuickAction(item)}
              disabled={disabled || isLoading}
              title={item.hint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 rounded-full text-xs font-semibold bg-slate-900/90 text-slate-300 border border-slate-800 hover:border-blue-500/40 hover:bg-blue-600/10 hover:text-blue-400 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 select-none"
            >
              <Icon className="w-3.5 h-3.5 text-blue-400" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
