import { ToolAction, ToneType, FormatType } from "../types";

export const AUTOSAVE_STORAGE_KEY = "lexisai_autosaved_draft";

export interface AutoSavedState {
  inputText: string;
  action: ToolAction;
  tone?: ToneType;
  format: FormatType;
  lastSavedAt: number;
}

/**
 * Loads the auto-saved draft state from localStorage.
 * Recovers inputText, action, tone, and format after accidental refreshes.
 */
export function loadAutoSavedState(): Partial<AutoSavedState> {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return {
      inputText: typeof parsed.inputText === "string" ? parsed.inputText : undefined,
      action: typeof parsed.action === "string" ? (parsed.action as ToolAction) : undefined,
      tone: typeof parsed.tone === "string" ? (parsed.tone as ToneType) : undefined,
      format: typeof parsed.format === "string" ? (parsed.format as FormatType) : undefined,
      lastSavedAt: typeof parsed.lastSavedAt === "number" ? parsed.lastSavedAt : undefined,
    };
  } catch (err) {
    console.warn("Could not read auto-saved draft from localStorage:", err);
    return {};
  }
}

/**
 * Persists the current input text, action, tone, and format to localStorage.
 */
export function saveDraftToStorage(draft: {
  inputText: string;
  action: ToolAction;
  tone?: ToneType;
  format: FormatType;
}): void {
  try {
    const payload: AutoSavedState = {
      inputText: draft.inputText,
      action: draft.action,
      tone: draft.tone,
      format: draft.format,
      lastSavedAt: Date.now(),
    };
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Could not auto-save draft to localStorage:", err);
  }
}

/**
 * Clears the auto-saved draft from localStorage.
 */
export function clearAutoSavedDraft(): void {
  try {
    localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch (err) {
    console.warn("Could not clear auto-saved draft:", err);
  }
}
