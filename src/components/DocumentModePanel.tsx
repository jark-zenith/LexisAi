import React, { useState } from "react";
import {
  FileText,
  HelpCircle,
  Sparkles,
  AlignLeft,
  Scissors,
  CheckCircle,
  Eye,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { DocumentTaskType, DocumentTaskOptions } from "../types";

interface DocumentModePanelProps {
  attachedFileName?: string;
  attachedFileSize?: number;
  isPdfOrDoc: boolean;
  onRunDocumentTask: (options: DocumentTaskOptions) => void;
  isLoading: boolean;
  onOpenAssetPicker: () => void;
  onRemoveAsset: () => void;
  disabled?: boolean;
}

const DOCUMENT_TASKS: Array<{
  id: DocumentTaskType;
  label: string;
  icon: string;
  description: string;
  needsInput?: boolean;
  placeholder?: string;
}> = [
  {
    id: "summarize",
    label: "Executive Summary",
    icon: "📋",
    description: "High-impact summary, TL;DR, and major conclusions.",
  },
  {
    id: "extract_key_points",
    label: "Extract Key Points",
    icon: "🔑",
    description: "Structured bullet points of core arguments, findings, and dates.",
  },
  {
    id: "simplify",
    label: "Simplify & Demystify",
    icon: "💡",
    description: "Translate complex jargon or legalese into plain, clear English.",
  },
  {
    id: "explain",
    label: "Comprehensive Explanation",
    icon: "📖",
    description: "Detailed step-by-step breakdown of how and why the content works.",
  },
  {
    id: "qa",
    label: "Ask a Question",
    icon: "❓",
    description: "Get precise, cited answers about any specific part of this document.",
    needsInput: true,
    placeholder: "E.g. What are the key terms in section 4? What are the payment deadlines?",
  },
  {
    id: "rewrite_section",
    label: "Rewrite Specific Section",
    icon: "✍️",
    description: "Rewrite or modernize a particular chapter, clause, or paragraph.",
    needsInput: true,
    placeholder: "E.g. Rewrite the summary paragraph to be more persuasive and executive-ready...",
  },
];

export const DocumentModePanel: React.FC<DocumentModePanelProps> = ({
  attachedFileName,
  attachedFileSize,
  isPdfOrDoc,
  onRunDocumentTask,
  isLoading,
  onOpenAssetPicker,
  onRemoveAsset,
  disabled = false,
}) => {
  const [selectedTask, setSelectedTask] = useState<DocumentTaskType>("summarize");
  const [customInput, setCustomInput] = useState<string>("");

  const activeTaskConfig = DOCUMENT_TASKS.find((t) => t.id === selectedTask) || DOCUMENT_TASKS[0];

  const handleExecute = () => {
    onRunDocumentTask({
      task: selectedTask,
      questionOrSection: activeTaskConfig.needsInput ? customInput.trim() : undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* File status banner */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-xs">
                {attachedFileName || "No Document Attached Yet"}
              </span>
              {attachedFileName && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Ready
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {attachedFileName && attachedFileSize
                ? `${(attachedFileSize / 1024).toFixed(0)} KB • Supported for deep analysis, summaries, & Q&A`
                : "Upload a PDF, document, or text file to unlock deep document intelligence."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={onOpenAssetPicker}
            className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer shadow-sm active:scale-95"
          >
            {attachedFileName ? "Replace File" : "Upload Document / PDF"}
          </button>
          {attachedFileName && (
            <button
              type="button"
              onClick={onRemoveAsset}
              className="p-2 min-h-[36px] min-w-[36px] text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer border border-slate-800"
              title="Remove File"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Task selection grid */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Select Document Task
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {DOCUMENT_TASKS.map((t) => {
            const isSelected = selectedTask === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTask(t.id)}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer active:scale-98 ${
                  isSelected
                    ? "bg-blue-600/15 border-blue-500/50 shadow-sm"
                    : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{t.icon}</span>
                  <span
                    className={`text-xs font-bold ${
                      isSelected ? "text-blue-300" : "text-slate-200"
                    }`}
                  >
                    {t.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Extra prompt for Q&A or rewrite */}
      {activeTaskConfig.needsInput && (
        <div className="animate-in fade-in duration-200">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            {selectedTask === "qa"
              ? "Your Question about the Document:"
              : "Which section or part would you like to rewrite?"}
          </label>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={activeTaskConfig.placeholder}
            className="w-full text-xs text-slate-100 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 min-h-[42px] focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Action button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleExecute}
          disabled={isLoading || disabled || (!attachedFileName && !customInput.trim())}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-blue-950/40 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>
            {isLoading ? "Processing Document..." : `Execute: ${activeTaskConfig.label}`}
          </span>
        </button>
      </div>
    </div>
  );
};
