import { ToolAction, ToneType, FormatType } from "../types";

export type LexisMode =
  | "transform" // Core writing, rewriting, shortening, tone, etc.
  | "document"  // PDF & document understanding, Q&A, summary, simplify
  | "ocr"       // Image & screenshot text extraction + immediate rewrite workflow
  | "research"  // Research with live citations and source verification
  | "study"     // Flashcards, quizzes, study notes, revision summaries
  | "job"       // CV analysis, job match, cover letter, interview prep
  | "workflow" // Finished document workflows (Report, Proposal, Email, Cover Letter, CV, Assignment, Deck, Formal Letter)
  | "workspace"; // Project workspaces: multi-document intelligence, notes & grounded AI

export type LengthPreference = "concise" | "standard" | "detailed" | "comprehensive";

export interface WritingContext {
  audience?: string;
  purpose?: string;
  tone?: ToneType | string;
  length?: LengthPreference;
  format?: FormatType | string;
  instructions?: string;
}

export type StudyOutputKind =
  | "summary"
  | "key_points"
  | "flashcards"
  | "quiz"
  | "practice_questions"
  | "simple_explanation";

export type StudyDifficulty = "beginner" | "intermediate" | "advanced";

export interface StudyOptions {
  outputKind: StudyOutputKind;
  difficulty: StudyDifficulty;
  customTopic?: string;
}

export type JobActionKind =
  | "match_analysis"
  | "improve_cv"
  | "tailored_cover_letter"
  | "application_answers"
  | "interview_questions";

export interface JobOptions {
  jobActionKind: JobActionKind;
  jobDescription?: string;
  cvResumeText?: string;
  companyName?: string;
  roleTitle?: string;
}

export type FinishedDocumentType =
  | "report"
  | "proposal"
  | "professional_email"
  | "cover_letter"
  | "cv_resume"
  | "assignment_draft"
  | "presentation_content"
  | "formal_letter";

export interface WorkflowOptions {
  documentType: FinishedDocumentType;
  topicTitle: string;
  roughNotes: string;
  targetAudience?: string;
  keyGoals?: string;
}

export type DocumentTaskType =
  | "summarize"
  | "explain"
  | "extract_key_points"
  | "simplify"
  | "qa"
  | "rewrite_section";

export interface DocumentTaskOptions {
  task: DocumentTaskType;
  questionOrSection?: string;
}

export interface ResearchSourceItem {
  title: string;
  uri: string;
  snippet?: string;
}

export interface ResearchOptions {
  topic: string;
  enableLiveWeb?: boolean;
}
