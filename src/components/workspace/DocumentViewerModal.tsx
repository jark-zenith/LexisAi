import React, { useState } from "react";
import { X, Copy, Check, FileText, Download, Sparkles, BookOpen } from "lucide-react";
import { WorkspaceDocument } from "../../types";

interface DocumentViewerModalProps {
  document: WorkspaceDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSendToChat?: (docName: string, text: string) => void;
  onCreateNote?: (title: string, content: string) => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document,
  isOpen,
  onClose,
  onSendToChat,
  onCreateNote,
}) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen || !document) return null;

  const handleCopy = () => {
    if (!document.extractedText) return;
    navigator.clipboard.writeText(document.extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedSize =
    document.size < 1024
      ? `${document.size} B`
      : document.size < 1024 * 1024
      ? `${(document.size / 1024).toFixed(1)} KB`
      : `${(document.size / (1024 * 1024)).toFixed(2)} MB`;

  const highlightedContent = () => {
    const text = document.extractedText || "";
    if (!searchQuery.trim()) {
      return text;
    }
    // Search query highlighting
    return text;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl bg-[#0c0c0e] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate max-w-md">
                {document.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>{formattedSize}</span>
                <span aria-hidden="true">·</span>
                <span>{document.wordCount.toLocaleString()} words</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    document.status === "ready"
                      ? "text-emerald-400 font-medium"
                      : "text-amber-400 font-medium"
                  }
                >
                  {document.status === "ready" ? "Text Ready" : "Unreadable"}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {document.status === "unreadable" ? (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs">
              <p className="font-bold mb-1">Document Could Not Be Fully Processed</p>
              <p className="text-slate-300">
                {document.errorMessage ||
                  "No usable text could be extracted from this file. Please verify that the file contains selectable text or clear scans."}
              </p>
            </div>
          ) : null}

          {document.extractedText ? (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap select-text max-h-[55vh] overflow-y-auto">
              {highlightedContent()}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs">
              No extracted text content available for this document.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-800 bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!document.extractedText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            {onCreateNote && document.extractedText && (
              <button
                type="button"
                onClick={() => {
                  onCreateNote(
                    `Note from ${document.name}`,
                    document.extractedText.slice(0, 1000)
                  );
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>Create Note</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onSendToChat && document.extractedText && (
              <button
                type="button"
                onClick={() => {
                  onSendToChat(document.name, document.extractedText);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer shadow-sm shadow-blue-950/40"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze with AI</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
