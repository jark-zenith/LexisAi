import React, { useRef } from "react";
import {
  Sparkles,
  RefreshCw,
  AlignLeft,
  Minimize2,
  Maximize2,
  ListOrdered,
  PenTool,
  Trash2,
  Clipboard,
  Layers,
  ChevronDown,
  Wand2,
  SlidersHorizontal,
  Paperclip,
  Eye,
  AlertCircle,
  Zap,
} from "lucide-react";
import { ToolAction, ToneType, FormatType, PresetExample, PickedAsset, FREE_ACTIONS_LIMIT, PRO_ACTIONS_LIMIT, PlanType } from "../types";
import { TOOL_ACTION_CONFIG, TONE_CONFIG, FORMAT_CONFIG, PRESET_EXAMPLES } from "../data/presets";
import { Coins } from "lucide-react";

interface InputPanelProps {
  inputText: string;
  setInputText: (text: string) => void;
  action: ToolAction;
  setAction: (action: ToolAction) => void;
  tone: ToneType | undefined;
  setTone: (tone: ToneType | undefined) => void;
  format: FormatType;
  setFormat: (format: FormatType) => void;
  customInstruction: string;
  setCustomInstruction: (instruction: string) => void;
  generateVariations: boolean;
  setGenerateVariations: (enabled: boolean) => void;
  onTransform: () => void;
  onNewTask: () => void;
  isLoading: boolean;
  onApplyPreset: (preset: PresetExample) => void;
  onOpenAssetPicker: () => void;
  attachedAsset?: PickedAsset | null;
  onViewAssetPreview?: (asset: PickedAsset) => void;
  onRemoveAsset?: () => void;
  usageCount?: number;
  credits?: number;
  plan?: PlanType;
  isUsageLimitReached?: boolean;
  onOpenUpgrade?: () => void;
  onOpenCredits?: () => void;
}

const ACTION_ICONS: Record<ToolAction, React.ElementType> = {
  rewrite: RefreshCw,
  improve: Sparkles,
  summarize: AlignLeft,
  tone: SlidersHorizontal,
  shorten: Minimize2,
  expand: Maximize2,
  bulletize: ListOrdered,
  generate: PenTool,
  grammar: Sparkles,
};

