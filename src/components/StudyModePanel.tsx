import React, { useState } from "react";
import { GraduationCap, BookOpen, Layers, CheckSquare, Sparkles, HelpCircle, FileText } from "lucide-react";
import { StudyOptions, StudyOutputKind, StudyDifficulty } from "../types";

interface StudyModePanelProps {
  onRunStudy: (options: StudyOptions, notesText: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  initialText?: string;
}

const STUDY_OUTPUTS: Array<{
  id: StudyOutputKind;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    id: "summary",
    label: "Revision Summary",
    icon: "📑",
    description: "Crisp chapter summary highlighting high-yield exam takeaways.",
  },
  {
    id: "key_points",
    label: "Key Concepts",
    icon: "🎯",
    description: "Core definitions, formulas, and fundamental principles.",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    icon: "🎴",
    description: "Front/Back Q&A study cards for spaced repetition.",
  },
  {
    id: "quiz",
    label: "Practice Quiz",
    icon: "📝",
    description: "Multiple-choice & short answer quiz with full answer keys.",
  },
  {
    id: "practice_questions",
    label: "Exam Practice Questions",
    icon: "❓",
    description: "Open-ended critical thinking and scenario-based exam prompts.",
  },
  {
    id: "simple_explanation",
    label: "Explain Like I'm 5",
    icon: "🧒",
    description: "Intuitive analogies and real-world everyday metaphors.",
  },
];

export const StudyModePanel: React.FC<StudyModePanelProps> = ({
  onRunStudy,
  isLoading,
  disabled = false,
  initialText = "",
}) => {
  const [outputKind, setOutputKind] = useState<StudyOutputKind>("summary");
  const [difficulty, setDifficulty] = useState<StudyDifficulty>("intermediate");
  const [studyText, setStudyText] = useState(initialText);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studyText.trim()) return;
    onRunStudy({ outputKind, difficulty }, studyText.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Output kind selection */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          1. Choose Study Output
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STUDY_OUTPUTS.map((out) => {
            const isSelected = outputKind === out.id;
            return (
              <button
                key={out.id}
                type="button"
                onClick={() => setOutputKind(out.id)}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer active:scale-98 ${
                  isSelected
                    ? "bg-purple-600/15 border-purple-500/50 shadow-sm"
                    : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{out.icon}</span>
                  <span
                    className={`text-xs font-bold ${
                      isSelected ? "text-purple-300" : "text-slate-200"
                    }`}
                  >
                    {out.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {out.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Difficulty selector */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          2. Target Difficulty Level
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(["beginner", "intermediate", "advanced"] as StudyDifficulty[]).map((level) => {
            const isSelected = difficulty === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setDifficulty(level)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-purple-600 text-white border-purple-500 shadow-sm"
                    : "bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800"
                }`}
              >
                {level === "beginner" ? "🌱 Beginner / Intro" : level === "intermediate" ? "📘 Intermediate" : "🔬 Advanced / Mastery"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes / Material input */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          3. Study Notes, Lecture Text, or Topic
        </label>
        <textarea
          value={studyText}
          onChange={(e) => setStudyText(e.target.value)}
          placeholder="Paste lecture notes, textbook excerpts, syllabi, or bullet points here to generate study tools..."
          rows={4}
          className="w-full text-xs text-slate-100 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-slate-600 resize-none leading-relaxed"
        />
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading || disabled || !studyText.trim()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 active:scale-98 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-purple-950/40 cursor-pointer"
        >
          <GraduationCap className="w-4 h-4" />
          <span>{isLoading ? "Generating Study Materials..." : "Generate Study Tools"}</span>
        </button>
      </div>
    </form>
  );
};
