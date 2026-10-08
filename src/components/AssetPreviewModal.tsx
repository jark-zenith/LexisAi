import React, { useState } from "react";
import {
  X,
  Check,
  FileText,
  Sparkles,
  RefreshCw,
  Eye,
  AlertCircle,
  File,
  CheckCircle2,
  ArrowRight,
  Maximize2,
} from "lucide-react";
import { PickedAsset } from "../types";

interface AssetPreviewModalProps {
  asset: PickedAsset | null;
  isOpen: boolean;
  onCancel: () => void;
  onContinue: (asset: PickedAsset, extractedText?: string) => void;
}

export const AssetPreviewModal: React.FC<AssetPreviewModalProps> = ({
  asset,
  isOpen,
  onCancel,
  onContinue,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [extractMode, setExtractMode] = useState<"ocr" | "describe" | "attach">("ocr");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !asset) return null;

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getSourceBadge = () => {
    switch (asset.source) {
      case "upload":
        return {
          icon: "📁",
          label: "Upload",
          badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        };
      case "camera":
        return {
          icon: "📷",
          label: "Camera",
          badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "photos":
        return {
          icon: "🖼️",
          label: "Photos",
          badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        };
      default:
        return {
          icon: "📎",
          label: "Asset",
          badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
        };
    }
  };

  const sourceBadge = getSourceBadge();

  const handleContinueClick = async () => {
    setErrorMsg(null);

    // Case 1: Text file -> Text is already parsed
    if (asset.isTextFile && asset.textSnippet) {
      onContinue(asset, asset.textSnippet);
      return;
    }

    // Case 2: Image with AI OCR / Description requested
    if (asset.isImage && asset.base64Data && extractMode !== "attach") {
      setIsProcessing(true);
      setProcessingStatus(
        extractMode === "ocr"
          ? "Extracting text and writing with Gemini AI..."
          : "Analyzing image content with Gemini AI..."
      );

      try {
        const response = await fetch("/api/extract-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: asset.base64Data,
            mimeType: asset.type,
            fileName: asset.name,
            prompt:
              extractMode === "ocr"
                ? "Extract and transcribe all text, handwriting, and written data in this image accurately. Preserve formatting, lists, and line breaks. If there is no text, briefly summarize the image."
                : "Describe what is depicted in this image concisely and clearly in 2-3 sentences for writing or messaging purposes.",
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to extract text from image.");
        }

        const extractedText = data.extractedText || "";
        onContinue(asset, extractedText);
      } catch (err: any) {
        console.warn("AI extraction warning:", err);
        // Fallback: If network or key issue, still allow continuing and attaching asset
        setErrorMsg(
          err?.message || "Could not extract text via AI. The file will be attached directly."
        );
        setTimeout(() => {
          onContinue(asset, "");
        }, 1500);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Case 3: Other file or direct attachment
    onContinue(asset, "");
  };

  return (
    <div
      id="asset-preview-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onCancel();
      }}
    >
      <div
        id="asset-preview-card"
        className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{sourceBadge.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="asset-preview-title" className="text-base font-bold text-white">
                  Asset Preview
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sourceBadge.badgeColor}`}
                >
                  {sourceBadge.label}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Confirm your selection before proceeding
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              id="cancel-preview-x-btn"
              type="button"
              onClick={onCancel}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer active:scale-95 transition-colors"
              aria-label="Cancel and Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Area - Scrollable */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Metadata Card */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                {asset.isImage ? "🖼️" : "📄"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-[280px]">
                  {asset.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatSize(asset.size)} &bull; {asset.type || "file"}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-medium text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800 shrink-0">
              Ready
            </span>
          </div>

          {/* Visual Preview Box */}
          {asset.isImage && asset.previewUrl && (
            <div className="relative w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center min-h-[220px] max-h-[340px]">
              <img
                id="asset-image-preview"
                src={asset.previewUrl}
                alt={asset.name}
                className="max-w-full max-h-[340px] w-auto h-auto object-contain rounded-lg"
              />
            </div>
          )}

          {/* Text File Content Preview */}
          {asset.isTextFile && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">File Content Preview:</span>
                <span>
                  {asset.textSnippet ? asset.textSnippet.length : 0} characters
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 max-h-[220px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {asset.textSnippet || "(Empty text file)"}
              </div>
            </div>
          )}

          {/* Other Document / Binary Preview */}
          {!asset.isImage && !asset.isTextFile && (
            <div className="p-6 rounded-xl bg-slate-950/80 border border-slate-800 text-center flex flex-col items-center justify-center gap-2">
              <File className="w-12 h-12 text-slate-500" />
              <p className="text-sm font-semibold text-white">{asset.name}</p>
              <p className="text-xs text-slate-400">
                Document attached. Tap continue to load this asset into your session.
              </p>
            </div>
          )}

          {/* Image Processing Options */}
          {asset.isImage && (
            <div className="flex flex-col gap-2 pt-1">
              <label className="text-xs font-semibold text-slate-300">
                Action on Continue:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExtractMode("ocr")}
                  className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    extractMode === "ocr"
                      ? "bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-xs"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Sparkles className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">Extract Text (OCR)</p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Extract text with Gemini to rewrite, summarize, or edit
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExtractMode("attach")}
                  className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    extractMode === "attach"
                      ? "bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-xs"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">Attach Image</p>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Keep image attached for current writing session
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Error message if any */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 shrink-0">
          <button
            id="cancel-asset-preview-btn"
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors cursor-pointer active:scale-95 disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            id="continue-asset-preview-btn"
            type="button"
            onClick={handleContinueClick}
            disabled={isProcessing}
            className="flex-1 sm:flex-none px-6 py-2.5 min-h-[44px] text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl border border-blue-500/30 transition-all shadow-md shadow-blue-900/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{processingStatus || "Processing..."}</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
