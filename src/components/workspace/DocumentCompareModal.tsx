import React, { useState } from "react";
import { X, GitCompare, Sparkles, ArrowRight, FileText } from "lucide-react";
import { WorkspaceDocument } from "../../types";

interface DocumentCompareModalProps {
  documents: WorkspaceDocument[];
  initialDocId?: string;
  isOpen: boolean;
  onClose: () => void;
  onCompareWithAi: (docA: WorkspaceDocument, docB: WorkspaceDocument) => void;
}

export const DocumentCompareModal: React.FC<DocumentCompareModalProps> = ({
  documents,
  initialDocId,
  isOpen,
  onClose,
  onCompareWithAi,
}) => {
  const readyDocs = documents.filter((d) => d.status === "ready" && d.extractedText.trim().length > 0);

  const [docAId, setDocAId] = useState<string>(() => {
    return initialDocId || (readyDocs[0] ? readyDocs[0].id : "");
  });

  const [docBId, setDocBId] = useState<string>(() => {
    const second = readyDocs.find((d) => d.id !== (initialDocId || (readyDocs[0] ? readyDocs[0].id : "")));
    return second ? second.id : readyDocs[1]?.id || "";
  });

  if (!isOpen) return null;

  const docA = readyDocs.find((d) => d.id === docAId);
  const docB = readyDocs.find((d) => d.id === docBId);

  const handleRunCompare = () => {
    if (!docA || !docB) return;
    onCompareWithAi(docA, docB);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-[#0c0c0e] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Compare Workspace Documents</h2>
              <p className="text-xs text-slate-400">
                Compare two documents to analyze differences, overlaps, and changes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {readyDocs.length < 2 ? (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300">
              You need at least two documents with readable text in this workspace to compare them. Please upload another document.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Document A selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Base Document (A)
                </label>
                <select
                  value={docAId}
                  onChange={(e) => setDocAId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  {readyDocs.map((d) => (
                    <option key={`a-${d.id}`} value={d.id}>
                      {d.name} ({d.wordCount} words)
                    </option>
                  ))}
                </select>
                {docA && (
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {docA.extractedText.slice(0, 100)}...
                  </p>
                )}
              </div>

              {/* Document B selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Comparison Document (B)
                </label>
                <select
                  value={docBId}
                  onChange={(e) => setDocBId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  {readyDocs.map((d) => (
                    <option key={`b-${d.id}`} value={d.id}>
                      {d.name} ({d.wordCount} words)
                    </option>
                  ))}
                </select>
                {docB && (
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {docB.extractedText.slice(0, 100)}...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRunCompare}
            disabled={!docA || !docB || docA.id === docB.id}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all cursor-pointer shadow-sm shadow-blue-950/40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Comparison</span>
          </button>
        </div>
      </div>
    </div>
  );
};
