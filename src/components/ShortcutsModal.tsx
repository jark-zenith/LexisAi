import React from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "⌘ + Enter / Ctrl + Enter", desc: "Run text transformation / generate" },
    { key: "Esc", desc: "Close open modals / cancel edit mode" },
    { key: "Paste Button", desc: "Quickly insert text from system clipboard" },
    { key: "Copy Text", desc: "Instant 1-click copy with feedback" },
    { key: "Use as Input", desc: "Feed output back into editor for iterative refining" },
  ];

  return (
    <div
      id="shortcuts-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="shortcuts-modal"
        className="bg-[#0c0c0e] w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">
              Tips & Shortcuts
            </h2>
          </div>
          <button
            id="close-shortcuts-btn"
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer active:scale-95"
            aria-label="Close Shortcuts Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {shortcuts.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-slate-800/80 last:border-0">
              <span className="text-slate-300 font-medium">{item.desc}</span>
              <kbd className="px-2 py-1 rounded bg-slate-900 text-slate-200 font-mono text-[11px] border border-slate-700 shadow-xs">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
