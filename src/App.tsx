import React, { useState, useEffect, useCallback, useRef } from "react";
import { AppSidebar } from "./components/layout/AppSidebar";
import { TopHeader } from "./components/layout/TopHeader";
import { MobileNavigation } from "./components/layout/MobileNavigation";
import { QuickPills } from "./components/QuickPills";
import { InputPanel } from "./components/InputPanel";
import { OutputPanel } from "./components/OutputPanel";
import { HistoryModal } from "./components/HistoryModal";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { FeedbackModal } from "./components/FeedbackModal";
import { AssetPickerModal } from "./components/AssetPickerModal";
import { AssetPreviewModal } from "./components/AssetPreviewModal";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { UpgradeModal } from "./components/UpgradeModal";
import { DocumentModePanel } from "./components/DocumentModePanel";
import { ResearchModePanel } from "./components/ResearchModePanel";
import { StudyModePanel } from "./components/StudyModePanel";
import { JobModePanel } from "./components/JobModePanel";
import { WorkflowModePanel } from "./components/WorkflowModePanel";
import { WritingContextDrawer } from "./components/WritingContextDrawer";
import { WorkspaceDashboard } from "./components/workspace/WorkspaceDashboard";
import { WorkspaceDetail } from "./components/workspace/WorkspaceDetail";
import {
  Workspace,
  WorkspaceSummary,
  ToolAction,
  ToneType,
  FormatType,
  TransformationItem,
  PresetExample,
  PickedAsset,
  PlanType,
  LexisMode,
  WritingContext,
  DocumentTaskOptions,
  ResearchOptions,
  StudyOptions,
  JobOptions,
  WorkflowOptions,
} from "./types";
import {
  loadUsageState,
  incrementUsage,
  loadUserPlan,
  isPlanLimitReached,
  checkActionAccess,
  syncServerSubscription,
  fetchServerCredits,
  getOrCreateUserId,
} from "./utils/usageManager";
import { verifyTransactionOnServer } from "./utils/paystackClient";
import {
  fetchWorkspaces,
  fetchWorkspace,
  createWorkspaceApi,
  updateWorkspaceApi,
  deleteWorkspaceApi,
} from "./utils/workspaceClient";
import { Heart, Lock, LogIn, UserPlus, Shield } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { AuthModal } from "./components/auth/AuthModal";
import { AccountSettingsModal } from "./components/auth/AccountSettingsModal";
import { TermsModal } from "./components/auth/TermsModal";
import { getAuthHeaders } from "./utils/authClient";
import {
  loadAutoSavedState,
  saveDraftToStorage,
} from "./utils/autoSaveManager";

