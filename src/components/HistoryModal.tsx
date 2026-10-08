import React, { useState } from "react";
import { X, History, Trash2, ArrowLeftRight, Copy, Check, Sparkles, Clock } from "lucide-react";
import { TransformationItem } from "../types";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: TransformationItem[];
  onSelectHistoryItem: (item: TransformationItem) => void;
  onClearHistory: () => void;
  onCopyText: (text: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelectHistoryItem,
  onClearHistory,
  onCopyText,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    onCopyText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      id="history-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="history-modal"
        className="bg-[#0c0c0e] w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">
              Session History ({history.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                id="clear-history-btn"
                type="button"
                onClick={onClearHistory}
                className="text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 px-3 py-2 min-h-[40px] sm:min-h-0 rounded-lg transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              id="close-history-btn"
              type="button"
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer active:scale-95"
              aria-label="Close History Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content / List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-slate-300">No saved history yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Your generated texts and rewrites during this session will appear here.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                id={`history-item-${item.id}`}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/40 transition-all group"
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-blue-600/10 text-blue-400 border border-blue-500/20">
                      {item.action}
                    </span>
                    {item.tone && (
                      <span className="text-xs text-slate-400 capitalize">
                        • {item.tone}
                      </span>
                    )}
                    {item.format && item.format !== "general" && (
                      <span className="text-xs text-slate-500 capitalize">
                        • {item.format}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Content Preview */}
                <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed font-sans bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  {item.outputText}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(item.id, item.outputText)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 rounded-md hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectHistoryItem(item);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-400 bg-blue-600/10 border border-blue-500/30 rounded-md hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>Restore to Editor</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