export const InputPanel: React.FC<InputPanelProps> = ({
  inputText,
  setInputText,
  action,
  setAction,
  tone,
  setTone,
  format,
  setFormat,
  customInstruction,
  setCustomInstruction,
  generateVariations,
  setGenerateVariations,
  onTransform,
  onNewTask,
  isLoading,
  onApplyPreset,
  onOpenAssetPicker,
  attachedAsset,
  onViewAssetPreview,
  onRemoveAsset,
  usageCount = 0,
  credits = 0,
  plan = PlanType.FREE,
  isUsageLimitReached = false,
  onOpenUpgrade,
  onOpenCredits,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isPro = plan === PlanType.PRO;
  const currentLimit = isPro ? PRO_ACTIONS_LIMIT : FREE_ACTIONS_LIMIT;

  // If on Free plan and monthly allowance reached, user can continue if they have credits
  const isMonthlyLimitReached = usageCount >= currentLimit;
  const isUsingCredits = !isPro && isMonthlyLimitReached && credits > 0;
  const isUsageBlocked = !isPro && isMonthlyLimitReached && credits <= 0;

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = inputText.length;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    } catch (err) {
      console.warn("Clipboard access denied or unavailable", err);
    }
  };

  const handleClear = () => {
    onNewTask();
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const isGenerateMode = action === "generate";

  const getActionLabel = () => {
    switch (action) {
      case "rewrite":
        return "Rewrite Text";
      case "improve":
      case "grammar":
        return "Improve Grammar & Polish";
      case "summarize":
        return "Summarize Text";
      case "shorten":
        return "Shorten Text";
      case "expand":
        return "Expand Text";
      case "bulletize":
        return "Create Bullet Points";
      case "generate":
        return "Generate Text";
      default:
        return "Process Text";
    }
  };

  return (
    <div
      id="input-panel"
      className="flex flex-col bg-[#0c0c0e] rounded-2xl border border-slate-800 shadow-xl overflow-hidden transition-all"
    >
      {/* Panel Top Header: Tool Actions Navigation */}
      <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              1. Choose Action
            </span>
          </div>

          {/* Sample Preset Dropdown */}
          <div className="relative inline-block text-left">
            <select
              id="preset-select"
              aria-label="Load Example Template"
              onChange={(e) => {
                const selected = PRESET_EXAMPLES.find((p) => p.id === e.target.value);
                if (selected) {
                  onApplyPreset(selected);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              className="text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 min-h-[36px] hover:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">
                💡 Load Example...
              </option>
              {PRESET_EXAMPLES.map((preset) => (
                <option key={preset.id} value={preset.id} className="bg-slate-900 text-slate-200">
                  {preset.category}: {preset.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Tabs Grid - Responsive for mobile & touch */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {TOOL_ACTION_CONFIG.map((tool) => {
            const Icon = ACTION_ICONS[tool.id as ToolAction] || Sparkles;
            const isActive = action === tool.id;
            return (
              <button
                key={tool.id}
                id={`action-tab-${tool.id}`}
                onClick={() => setAction(tool.id as ToolAction)}
                type="button"
                className={`flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all text-left cursor-pointer active:scale-98 ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm"
                    : "bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
                }`}
                title={tool.description}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-400" : "text-slate-400"}`} />
                <span className="truncate">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Textarea Area */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col min-h-[260px] sm:min-h-[280px]">
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="input-text-area"
            className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
          >
            {isGenerateMode ? "Topic / Prompt to Generate From:" : "Your Input Text:"}
          </label>

          <div className="flex items-center gap-1.5">
            {/* Asset Picker Button */}
            <button
              id="asset-picker-btn"
              type="button"
              onClick={onOpenAssetPicker}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-blue-400 hover:text-white hover:bg-blue-600/20 rounded-lg border border-blue-500/30 bg-blue-600/10 transition-all cursor-pointer active:scale-95 shadow-xs"
              title="Asset Picker: Upload file, take photo with camera, or choose from gallery"
            >
              <Paperclip className="w-3.5 h-3.5 text-blue-400" />
              <span>Asset Picker</span>
            </button>

            <button
              id="paste-btn"
              type="button"
              onClick={handlePaste}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-900/80 transition-colors cursor-pointer"
              title="Paste from clipboard"
            >
              <Clipboard className="w-3.5 h-3.5 text-blue-400" />
              <span>Paste</span>
            </button>
            {(inputText.length > 0) && (
              <button
                id="clear-btn"
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg border border-slate-800/80 transition-colors cursor-pointer"
                title="Clear input and start new task"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Attached Asset Banner if present */}
        {attachedAsset && (
          <div
            id="attached-asset-banner"
            className="mb-2.5 flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 animate-in fade-in duration-200"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">{attachedAsset.isImage ? "🖼️" : "📄"}</span>
              <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-[240px]">
                {attachedAsset.name}
              </span>
              <span className="text-[11px] text-slate-500 shrink-0">
                ({(attachedAsset.size / 1024).toFixed(0)} KB)
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onViewAssetPreview && (
                <button
                  type="button"
                  id="preview-attached-asset-btn"
                  onClick={() => onViewAssetPreview(attachedAsset)}
                  className="px-2.5 py-1 text-[11px] font-medium text-blue-400 hover:text-white hover:bg-blue-600/20 rounded-md border border-blue-500/30 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>Preview</span>
                </button>
              )}
              {onRemoveAsset && (
                <button
                  type="button"
                  id="remove-attached-asset-btn"
                  onClick={onRemoveAsset}
                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-md transition-colors cursor-pointer"
                  title="Remove attached asset"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="relative flex-1 flex flex-col">
          <textarea
            id="input-text-area"
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isGenerateMode
                ? "E.g., Write a follow-up email after a client pitch meeting thanking them and outlining next week's demo timeline..."
                : "Type or paste your text here (email, message, cover letter, rough notes, draft, or article)..."
            }
            className="w-full flex-1 p-3.5 text-base sm:text-sm leading-relaxed bg-slate-900/30 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
            rows={7}
          />
        </div>

        {/* Word / Char Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-1">
          <div className="flex items-center gap-3">
            <span>
              <strong className="text-slate-300 font-medium">{wordCount}</strong> words
            </span>
            <span>•</span>
            <span>
              <strong className="text-slate-300 font-medium">{charCount}</strong> characters
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Press <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px] text-slate-300">⌘</kbd> + <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px] text-slate-300">Enter</kbd> to run
          </span>
        </div>
      </div>

      {/* Refinements & Output Customization Bar */}
      <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/40 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Tone Selector */}
          <div>
            <label htmlFor="tone-select" className="block text-xs font-medium text-slate-400 mb-1">
              Desired Tone:
            </label>
            <select
              id="tone-select"
              value={tone || ""}
              onChange={(e) => setTone((e.target.value as ToneType) || undefined)}
              className="w-full text-base sm:text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 min-h-[42px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-400">Auto / Keep Natural Tone</option>
              {TONE_CONFIG.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                  {t.label} ({t.desc})
                </option>
              ))}
            </select>
          </div>

          {/* Target Medium / Format Selector */}
          <div>
            <label htmlFor="format-select" className="block text-xs font-medium text-slate-400 mb-1">
              Target Format:
            </label>
            <select
              id="format-select"
              value={format}
              onChange={(e) => setFormat(e.target.value as FormatType)}
              className="w-full text-base sm:text-xs font-medium text-slate-200 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 min-h-[42px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
            >
              {FORMAT_CONFIG.map((f) => (
                <option key={f.id} value={f.id} className="bg-slate-900 text-slate-200">
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Instructions Input (Optional) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="custom-instruction-input" className="text-xs font-medium text-slate-400">
              Custom Instruction (optional):
            </label>
            {customInstruction && (
              <button
                type="button"
                onClick={() => setCustomInstruction("")}
                className="text-[11px] text-slate-500 hover:text-slate-300"
              >
                Reset
              </button>
            )}
          </div>
          <input
            id="custom-instruction-input"
            type="text"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="E.g., Include polite signoff, sound enthusiastic, mention tomorrow's 2 PM sync..."
            className="w-full text-base sm:text-xs text-slate-200 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2 min-h-[42px] placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Daily Limit Notice Banner if Limit Reached */}
        {isUsageLimitReached && (
          <div
            id="input-limit-reached-banner"
            className="mb-3 p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-start sm:items-center gap-2.5 text-xs">
              <span className="text-base shrink-0 select-none">💙</span>
              <div>
                <strong className="text-white">
                  {isPro
                    ? `Monthly limit reached (${PRO_ACTIONS_LIMIT}/${PRO_ACTIONS_LIMIT}).`
                    : "You've used today's 5 free actions."}
                </strong>{" "}
                <span className="text-slate-300">
                  {isPro
                    ? "Allowance resets next month. You can add AI Credits to continue immediately."
                    : "Your free actions reset tomorrow. You can also upgrade to Pro for higher usage and AI Credits."}
                </span>
              </div>
            </div>
            {!isPro && onOpenUpgrade && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="input-banner-upgrade-btn"
                  type="button"
                  onClick={onOpenUpgrade}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>Upgrade to Pro</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Options & Main Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Multiple Variations Toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input
              id="variations-toggle"
              type="checkbox"
              checked={generateVariations}
              onChange={(e) => setGenerateVariations(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-700 bg-slate-900 focus:ring-blue-500"
            />
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Generate 3 Variations</span>
            </div>
          </label>

          {/* Action Buttons Group */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              id="new-task-btn"
              type="button"
              onClick={handleClear}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-3 min-h-[44px] rounded-xl text-xs font-bold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Clear text and reset for a fresh task"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear / New Task</span>
            </button>

            {/* Primary Action Button */}
            <button
              id="transform-submit-btn"
              type="button"
              onClick={() => {
                if (isUsageBlocked && onOpenUpgrade) {
                  onOpenUpgrade();
                  return;
                }
                onTransform();
              }}
              disabled={isLoading || (!inputText.trim() && action !== "generate")}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl text-sm font-bold text-white transition-all active:scale-95 cursor-pointer ${
                isUsageBlocked
                  ? "bg-amber-600 hover:bg-amber-500 shadow-amber-950/50"
                  : isUsingCredits
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50"
                  : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-blue-950/50"
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#09090b] shadow-lg disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isUsageBlocked ? (
                <>
                  <Zap className="w-4 h-4 text-amber-200" />
                  <span>Limit Reached &bull; Get Credits / Pro</span>
                </>
              ) : isUsingCredits ? (
                <>
                  <Coins className="w-4 h-4 text-emerald-200" />
                  <span>{getActionLabel()} (1 Credit)</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>{getActionLabel()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
