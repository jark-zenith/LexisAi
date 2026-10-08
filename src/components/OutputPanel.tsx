import React, { useState } from "react";
import {
  Copy,
  Check,
  Download,
  FileDown,
  ArrowLeftRight,
  Layers,
  Sparkles,
  Clock,
  FileText,
  RefreshCw,
  Edit3,
  SplitSquareVertical,
  Trash2,
  Zap,
  Square,
  ExternalLink,
  Globe,
  AlertCircle,
} from "lucide-react";
import { TransformationItem } from "../types";
import { DiffViewer } from "./DiffViewer";
import { exportResultAsPdf } from "../utils/pdfExport";

interface OutputPanelProps {
  currentResult: TransformationItem | null;
  isLoading: boolean;
  streamingText?: string;
  isStreaming?: boolean;
  elapsedMs?: number;
  onStop?: () => void;
  onUseAsInput: (text: string) => void;
  onCopySuccess: () => void;
  onNewTask: () => void;
  onExportPdfSuccess?: () => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  currentResult,
  isLoading,
  streamingText = "",
  isStreaming = false,
  elapsedMs = 0,
  onStop,
  onUseAsInput,
  onCopySuccess,
  onNewTask,
  onExportPdfSuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExportSuccess, setPdfExportSuccess] = useState(false);
  const [pdfExportError, setPdfExportError] = useState<string | null>(null);

  const activeContent = currentResult
    ? isEditing
      ? editedText
      : currentResult.variations && currentResult.variations.length > 0
      ? currentResult.variations[activeVariationIndex]?.content || currentResult.outputText
      : currentResult.outputText
    : "";

  const handleCopy = async () => {
    if (!activeContent) return;
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      onCopySuccess();
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDownload = () => {
    if (!activeContent) return;
    const blob = new Blob([activeContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-text-result-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Metrics calculation
  const wordCount = activeContent.trim() ? activeContent.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = activeContent.length;
  const readingTimeSeconds = Math.max(1, Math.round((wordCount / 200) * 60));

  const handleExportPdf = async () => {
    if (!activeContent || isExportingPdf) return;
    setIsExportingPdf(true);
    setPdfExportError(null);
    try {
      await exportResultAsPdf({
        title: currentResult?.action
          ? `LexisAi — ${
              currentResult.action === "improve"
                ? "Grammar & Polish"
                : currentResult.action.charAt(0).toUpperCase() + currentResult.action.slice(1)
            } Result`
          : "LexisAi — Generated Result",
        action: currentResult?.action,
        tone: currentResult?.tone,
        format: currentResult?.format,
        mode: currentResult?.mode,
        text: activeContent,
        sources: currentResult?.sources,
        notes: currentResult?.notes,
        wordCount,
        charCount,
      });

      setPdfExportSuccess(true);
      if (onExportPdfSuccess) {
        onExportPdfSuccess();
      }
      setTimeout(() => setPdfExportSuccess(false), 2500);
    } catch (err: any) {
      console.error("Failed to export PDF: ", err);
      setPdfExportError(err?.message || "Failed to generate PDF. Please try again.");
      setTimeout(() => setPdfExportError(null), 4000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const inputWordCount = currentResult?.inputText?.trim()
    ? currentResult.inputText.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const lengthDeltaPercent =
    inputWordCount > 0 ? Math.round(((wordCount - inputWordCount) / inputWordCount) * 100) : 0;

  return (
    <div
      id="output-panel"
      className="flex flex-col bg-[#0c0c0e] rounded-2xl border border-slate-800 shadow-xl overflow-hidden transition-all"
    >
      {/* Panel Top Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            2. Generated Result
          </span>
          {currentResult?.action && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-600/15 text-blue-400 border border-blue-500/20 capitalize tracking-wide">
              {currentResult.action === "improve" ? "Grammar & Polish" : currentResult.action}
            </span>
          )}
          {currentResult?.tone && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-800 text-slate-300 border border-slate-700 capitalize tracking-wide hidden sm:inline-block">
              {currentResult.tone}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {currentResult && !isLoading && (
            <>
              {/* Clear / New Task Button */}
              <button
                id="output-new-task-btn"
                type="button"
                onClick={onNewTask}
                className="inline-flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1.5 min-h-[40px] sm:min-h-[36px] text-xs font-semibold rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 bg-slate-900 border border-slate-800 transition-colors cursor-pointer active:scale-95"
                title="Clear and start a fresh task"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Task</span>
              </button>

              {/* Compare / Diff toggle */}
              <button
                id="diff-toggle-btn"
                type="button"
                onClick={() => setShowDiff(!showDiff)}
                className={`inline-flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1.5 min-h-[40px] sm:min-h-[36px] text-xs font-semibold rounded-lg border transition-colors cursor-pointer active:scale-95 ${
                  showDiff
                    ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                    : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                }`}
                title="Compare Side-by-Side with Input"
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Compare</span>
              </button>

              {/* Edit Mode Toggle */}
              <button
                id="edit-output-btn"
                type="button"
                onClick={() => {
                  if (!isEditing) {
                    setEditedText(activeContent);
                    setIsEditing(true);
                  } else {
                    setIsEditing(false);
                  }
                }}
                className={`inline-flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1.5 min-h-[40px] sm:min-h-[36px] text-xs font-semibold rounded-lg border transition-colors cursor-pointer active:scale-95 ${
                  isEditing
                    ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                    : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                }`}
                title="Manually edit output"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isEditing ? "Done" : "Tweak"}</span>
              </button>

              {/* Use As Input Button */}
              <button
                id="use-as-input-btn"
                type="button"
                onClick={() => onUseAsInput(activeContent)}
                className="inline-flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1.5 min-h-[40px] sm:min-h-[36px] text-xs font-semibold rounded-lg text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer active:scale-95"
                title="Feed this output back into input for further editing"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Use as Input</span>
              </button>

              {/* Download as TXT Button */}
              <button
                id="download-btn"
                type="button"
                onClick={handleDownload}
                className="p-2 min-h-[40px] min-w-[40px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-800 bg-slate-900 cursor-pointer active:scale-95"
                title="Download as .txt"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {/* Export as PDF Button */}
              <button
                id="export-pdf-btn"
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className={`inline-flex items-center gap-1.5 px-3 py-2 sm:px-2.5 sm:py-1.5 min-h-[40px] sm:min-h-[36px] text-xs font-semibold rounded-lg border transition-all cursor-pointer active:scale-95 ${
                  pdfExportSuccess
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/40"
                    : isExportingPdf
                    ? "bg-slate-900 text-slate-400 border-slate-800 cursor-wait"
                    : "bg-red-950/20 text-red-300 hover:text-white hover:bg-red-900/30 border-red-500/30"
                }`}
                title="Export formatted AI result as a downloadable PDF file"
              >
                {isExportingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />
                    <span className="hidden sm:inline">Exporting...</span>
                  </>
                ) : pdfExportSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Exported!</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5 text-red-400" />
                    <span className="hidden sm:inline">Export PDF</span>
                  </>
                )}
              </button>

              {/* Primary Copy Result Button */}
              <button
                id="copy-result-btn"
                type="button"
                onClick={handleCopy}
                className={`inline-flex items-center gap-1.5 px-4 py-2 sm:px-3.5 sm:py-2 min-h-[40px] sm:min-h-[36px] rounded-lg text-xs font-bold shadow-lg transition-all cursor-pointer ${
                  copied
                    ? "bg-emerald-600 text-white shadow-emerald-950/40"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/40 active:scale-95"
                }`}
                title="Copy Result to Clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Result</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Variations Switcher (if multiple variations) */}
      {currentResult && currentResult.variations && currentResult.variations.length > 1 && !isLoading && (
        <div className="px-3.5 sm:px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Variations:
          </span>
          {currentResult.variations.map((variation, index) => (
            <button
              key={index}
              id={`variation-tab-${index}`}
              onClick={() => {
                setActiveVariationIndex(index);
                setIsEditing(false);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full min-h-[32px] transition-all cursor-pointer ${
                activeVariationIndex === index
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {variation.title || `Option ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col min-h-[300px] sm:min-h-[340px] relative">
        {isLoading && streamingText ? (
          /* Live Streaming Output Display */
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-800/80">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                  <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  <span>Streaming response live... ({(elapsedMs / 1000).toFixed(1)}s)</span>
                </span>
                {onStop && (
                  <button
                    type="button"
                    onClick={onStop}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="Stop generation"
                  >
                    <Square className="w-3 h-3 text-red-400 fill-red-400" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
              <div className="p-4 sm:p-5 bg-blue-500/5 rounded-xl border border-blue-500/30 text-slate-100 text-base sm:text-sm leading-relaxed whitespace-pre-wrap select-text selection:bg-blue-600/30 font-sans">
                {streamingText}
                <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1 align-middle" />
              </div>
            </div>
          </div>
        ) : isLoading ? (
          /* Loading skeleton */
          <div className="flex-1 flex flex-col justify-center items-center p-8 text-center space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Connecting to AI engine...
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Applying fastest model with minimal latency ({(elapsedMs / 1000).toFixed(1)}s)...
              </p>
            </div>
            {/* Shimmer Placeholder Lines */}
            <div className="w-full max-w-md space-y-2 pt-2">
              <div className="h-3.5 bg-slate-800/80 rounded-full animate-pulse w-full" />
              <div className="h-3.5 bg-slate-800/80 rounded-full animate-pulse w-5/6" />
              <div className="h-3.5 bg-slate-800/80 rounded-full animate-pulse w-4/6" />
            </div>
            {onStop && (
              <button
                type="button"
                onClick={onStop}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <Square className="w-3 h-3 text-red-400 fill-red-400" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        ) : !currentResult ? (
          /* Empty Initial State */
          <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 text-center text-slate-500">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300">
              Ready to generate & refine
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
              Enter your text above, pick an action, and click{" "}
              <strong className="text-slate-200">Process Text</strong>. Your result will appear right here.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-slate-400">
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                ✨ Fix Grammar & Polish
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                🔄 Rewrite
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                📝 Summarize
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                📋 Bullet Points
              </span>
            </div>
          </div>
        ) : showDiff ? (
          /* Diff Mode */
          <DiffViewer
            originalText={currentResult.inputText}
            modifiedText={activeContent}
          />
        ) : isEditing ? (
          /* Inline Edit Mode */
          <div className="flex-1 flex flex-col">
            <textarea
              id="output-edit-textarea"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full flex-1 p-3.5 text-base sm:text-sm leading-relaxed bg-slate-900/40 border border-blue-500/40 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none font-sans"
              rows={9}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 min-h-[38px] text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500 shadow-md shadow-blue-950/40 cursor-pointer"
              >
                Save Edits
              </button>
            </div>
          </div>
        ) : (
          /* Standard Output View: Elegant Dark Result Box */
          <div className="flex-1 flex flex-col justify-between">
            <div className="p-4 sm:p-5 bg-blue-500/5 rounded-xl border border-blue-500/20 text-slate-100 text-base sm:text-sm leading-relaxed whitespace-pre-wrap select-text selection:bg-blue-600/30 font-sans">
              {activeContent}
            </div>

            {/* Summary notes (if returned) */}
            {currentResult.notes && (
              <div
                className={`mt-3 px-3.5 py-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  currentResult.notes.includes("Search unavailable")
                    ? "bg-amber-950/25 border border-amber-500/30 text-amber-200"
                    : "bg-blue-600/10 border border-blue-500/20 text-blue-300"
                }`}
              >
                {currentResult.notes.includes("Search unavailable") ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                )}
                <span>{currentResult.notes}</span>
              </div>
            )}

            {/* Verified Sources & Citations (Research Mode / Web Grounding) OR Analytical Draft notice */}
            {currentResult.sources && currentResult.sources.length > 0 ? (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 mb-2">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>Verified Research Sources & Citations ({currentResult.sources.length}):</span>
                </div>
                <div className="space-y-1.5">
                  {currentResult.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between p-2 rounded-lg bg-slate-950/60 hover:bg-blue-950/30 border border-slate-800/80 hover:border-blue-500/30 transition-all text-xs text-slate-300 hover:text-blue-300"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate font-medium text-slate-200 group-hover:text-blue-200">
                          {src.title || src.uri}
                        </span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-blue-400 shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Live web grounding verified with Google Search. No fabricated links.
                </p>
              </div>
            ) : currentResult.mode === "research" ? (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <div className="font-semibold text-amber-300">
                    Search unavailable — analytical draft
                  </div>
                  <p className="mt-1 text-slate-400 text-[11px] leading-relaxed">
                    Google Search grounding is unavailable. This output is presented as an analytical draft using only information provided by the user. Synthesized or model-generated claims are not presented as verified research, and no external sources, dates, statistics, or citations are fabricated.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Metrics & Copy Footer */}
      {currentResult && !isLoading && (
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <strong className="text-slate-200 font-medium">{wordCount}</strong> words
            </span>
            <span>•</span>
            <span>
              <strong className="text-slate-200 font-medium">{charCount}</strong> chars
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              ~{readingTimeSeconds}s read
            </span>

            {lengthDeltaPercent !== 0 && (
              <>
                <span>•</span>
                <span
                  className={`font-medium ${
                    lengthDeltaPercent < 0
                      ? "text-emerald-400"
                      : "text-blue-400"
                  }`}
                >
                  {lengthDeltaPercent < 0 ? `-${Math.abs(lengthDeltaPercent)}% trimmed` : `+${lengthDeltaPercent}% expanded`}
                </span>
              </>
            )}

            {currentResult.elapsedMs !== undefined && currentResult.elapsedMs > 0 && (
              <>
                <span>•</span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400/90"
                  title="Total measured round-trip time"
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>{(currentResult.elapsedMs / 1000).toFixed(1)}s</span>
                </span>
              </>
            )}
          </div>

          {/* Prominent Actions in footer */}
          <div className="flex items-center gap-2">
            {/* Quick Export PDF Button in Footer */}
            <button
              id="quick-export-pdf-footer-btn"
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className={`inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[36px] rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                pdfExportSuccess
                  ? "text-emerald-400 bg-emerald-950/40 border border-emerald-500/30"
                  : isExportingPdf
                  ? "text-slate-400 bg-slate-900 border border-slate-800 cursor-wait"
                  : "text-red-300 hover:text-white hover:bg-red-950/40 bg-red-950/20 border border-red-500/30"
              }`}
              title="Download result as PDF"
            >
              {isExportingPdf ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-400" />
                  <span>Exporting...</span>
                </>
              ) : pdfExportSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PDF Saved!</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5 text-red-400" />
                  <span>Export PDF</span>
                </>
              )}
            </button>

            {/* Quick Copy Result Button in footer */}
            <button
              id="quick-copy-footer-btn"
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 min-h-[40px] sm:min-h-[36px] rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                copied
                  ? "text-emerald-400 bg-emerald-950/40 border border-emerald-500/30"
                  : "text-blue-400 hover:text-blue-300 hover:bg-blue-600/10 border border-blue-500/20"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Result</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* PDF Export Error Banner (if any) */}
      {pdfExportError && (
        <div className="px-4 py-2 bg-red-950/60 border-t border-red-500/30 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{pdfExportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPdfExportError(null)}
            className="text-red-400 hover:text-white font-medium ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
