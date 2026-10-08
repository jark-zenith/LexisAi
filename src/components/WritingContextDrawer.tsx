import React, { useState } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp, Sparkles, Check } from "lucide-react";
import { WritingContext, LengthPreference, ToneType, FormatType } from "../types";
import { TONE_CONFIG, FORMAT_CONFIG } from "../data/presets";

interface WritingContextDrawerProps {
  context: WritingContext;
  onChange: (updated: WritingContext) => void;
  className?: string;
}

export const WritingContextDrawer: React.FC<WritingContextDrawerProps> = ({
  context,
  onChange,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveContext = Boolean(
    context.audience ||
    context.purpose ||
    context.length ||
    context.instructions
  );

  const updateField = (field: keyof WritingContext, value: any) => {
    onChange({
      ...context,
      [field]: value || undefined,
    });
  };

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-all ${className}`}>
      {/* Header Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/40 hover:bg-slate-900/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
          <span>Writing Context & Constraints</span>
          {hasActiveContext && (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <span className="text-[11px] font-normal hidden sm:inline">
            {isOpen ? "Hide options" : "Audience, purpose, length..."}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Drawer Fields */}
      {isOpen && (
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40 space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Target Audience */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Target Audience:
              </label>
              <input
                type="text"
                value={context.audience || ""}
                onChange={(e) => updateField("audience", e.target.value)}
                placeholder="E.g. Busy executives, hiring managers, high school students, clients..."
                className="w-full text-xs text-slate-200 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 min-h-[36px] focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
              />
            </div>

            {/* Core Purpose */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Primary Goal / Purpose:
              </label>
              <input
                type="text"
                value={context.purpose || ""}
                onChange={(e) => updateField("purpose", e.target.value)}
                placeholder="E.g. Secure a follow-up interview, resolve dispute politely, explain thesis..."
                className="w-full text-xs text-slate-200 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 min-h-[36px] focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Length Preference */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Length Preference:
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["concise", "standard", "detailed", "comprehensive"] as LengthPreference[]).map((len) => {
                  const isSelected = context.length === len || (!context.length && len === "standard");
                  return (
                    <button
                      key={len}
                      type="button"
                      onClick={() => updateField("length", len)}
                      className={`py-1.5 px-1 text-[11px] font-semibold rounded-lg capitalize border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      {len}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Special Instructions:
              </label>
              <input
                type="text"
                value={context.instructions || ""}
                onChange={(e) => updateField("instructions", e.target.value)}
                placeholder="E.g. No passive voice, include bullet points, avoid tech buzzwords..."
                className="w-full text-xs text-slate-200 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 min-h-[36px] focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
