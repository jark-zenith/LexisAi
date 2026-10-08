import React, { useState } from "react";
import { Search, Globe, Link2, Sparkles, BookOpen, ShieldCheck, CheckCircle2 } from "lucide-react";
import { WritingContext } from "../types";

interface ResearchModePanelProps {
  onRunResearch: (topic: string, enableLiveWeb: boolean) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const ResearchModePanel: React.FC<ResearchModePanelProps> = ({
  onRunResearch,
  isLoading,
  disabled = false,
}) => {
  const [topic, setTopic] = useState("");
  const [enableLiveWeb, setEnableLiveWeb] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onRunResearch(topic.trim(), enableLiveWeb);
  };

  const sampleTopics = [
    "Latest developments in fusion energy 2026",
    "Effective strategies for remote team onboarding",
    "Current trends in generative AI for publishing",
    "Kenya tech startup ecosystem trends and fintech growth",
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Informational Header */}
      <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
        <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white">Live Research & Fact-Finding:</strong> Enter any topic or question. LexisAi performs structured research and presents verified key facts, consensus points, and exact sources with clickable citations. If search grounding is unavailable, it is clearly labeled as “Search unavailable — analytical draft” using only your provided input.
        </div>
      </div>

      {/* Topic input */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Research Topic or Question
        </label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="E.g. What are the key regulatory changes for AI models in 2026? Summarize recent market data and industry perspectives..."
          rows={3}
          className="w-full text-sm text-slate-100 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600 resize-none leading-relaxed"
        />
      </div>

      {/* Options: Live Web Search Grounding */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enableLiveWeb}
            onChange={(e) => setEnableLiveWeb(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700"
          />
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-white">Live Web Search & Verified Sources</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
              Real-time
            </span>
          </div>
        </label>
        <span className="text-[11px] text-slate-400">
          Clearly distinguishes verified live findings from synthesis
        </span>
      </div>

      {/* Quick Prompts */}
      <div>
        <span className="block text-[11px] font-medium text-slate-400 mb-1.5">
          Or try a quick research topic:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {sampleTopics.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setTopic(sample)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer active:scale-95 transition-all text-left"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading || disabled || !topic.trim()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-blue-950/40 cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>{isLoading ? "Conducting Research..." : "Start Research"}</span>
        </button>
      </div>
    </form>
  );
};