export default function App() {
  const { isAuthenticated, user, openAuthModal } = useAuth();

  // Mode selection state
  const [currentMode, setCurrentMode] = useState<LexisMode>("transform");

  // Initial Auto-Saved Draft recovery from localStorage
  const initialDraftRef = useRef(loadAutoSavedState());

  // Core Writing States recovered from auto-save
  const [inputText, setInputText] = useState<string>(() => initialDraftRef.current.inputText ?? "");
  const [action, setAction] = useState<ToolAction>(() => initialDraftRef.current.action ?? "rewrite");
  const [tone, setTone] = useState<ToneType | undefined>(() => initialDraftRef.current.tone ?? undefined);
  const [format, setFormat] = useState<FormatType>(() => initialDraftRef.current.format ?? "general");
  const [customInstruction, setCustomInstruction] = useState<string>("");
  const [generateVariations, setGenerateVariations] = useState<boolean>(false);

  // Global Writing Context
  const [writingContext, setWritingContext] = useState<WritingContext>({});

  // Loading & Generation States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [currentResult, setCurrentResult] = useState<TransformationItem | null>(null);
  const [history, setHistory] = useState<TransformationItem[]>([]);

  // Refs for request lifecycle & debouncing
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const lastSubmissionTimeRef = useRef<number>(0);

  // Asset Picker States
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState<boolean>(false);
  const [previewingAsset, setPreviewingAsset] = useState<PickedAsset | null>(null);
  const [attachedAsset, setAttachedAsset] = useState<PickedAsset | null>(null);

  // Plan, Usage & Credits States
  const [userPlan, setUserPlan] = useState<PlanType>(() => loadUserPlan());
  const [usage, setUsage] = useState(() => loadUsageState());
  const [credits, setCredits] = useState<number>(0);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [upgradeModalTab, setUpgradeModalTab] = useState<"pro" | "credits">("pro");
  const isUsageLimitReached = isPlanLimitReached(usage.count, userPlan);

  // Modals & UI States
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Responsive Layout & Sidebar States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("lexis_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("lexis_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const addToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Ref tracking current draft state for the auto-save loop
  const currentDraftRef = useRef({ inputText, action, tone, format });
  useEffect(() => {
    currentDraftRef.current = { inputText, action, tone, format };
  }, [inputText, action, tone, format]);

  // Auto-save: persists inputText, action, tone, and format to localStorage every 5 seconds
  useEffect(() => {
    const saveCurrentDraft = () => {
      saveDraftToStorage(currentDraftRef.current);
    };

    // Auto-save interval every 5 seconds (5000ms)
    const intervalId = setInterval(saveCurrentDraft, 5000);

    // Save on beforeunload so no progress is lost on accidental refresh or close
    window.addEventListener("beforeunload", saveCurrentDraft);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("beforeunload", saveCurrentDraft);
    };
  }, []);

  // Notify user if a previous unsaved draft was restored
  useEffect(() => {
    const recovered = initialDraftRef.current;
    if (recovered.inputText && recovered.inputText.trim().length > 0) {
      addToast("Restored your auto-saved draft from your previous session.", "info");
    }
  }, []);

  // Lexis Workspace States & Loader
  const [workspacesList, setWorkspacesList] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [isWorkspacesLoading, setIsWorkspacesLoading] = useState<boolean>(false);

  const loadWorkspaces = useCallback(async () => {
    try {
      setIsWorkspacesLoading(true);
      const list = await fetchWorkspaces();
      setWorkspacesList(list);
    } catch (err: any) {
      console.warn("Could not load workspaces:", err);
    } finally {
      setIsWorkspacesLoading(false);
    }
  }, []);

  const handleOpenWorkspace = useCallback(async (wsId: string) => {
    try {
      setIsWorkspacesLoading(true);
      const ws = await fetchWorkspace(wsId);
      setActiveWorkspace(ws);
      setCurrentMode("workspace");
    } catch (err: any) {
      addToast(err.message || "Failed to load workspace.", "error");
    } finally {
      setIsWorkspacesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentMode === "workspace" && !activeWorkspace && isAuthenticated) {
      loadWorkspaces();
    }
  }, [currentMode, activeWorkspace, isAuthenticated, loadWorkspaces]);

  // PWA Install Prompt Listener
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      addToast("LexisAi successfully installed to your device!", "success");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      addToast("Installing LexisAi...", "info");
    }
    setDeferredPrompt(null);
  };

  // Check health, server readiness, and authoritative subscription status
  useEffect(() => {
    fetch("/api/health")
      .then(async (res) => {
        if (!res.ok) return { hasApiKey: false };
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return { hasApiKey: false };
        }
      })
      .then((data) => {
        setHasApiKey(Boolean(data?.hasApiKey));
      })
      .catch((err) => {
        console.warn("Health check warning:", err);
      });

    // Authoritative subscription check from server and handle redirect callbacks
    const searchParams = new URLSearchParams(window.location.search);
    const paymentRef = searchParams.get("reference") || searchParams.get("payment_ref") || searchParams.get("trxref");

    if (paymentRef) {
      addToast("Verifying your Paystack payment...", "info");
      verifyTransactionOnServer(paymentRef)
        .then((res) => {
          if (res.success) {
            if (res.isPro) {
              setUserPlan(PlanType.PRO);
              addToast("🎉 Welcome to LexisAi Pro! Your subscription is now active.", "success");
            } else if (typeof res.creditsAdded === "number") {
              addToast(`🎉 Added ${res.creditsAdded} AI Credits to your account!`, "success");
            }
            if (typeof res.totalCredits === "number") {
              setCredits(res.totalCredits);
            }
          } else {
            addToast(res.message || "Payment verification incomplete. Please contact support.", "error");
          }
        })
        .catch(() => {
          addToast("Network error verifying transaction.", "error");
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else {
      syncServerSubscription()
        .then((serverPlan) => {
          setUserPlan(serverPlan);
        })
        .catch((err) => console.warn("Failed to sync plan:", err));

      fetchServerCredits()
        .then((serverCredits) => {
          setCredits(serverCredits);
        })
        .catch((err) => console.warn("Failed to sync credits:", err));
    }
  }, []);

  // Universal task execution engine supporting all modular capabilities
  const executeAiTask = useCallback(
    async (taskPayload: {
      mode: LexisMode;
      text?: string;
      action?: ToolAction;
      tone?: ToneType;
      format?: FormatType;
      customInstruction?: string;
      generateVariations?: boolean;
      documentOptions?: DocumentTaskOptions;
      researchOptions?: ResearchOptions;
      studyOptions?: StudyOptions;
      jobOptions?: JobOptions;
      workflowOptions?: WorkflowOptions;
      assetPayload?: any;
    }) => {
      // 1. Debounce rapid double-clicks
      const now = Date.now();
      if (now - lastSubmissionTimeRef.current < 600) return;
      lastSubmissionTimeRef.current = now;

      // Centralized access control check based on plan, daily usage, and credits
      const accessCheck = checkActionAccess(usage.count, userPlan, credits);
      if (!accessCheck.canPerformAction) {
        setUpgradeModalTab("pro");
        setIsUpgradeModalOpen(true);
        addToast(
          accessCheck.reason ||
            "You've used today's 5 free actions. 💙 Your free actions reset tomorrow. You can also upgrade to Pro for higher usage and AI Credits.",
          "error"
        );
        return;
      }

      // 2. Abort any active in-flight request
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      // 3. Reset states & initialize live stopwatch
      setIsLoading(true);
      const isStreamable =
        taskPayload.mode === "transform" &&
        !taskPayload.generateVariations &&
        !taskPayload.assetPayload?.base64Data;

      setIsStreaming(isStreamable);
      setStreamingText("");
      setElapsedMs(0);

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 100);

      try {
        const userId = getOrCreateUserId();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const response = await fetch("/api/transform", {
          method: "POST",
          headers: getAuthHeaders({
            "Accept": isStreamable ? "text/event-stream, application/json" : "application/json",
            "X-Lexis-User-Id": userId,
            "X-Usage-Count": String(usage.count),
          }),
          signal: controller.signal,
          body: JSON.stringify({
            requestId,
            mode: taskPayload.mode,
            text: taskPayload.text || inputText,
            action: taskPayload.action || action,
            tone: taskPayload.tone || tone,
            format: taskPayload.format || format,
            customInstruction: taskPayload.customInstruction || customInstruction,
            generateVariations: Boolean(taskPayload.generateVariations),
            stream: isStreamable,
            usageCount: usage.count,
            writingContext,
            documentOptions: taskPayload.documentOptions,
            researchOptions: taskPayload.researchOptions,
            studyOptions: taskPayload.studyOptions,
            jobOptions: taskPayload.jobOptions,
            workflowOptions: taskPayload.workflowOptions,
            assetPayload: taskPayload.assetPayload,
          }),
        });

        // Server-authoritative plan limit rejection
        if (response.status === 403) {
          const errData = await response.json().catch(() => ({}));
          setUpgradeModalTab("pro");
          setIsUpgradeModalOpen(true);
          throw new Error(
            errData.error ||
              "You've used today's 5 free actions. 💙 Your free actions reset tomorrow. You can also upgrade to Pro for higher usage and AI Credits."
          );
        }

        // 4. Handle Server-Sent Events (SSE) Streaming
        if (
          response.headers.get("content-type")?.includes("text/event-stream") &&
          response.body
        ) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          let accumulated = "";
          let finalServerElapsed: number | undefined;
          let serverActionSource: string | undefined;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data:")) {
                try {
                  const payload = JSON.parse(trimmed.slice(5).trim());
                  if (payload.chunk) {
                    accumulated += payload.chunk;
                    setStreamingText(accumulated);
                  }
                  if (payload.error) {
                    throw new Error(payload.error);
                  }
                  if (typeof payload.creditsRemaining === "number") {
                    setCredits(payload.creditsRemaining);
                  }
                  if (payload.actionSource) {
                    serverActionSource = payload.actionSource;
                  }
                  if (payload.done) {
                    if (payload.primaryResult) {
                      accumulated = payload.primaryResult;
                    }
                    if (payload.elapsedMs) {
                      finalServerElapsed = payload.elapsedMs;
                    }
                  }
                } catch (e: any) {
                  if (e.message && !e.message.includes("JSON")) throw e;
                }
              }
            }
          }

          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }

          const measuredDuration = finalServerElapsed || (Date.now() - startTime);
          setElapsedMs(measuredDuration);

          const finalCleanText = accumulated.trim() || streamingText.trim();
          const newItem: TransformationItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            inputText: taskPayload.text || inputText,
            outputText: finalCleanText,
            action: taskPayload.action || action,
            tone: taskPayload.tone || tone,
            format: taskPayload.format || format,
            customInstruction: taskPayload.customInstruction || customInstruction,
            variations: [{ title: "Primary Result", content: finalCleanText }],
            selectedVariationIndex: 0,
            elapsedMs: measuredDuration,
            mode: taskPayload.mode,
          };

          setCurrentResult(newItem);
          setHistory((prev) => [newItem, ...prev.slice(0, 49)]);
          setStreamingText("");

          if (serverActionSource === "credit") {
            addToast("Action completed (1 AI Credit used)!", "success");
          } else {
            const updatedUsage = incrementUsage();
            setUsage(updatedUsage);
            addToast("Completed successfully!", "success");
          }

          setTimeout(() => {
            const outputEl = document.getElementById("output-panel");
            if (outputEl && window.innerWidth < 1024) {
              outputEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 80);
          return;
        }

        // 5. Standard JSON Execution (handles Research, Study, Job, Workflow, Multimodal OCR)
        const rawText = await response.text();
        let data: any = {};
        try {
          data = JSON.parse(rawText);
        } catch {
          if (!response.ok) {
            throw new Error(`Server temporarily unavailable (${response.status}). Please try again.`);
          }
          throw new Error("Unable to parse AI response. Please try again.");
        }

        if (!response.ok || !data.success || data.error) {
          throw new Error(data.error || `Failed to process (${response.status})`);
        }

        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        const measuredDuration = data.elapsedMs || (Date.now() - startTime);
        setElapsedMs(measuredDuration);

        const newItem: TransformationItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          inputText: taskPayload.text || inputText,
          outputText: data.primaryResult || (data.variations?.[0]?.content ?? ""),
          action: taskPayload.action || action,
          tone: taskPayload.tone || tone,
          format: taskPayload.format || format,
          customInstruction: taskPayload.customInstruction || customInstruction,
          variations: data.variations || [{ title: "Result", content: data.primaryResult }],
          selectedVariationIndex: 0,
          notes: data.summaryNotes,
          elapsedMs: measuredDuration,
          sources: data.sources,
          mode: taskPayload.mode,
        };

        setCurrentResult(newItem);
        setHistory((prev) => [newItem, ...prev.slice(0, 49)]);

        if (typeof data.creditsRemaining === "number") {
          setCredits(data.creditsRemaining);
        }

        if (data.actionSource === "credit") {
          addToast("Action completed (1 AI Credit used)!", "success");
        } else {
          const updatedUsage = incrementUsage();
          setUsage(updatedUsage);
          addToast("Completed successfully!", "success");
        }

        setTimeout(() => {
          const outputEl = document.getElementById("output-panel");
          if (outputEl && window.innerWidth < 1024) {
            outputEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 80);
      } catch (err: any) {
        if (err.name === "AbortError" || err.message?.includes("aborted")) {
          return;
        }
        console.error("Task error:", err);
        addToast(err.message || "Error processing request. Please try again.", "error");
      } finally {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        activeAbortControllerRef.current = null;
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [inputText, action, tone, format, customInstruction, generateVariations, streamingText, usage.count, userPlan, credits, writingContext]
  );

  // Standard Transform Trigger
  const handleTransform = (
    overrideAction?: ToolAction,
    overrideTone?: ToneType,
    overrideFormat?: FormatType,
    overrideInstruction?: string
  ) => {
    executeAiTask({
      mode: "transform",
      text: inputText,
      action: overrideAction || action,
      tone: overrideTone || tone,
      format: overrideFormat || format,
      customInstruction: overrideInstruction || customInstruction,
      generateVariations,
    });
  };

  const handleStopGeneration = () => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);

    if (streamingText.trim()) {
      const stoppedItem: TransformationItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        inputText: inputText,
        outputText: streamingText.trim(),
        action: action,
        tone: tone,
        format: format,
        customInstruction: customInstruction,
        variations: [{ title: "Partial Result", content: streamingText.trim() }],
        selectedVariationIndex: 0,
        notes: "Generation stopped by user.",
        elapsedMs: elapsedMs,
      };
      setCurrentResult(stoppedItem);
      setHistory((prev) => [stoppedItem, ...prev.slice(0, 49)]);
    }
    addToast("Generation stopped.", "info");
  };

  const handleNewTask = () => {
    setInputText("");
    setCurrentResult(null);
    setStreamingText("");
    setElapsedMs(0);
    setAttachedAsset(null);
    saveDraftToStorage({
      inputText: "",
      action,
      tone,
      format,
    });
  };

  const handleAssetSelect = (asset: PickedAsset) => {
    setAttachedAsset(asset);
    setIsAssetPickerOpen(false);
    setPreviewingAsset(null);

    // If text was extracted from document or OCR, populate input and prompt user
    if (asset.extractedText && asset.extractedText.trim()) {
      setInputText(asset.extractedText.trim());
      addToast(`Extracted text from "${asset.name}" and loaded into editor!`, "success");
    } else {
      addToast(`Attached "${asset.name}".`, "info");
    }
  };

  const handlePreviewClose = () => {
    setPreviewingAsset(null);
  };

  const handlePreviewContinue = (asset: PickedAsset, extractedText?: string) => {
    setAttachedAsset(asset);
    setPreviewingAsset(null);

    if (extractedText && extractedText.trim()) {
      if (inputText.trim()) {
        setInputText((prev) => `${prev.trim()}\n\n${extractedText.trim()}`);
      } else {
        setInputText(extractedText.trim());
      }
      addToast(
        asset.isImage
          ? "Text extracted from image and loaded into editor!"
          : "File content loaded into editor!",
        "success"
      );
    } else {
      addToast(`Attached "${asset.name}" to session.`, "info");
    }
  };

  const handleRemoveAsset = () => {
    setAttachedAsset(null);
    addToast("Asset removed from session", "info");
  };

  // Quick 1-click action trigger
  const handleQuickAction = (item: any) => {
    setCurrentMode("transform");
    setAction(item.action);
    setTone(item.tone);
    if (item.format) setFormat(item.format);
    if (item.customInstruction) setCustomInstruction(item.customInstruction);

    if (inputText.trim()) {
      handleTransform(item.action, item.tone, item.format, item.customInstruction);
    } else {
      addToast(`Switched to "${item.label}". Enter your text and click Process.`, "info");
    }
  };

  // Preset Template Loader
  const handleApplyPreset = (preset: PresetExample) => {
    setCurrentMode("transform");
    setInputText(preset.text);
    setAction(preset.action);
    setTone(preset.tone);
    setFormat(preset.format || "general");
    setCustomInstruction(preset.customInstruction || "");
    addToast(`Loaded preset template: "${preset.title}"`, "info");
  };

  // Keyboard shortcut listener (Cmd/Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (currentMode === "transform") {
          handleTransform();
        }
      }
      if (e.key === "Escape") {
        setIsHistoryOpen(false);
        setIsShortcutsOpen(false);
        setIsFeedbackOpen(false);
        setIsAssetPickerOpen(false);
        setPreviewingAsset(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTransform, currentMode]);

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-screen overflow-hidden flex flex-row bg-[#09090b] text-slate-100 font-sans antialiased selection:bg-blue-600/30 selection:text-blue-200">
      {/* 1. Left Vertical Sidebar (Desktop Collapsible Rail + Mobile Slide-over Drawer) */}
      <AppSidebar
        currentMode={currentMode}
        onSelectMode={(mode) => {
          setCurrentMode(mode);
          if (mode !== "workspace") {
            setActiveWorkspace(null);
          } else {
            loadWorkspaces();
          }
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={handleToggleSidebar}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onNewTask={handleNewTask}
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onOpenUpgrade={() => {
          setUpgradeModalTab("pro");
          setIsUpgradeModalOpen(true);
        }}
        onOpenCredits={() => {
          setUpgradeModalTab("credits");
          setIsUpgradeModalOpen(true);
        }}
        plan={userPlan}
        usageCount={usage.count}
        credits={credits}
      />

      {/* 2. Main Content Viewport */}
      <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col overflow-hidden">
        {/* Compact Viewport Header */}
        <TopHeader
          currentMode={currentMode}
          onSelectMode={(mode) => {
            setCurrentMode(mode);
            if (mode !== "workspace") {
              setActiveWorkspace(null);
            } else {
              loadWorkspaces();
            }
          }}
          activeWorkspace={activeWorkspace}
          onBackToWorkspacesDashboard={() => {
            setActiveWorkspace(null);
            loadWorkspaces();
          }}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          historyCount={history.length}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenUpgrade={() => {
            setUpgradeModalTab("pro");
            setIsUpgradeModalOpen(true);
          }}
          onOpenCredits={() => {
            setUpgradeModalTab("credits");
            setIsUpgradeModalOpen(true);
          }}
          usageCount={usage.count}
          credits={credits}
          plan={userPlan}
          hasApiKey={hasApiKey}
          canInstall={Boolean(deferredPrompt)}
          onInstall={handleInstallApp}
        />

        {/* Scrollable Main Canvas Stage */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-5 flex flex-col gap-4 pb-20 lg:pb-6">
          <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
            {currentMode === "workspace" ? (
              !isAuthenticated ? (
            <div className="max-w-2xl mx-auto my-10 p-8 rounded-3xl bg-[#0c0c0e] border border-slate-800 text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mx-auto flex items-center justify-center shadow-lg shadow-blue-950/50">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Private Workspaces Require Sign-In
                </h2>
                <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Your workspaces, documents, notes, OCR extractions, and the Document Intelligence Agent are strictly encrypted and isolated to your authenticated account.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 max-w-md mx-auto space-y-2 text-left">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                  Cross-Account Isolation Guaranteed
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  The Document Intelligence Agent retrieves context strictly from documents that belong to your account. Sign in or create a free account to access your workspace.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => openAuthModal("signin")}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Your Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal("signup")}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Free Account</span>
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setCurrentMode("transform")}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  &larr; Return to Public Writing Studio
                </button>
              </div>
            </div>
          ) : activeWorkspace ? (
            <WorkspaceDetail
              workspace={activeWorkspace}
              userPlan={userPlan}
              usageCount={usage.count}
              credits={credits}
              onUpdateWorkspace={(updated) => {
                setActiveWorkspace(updated);
                loadWorkspaces();
              }}
              onDeleteWorkspace={async (wsId) => {
                await deleteWorkspaceApi(wsId);
                setActiveWorkspace(null);
                await loadWorkspaces();
                addToast("Workspace deleted.", "info");
              }}
              onBackToDashboard={() => {
                setActiveWorkspace(null);
                loadWorkspaces();
              }}
              onOpenUpgradeModal={(tab) => {
                setUpgradeModalTab(tab);
                setIsUpgradeModalOpen(true);
              }}
              onIncrementUsage={() => {
                const updated = incrementUsage();
                setUsage(updated);
              }}
              onUpdateCredits={(newTotal) => {
                setCredits(newTotal);
              }}
              addToast={addToast}
            />
          ) : (
            <WorkspaceDashboard
              workspaces={workspacesList}
              isLoading={isWorkspacesLoading}
              onOpenWorkspace={handleOpenWorkspace}
              onCreateWorkspace={async (data) => {
                try {
                  const created = await createWorkspaceApi(data);
                  addToast(`Workspace "${created.name}" created!`, "success");
                  await loadWorkspaces();
                  await handleOpenWorkspace(created.id);
                } catch (err: any) {
                  addToast(err.message || "Failed to create workspace.", "error");
                }
              }}
              onRenameWorkspace={async (wsId, name, desc) => {
                try {
                  await updateWorkspaceApi(wsId, { name, description: desc });
                  addToast("Workspace updated.", "success");
                  await loadWorkspaces();
                } catch (err: any) {
                  addToast(err.message || "Failed to update workspace.", "error");
                }
              }}
              onDeleteWorkspace={async (wsId) => {
                try {
                  await deleteWorkspaceApi(wsId);
                  addToast("Workspace deleted.", "info");
                  await loadWorkspaces();
                } catch (err: any) {
                  addToast(err.message || "Failed to delete workspace.", "error");
                }
              }}
              onBackToStudio={() => {
                setCurrentMode("transform");
              }}
            />
          )
        ) : (
          <>
            {/* Global Writing Context & Constraints Drawer */}
            <WritingContextDrawer
              context={writingContext}
              onChange={(updated) => setWritingContext(updated)}
            />

            {/* Quick 1-Click Action Pills (Shown in Transform mode) */}
            {currentMode === "transform" && (
              <QuickPills
                onSelectQuickAction={handleQuickAction}
                isLoading={isLoading}
                disabled={false}
              />
            )}

            {/* 2-Column Split Workspace (or vertical stacked on mobile) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
          {/* Left Column: Contextual Input Panel depending on active Mode */}
          <div className="flex flex-col gap-4">
            {currentMode === "transform" && (
              <InputPanel
                inputText={inputText}
                setInputText={setInputText}
                action={action}
                setAction={setAction}
                tone={tone}
                setTone={setTone}
                format={format}
                setFormat={setFormat}
                customInstruction={customInstruction}
                setCustomInstruction={setCustomInstruction}
                generateVariations={generateVariations}
                setGenerateVariations={setGenerateVariations}
                onTransform={() => handleTransform()}
                onNewTask={handleNewTask}
                isLoading={isLoading}
                onApplyPreset={handleApplyPreset}
                onOpenAssetPicker={() => setIsAssetPickerOpen(true)}
                attachedAsset={attachedAsset}
                onViewAssetPreview={(asset) => setPreviewingAsset(asset)}
                onRemoveAsset={handleRemoveAsset}
                usageCount={usage.count}
                credits={credits}
                plan={userPlan}
                isUsageLimitReached={isUsageLimitReached}
                onOpenUpgrade={() => {
                  setUpgradeModalTab("pro");
                  setIsUpgradeModalOpen(true);
                }}
                onOpenCredits={() => {
                  setUpgradeModalTab("credits");
                  setIsUpgradeModalOpen(true);
                }}
              />
            )}

            {currentMode === "document" && (
              <div className="bg-[#0c0c0e] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Document & PDF Intelligence
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Upload documents or paste complex text to summarize, extract key points, simplify, or ask questions.
                  </p>
                </div>
                <DocumentModePanel
                  onRunDocumentTask={(options) =>
                    executeAiTask({
                      mode: "document",
                      text: inputText,
                      documentOptions: options,
                    })
                  }
                  isLoading={isLoading}
                  disabled={false}
                  attachedFileName={attachedAsset?.name}
                  attachedFileSize={attachedAsset?.size}
                  isPdfOrDoc={Boolean(
                    attachedAsset &&
                      (attachedAsset.type === "application/pdf" ||
                        attachedAsset.name.toLowerCase().endsWith(".pdf") ||
                        attachedAsset.name.toLowerCase().endsWith(".doc") ||
                        attachedAsset.name.toLowerCase().endsWith(".docx") ||
                        attachedAsset.isTextFile)
                  )}
                  onOpenAssetPicker={() => setIsAssetPickerOpen(true)}
                  onRemoveAsset={handleRemoveAsset}
                />
              </div>
            )}

            {currentMode === "research" && (
              <div className="bg-[#0c0c0e] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Deep Research Mode
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live web grounding with real sources and non-invented citations.
                  </p>
                </div>
                <ResearchModePanel
                  onRunResearch={(topic, enableLiveWeb) =>
                    executeAiTask({
                      mode: "research",
                      text: topic,
                      researchOptions: {
                        topic,
                        enableLiveWeb,
                      },
                    })
                  }
                  isLoading={isLoading}
                  disabled={false}
                />
              </div>
            )}

            {currentMode === "study" && (
              <div className="bg-[#0c0c0e] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Study & Learning Assistant
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate flashcards, quizzes, simple Feynman explanations, and exam practice questions.
                  </p>
                </div>
                <StudyModePanel
                  onRunStudy={(options, notesText) =>
                    executeAiTask({
                      mode: "study",
                      text: notesText || inputText,
                      studyOptions: options,
                    })
                  }
                  isLoading={isLoading}
                  disabled={false}
                  initialText={inputText}
                />
              </div>
            )}

            {currentMode === "job" && (
              <div className="bg-[#0c0c0e] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Job & Career Application Suite
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Match CV with job descriptions, tailor cover letters, and generate interview questions with zero fake credentials.
                  </p>
                </div>
                <JobModePanel
                  onRunJobAction={(options) =>
                    executeAiTask({
                      mode: "job",
                      text: options.cvResumeText,
                      jobOptions: options,
                    })
                  }
                  isLoading={isLoading}
                  disabled={false}
                  initialCvText={inputText}
                />
              </div>
            )}

            {currentMode === "workflow" && (
              <div className="bg-[#0c0c0e] rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Finished Document Synthesis
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Automated multi-step pipeline turning rough ideas into publication-ready reports, proposals, and letters.
                  </p>
                </div>
                <WorkflowModePanel
                  onRunWorkflow={(options) =>
                    executeAiTask({
                      mode: "workflow",
                      text: options.roughNotes,
                      workflowOptions: options,
                    })
                  }
                  isLoading={isLoading}
                  disabled={false}
                  initialRoughNotes={inputText}
                />
              </div>
            )}
          </div>

          {/* Right Column: Output & Copy Actions */}
          <OutputPanel
            currentResult={currentResult}
            isLoading={isLoading}
            streamingText={streamingText}
            isStreaming={isStreaming}
            elapsedMs={elapsedMs}
            onStop={handleStopGeneration}
            onUseAsInput={(text) => {
              setInputText(text);
              addToast("Output loaded into editor for further editing", "info");
            }}
            onCopySuccess={() => addToast("Copied result to clipboard!", "success")}
            onExportPdfSuccess={() => addToast("Exported AI result as formatted PDF document!", "success")}
            onNewTask={handleNewTask}
          />
        </div>
        </>
        )}

        {/* Bottom Bar with Give Feedback Button */}
        <div className="mt-auto pt-4 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-900/80">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>LexisAi &bull; Professional Writing, Research & Document Assistant</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="give-feedback-btn"
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="hover:text-slate-300 transition-colors cursor-pointer text-slate-400"
            >
              Feedback
            </button>
            <span>&bull;</span>
            <span className="text-[11px] text-slate-500">
              {userPlan === PlanType.PRO
                ? "Pro Subscription Active (500 actions/mo)"
                : "Free Plan (5 actions/day · Resets midnight)"}
            </span>
          </div>
        </div>
          </div>
        </main>

        {/* Mobile Thumb Navigation Bar */}
        <MobileNavigation
          currentMode={currentMode}
          onSelectMode={(mode) => {
            setCurrentMode(mode);
            if (mode !== "workspace") {
              setActiveWorkspace(null);
            } else {
              loadWorkspaces();
            }
          }}
          historyCount={history.length}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenDrawer={() => setIsMobileSidebarOpen(true)}
        />
      </div>

      {/* Asset Picker Modal (Files, Documents & Camera OCR) */}
      <AssetPickerModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        onSelectAsset={handleAssetSelect}
        onPreviewAsset={(asset) => {
          setIsAssetPickerOpen(false);
          setPreviewingAsset(asset);
        }}
      />

      {/* Asset Preview Modal */}
      {previewingAsset && (
        <AssetPreviewModal
          asset={previewingAsset}
          onClose={handlePreviewClose}
          onContinue={handlePreviewContinue}
        />
      )}

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onRestoreItem={(item) => {
          setCurrentResult(item);
          setInputText(item.inputText);
          if (item.action) setAction(item.action);
          if (item.tone) setTone(item.tone);
          if (item.format) setFormat(item.format);
          if (item.customInstruction) setCustomInstruction(item.customInstruction);
          setIsHistoryOpen(false);
          addToast("Restored session from history!", "info");
        }}
        onClearHistory={() => {
          setHistory([]);
          addToast("History cleared", "info");
        }}
      />

      {/* Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        onSubmitFeedback={() => {
          addToast("Thank you for your feedback!", "success");
        }}
      />

      {/* Upgrade & Buy Credits Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        initialTab={upgradeModalTab}
        currentPlan={userPlan}
        credits={credits}
        onUpgradeSuccess={() => {
          setUserPlan(PlanType.PRO);
          addToast("🎉 Upgraded to LexisAi Pro! Enjoy 500 actions/month.", "success");
        }}
        onCreditsAdded={(newTotal) => {
          setCredits(newTotal);
          addToast(`🎉 Credits updated! Balance: ${newTotal} actions.`, "success");
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onCloseToast={removeToast} />

      {/* Authentication & User Account Modals */}
      <AuthModal />
      <AccountSettingsModal />
      <TermsModal />
    </div>
  );
}
