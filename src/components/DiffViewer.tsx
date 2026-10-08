import React from "react";

interface DiffViewerProps {
  originalText: string;
  modifiedText: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ originalText, modifiedText }) => {
  return (
    <div id="diff-viewer" className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
      {/* Original Side */}
      <div className="flex flex-col bg-slate-900/80 rounded-lg p-3 border border-slate-800">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400 font-medium">
          <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Original Text
          </span>
          <span className="text-[11px] text-slate-500">{originalText.trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <p className="whitespace-pre-wrap text-slate-300 leading-relaxed font-mono text-[12px] select-text">
          {originalText || "(No original text provided)"}
        </p>
      </div>

      {/* Enhanced Side */}
      <div className="flex flex-col bg-blue-950/20 rounded-lg p-3 border border-blue-500/30">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-blue-900/40 text-slate-400 font-medium">
          <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            AI Refined Output
          </span>
          <span className="text-[11px] text-slate-500">{modifiedText.trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <p className="whitespace-pre-wrap text-slate-100 leading-relaxed font-mono text-[12px] select-text">
          {modifiedText || "(No output yet)"}
        </p>
      </div>
    </div>
  );
};

