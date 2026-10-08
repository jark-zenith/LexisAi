import React, { useState } from "react";
import { Briefcase, FileCheck, Mail, HelpCircle, Sparkles, UserCheck, ShieldCheck } from "lucide-react";
import { JobOptions, JobActionKind } from "../types";

interface JobModePanelProps {
  onRunJobAction: (options: JobOptions) => void;
  isLoading: boolean;
  disabled?: boolean;
  initialCvText?: string;
}

const JOB_ACTIONS: Array<{
  id: JobActionKind;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    id: "match_analysis",
    label: "Match & Gap Analysis",
    icon: "📊",
    description: "Detailed ATS score breakdown, matched keywords, and qualification gaps.",
  },
  {
    id: "tailored_cover_letter",
    label: "Tailored Cover Letter",
    icon: "✉️",
    description: "Compelling narrative addressing specific role requirements without generic fluff.",
  },
  {
    id: "improve_cv",
    label: "Targeted CV Polish",
    icon: "✨",
    description: "High-impact bullet points with action verbs and quantifiable metrics.",
  },
  {
    id: "application_answers",
    label: "Application Question Answers",
    icon: "💡",
    description: "STAR-framework responses for behavioral and situational screening questions.",
  },
  {
    id: "interview_questions",
    label: "Mock Interview Prep",
    icon: "🎯",
    description: "Anticipated questions tailored to the company with strong talking points.",
  },
];

export const JobModePanel: React.FC<JobModePanelProps> = ({
  onRunJobAction,
  isLoading,
  disabled = false,
  initialCvText = "",
}) => {
  const [jobActionKind, setJobActionKind] = useState<JobActionKind>("match_analysis");
  const [cvResumeText, setCvResumeText] = useState(initialCvText);
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cvResumeText.trim() && !jobDescription.trim()) return;
    onRunJobAction({
      jobActionKind,
      cvResumeText: cvResumeText.trim(),
      jobDescription: jobDescription.trim(),
      companyName: companyName.trim(),
      roleTitle: roleTitle.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Integrity banner */}
      <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Truthful Career Optimization:</strong> LexisAi aligns your real experience with job criteria. It never fabricates false employers, qualifications, or credentials.
        </div>
      </div>

      {/* Action choices */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          1. Select Job & Career Task
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {JOB_ACTIONS.map((action) => {
            const isSelected = jobActionKind === action.id;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => setJobActionKind(action.id)}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer active:scale-98 ${
                  isSelected
                    ? "bg-emerald-600/15 border-emerald-500/50 shadow-sm"
                    : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{action.icon}</span>
                  <span
                    className={`text-xs font-bold ${
                      isSelected ? "text-emerald-300" : "text-slate-200"
                    }`}
                  >
                    {action.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {action.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Role & Company (optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Target Job Title (optional):
          </label>
          <input
            type="text"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="E.g. Senior Project Manager"
            className="w-full text-xs text-slate-200 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 min-h-[38px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Target Company / Organization (optional):
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="E.g. Safaricom, UN, Stripe"
            className="w-full text-xs text-slate-200 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 min-h-[38px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Inputs: Job Description and CV/Resume */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Job Description / Requirements
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the target job post, responsibilities, and required qualifications here..."
            rows={5}
            className="w-full text-xs text-slate-100 bg-slate-900/90 border border-slate-800 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-600 resize-none leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Your CV / Resume / Experience Notes
          </label>
          <textarea
            value={cvResumeText}
            onChange={(e) => setCvResumeText(e.target.value)}
            placeholder="Paste your existing CV, career summary, accomplishments, or project list..."
            rows={5}
            className="w-full text-xs text-slate-100 bg-slate-900/90 border border-slate-800 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-600 resize-none leading-relaxed"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading || disabled || (!cvResumeText.trim() && !jobDescription.trim())}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
        >
          <Briefcase className="w-4 h-4" />
          <span>{isLoading ? "Analyzing Career Assets..." : "Analyze & Generate"}</span>
        </button>
      </div>
    </form>
  );
};
