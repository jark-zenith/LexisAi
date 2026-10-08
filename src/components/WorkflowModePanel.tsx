import React, { useState } from "react";
import {
  FileText,
  FileCheck,
  Mail,
  Send,
  Sparkles,
  Layers,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { FinishedDocumentType, WorkflowOptions } from "../types";

interface WorkflowModePanelProps {
  onRunWorkflow: (options: WorkflowOptions) => void;
  isLoading: boolean;
  disabled?: boolean;
  initialRoughNotes?: string;
}

const DOCUMENT_WORKFLOWS: Array<{
  id: FinishedDocumentType;
  label: string;
  icon: string;
  description: string;
  typicalAudience: string;
}> = [
  {
    id: "report",
    label: "Business / Project Report",
    icon: "📊",
    description: "Executive summary, background, methodology, findings, and strategic recommendations.",
    typicalAudience: "Executive leadership, stakeholders, team managers",
  },
  {
    id: "proposal",
    label: "Project / Client Proposal",
    icon: "💡",
    description: "Problem statement, proposed solution, project scope, timeline, deliverables, and ROI.",
    typicalAudience: "Prospective clients, internal sponsors, budget approvers",
  },
  {
    id: "professional_email",
    label: "High-Stakes Professional Email",
    icon: "✉️",
    description: "Polite, decisive, and action-oriented communication with clear next steps.",
    typicalAudience: "Clients, executives, partners, colleagues",
  },
  {
    id: "cover_letter",
    label: "Tailored Cover Letter",
    icon: "📄",
    description: "Narrative highlighting genuine value proposition, achievements, and company alignment.",
    typicalAudience: "Hiring managers, recruiters",
  },
  {
    id: "cv_resume",
    label: "CV / Resume Profile & Experience",
    icon: "👤",
    description: "Quantified bullet points, executive summary, and industry skill matrix.",
    typicalAudience: "ATS scanners, recruitment panels",
  },
  {
    id: "assignment_draft",
    label: "Academic Draft / Paper",
    icon: "🎓",
    description: "Rigorous thesis statement, structured body paragraphs, counter-arguments, and conclusion.",
    typicalAudience: "Professors, teaching assistants, reviewers",
  },
  {
    id: "presentation_content",
    label: "Presentation / Pitch Outline",
    icon: "🖥️",
    description: "Slide-by-slide narrative structure, key bullet points, and speaker notes.",
    typicalAudience: "Investors, audience members, workshop attendees",
  },
  {
    id: "formal_letter",
    label: "Formal Official Letter",
    icon: "🏛️",
    description: "Traditional correspondence conforming to legal, governmental, or institutional conventions.",
    typicalAudience: "Institutional authorities, legal bodies, HR departments",
  },
];

export const WorkflowModePanel: React.FC<WorkflowModePanelProps> = ({
  onRunWorkflow,
  isLoading,
  disabled = false,
  initialRoughNotes = "",
}) => {
  const [documentType, setDocumentType] = useState<FinishedDocumentType>("report");
  const [topicTitle, setTopicTitle] = useState("");
  const [roughNotes, setRoughNotes] = useState(initialRoughNotes);
  const [targetAudience, setTargetAudience] = useState("");
  const [keyGoals, setKeyGoals] = useState("");

  const activeWorkflow =
    DOCUMENT_WORKFLOWS.find((w) => w.id === documentType) || DOCUMENT_WORKFLOWS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim() && !roughNotes.trim()) return;
    onRunWorkflow({
      documentType,
      topicTitle: topicTitle.trim() || activeWorkflow.label,
      roughNotes: roughNotes.trim(),
      targetAudience: targetAudience.trim() || activeWorkflow.typicalAudience,
      keyGoals: keyGoals.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Workflow Guidance Header */}
      <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white">Guided Document Engine:</strong> Turn messy bullet points or quick thoughts into a fully structured, publication-ready document without writing complex prompts.
        </div>
      </div>

      {/* Document Type Selector */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          1. Choose Desired Document Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DOCUMENT_WORKFLOWS.map((w) => {
            const isSelected = documentType === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setDocumentType(w.id)}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer active:scale-98 ${
                  isSelected
                    ? "bg-blue-600/15 border-blue-500/50 shadow-sm"
                    : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{w.icon}</span>
                  <span
                    className={`text-xs font-bold ${
                      isSelected ? "text-blue-300" : "text-slate-200"
                    }`}
                  >
                    {w.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {w.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Context: Topic & Target Audience */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Document Title / Main Subject:
          </label>
          <input
            type="text"
            value={topicTitle}
            onChange={(e) => setTopicTitle(e.target.value)}
            placeholder="E.g. Q4 Growth Strategy & Expansion Plan"
            className="w-full text-xs text-slate-200 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 min-h-[38px] focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Target Audience:
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder={`E.g. ${activeWorkflow.typicalAudience}`}
            className="w-full text-xs text-slate-200 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 min-h-[38px] focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Rough Notes / Bullets / Brain Dump */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          2. Your Rough Notes, Bullets, or Brain Dump
        </label>
        <textarea
          value={roughNotes}
          onChange={(e) => setRoughNotes(e.target.value)}
          placeholder="Paste or write your raw thoughts, bullet points, numbers, decisions, or requirements here. LexisAi organizes, elaborates, and crafts the final document..."
          rows={5}
          className="w-full text-xs text-slate-100 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600 resize-none leading-relaxed"
        />
      </div>

      {/* Key Objective / Instructions (optional) */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Key Objective or Special Instructions (optional):
        </label>
        <input
          type="text"
          value={keyGoals}
          onChange={(e) => setKeyGoals(e.target.value)}
          placeholder="E.g. Emphasize cost reduction, request approval by next Tuesday, include next steps..."
          className="w-full text-xs text-slate-200 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 min-h-[38px] focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Multi-step execution preview */}
      <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Automated 5-Step Pipeline:</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300 font-medium overflow-x-auto text-[10px]">
          <span>Analyze</span>
          <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
          <span>Structure</span>
          <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
          <span>Draft</span>
          <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
          <span>Proofread</span>
          <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
          <span className="text-emerald-400">Final Document</span>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading || disabled || (!topicTitle.trim() && !roughNotes.trim())}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-blue-950/40 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>
            {isLoading ? "Executing Document Workflow..." : `Generate Finished ${activeWorkflow.label}`}
          </span>
        </button>
      </div>
    </form>
  );
};
