import React, { useState, useRef, useEffect } from "react";
import {
  FolderKanban,
  FileText,
  BookOpen,
  MessageSquare,
  Upload,
  Plus,
  Search,
  Trash2,
  Edit3,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  GitCompare,
  Eye,
  ArrowLeft,
  X,
  Layers,
  FileCheck,
  Info,
} from "lucide-react";
import {
  Workspace,
  WorkspaceDocument,
  WorkspaceNote,
  WorkspaceChatMessage,
  PlanType,
} from "../../types";
import {
  uploadDocumentApi,
  deleteDocumentApi,
  createNoteApi,
  updateNoteApi,
  deleteNoteApi,
  sendWorkspaceChatApi,
  clearWorkspaceChatApi,
  updateWorkspaceApi,
  deleteWorkspaceApi,
} from "../../utils/workspaceClient";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { DocumentCompareModal } from "./DocumentCompareModal";
import { checkActionAccess } from "../../utils/usageManager";

interface WorkspaceDetailProps {
  workspace: Workspace;
  userPlan: PlanType;
  usageCount: number;
  credits: number;
  onUpdateWorkspace: (updated: Workspace) => void;
  onDeleteWorkspace: (workspaceId: string) => Promise<void>;
  onBackToDashboard: () => void;
  onOpenUpgradeModal: (tab: "pro" | "credits") => void;
  onIncrementUsage: () => void;
  onUpdateCredits: (remaining: number) => void;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
}

type TabType = "documents" | "notes" | "chat";

const QUICK_ACTIONS = [
  { id: "summarize", label: "Summarize", icon: "📋" },
  { id: "extract_key_points", label: "Extract Key Points", icon: "🔑" },
  { id: "explain", label: "Explain", icon: "💡" },
  { id: "create_report", label: "Create Report", icon: "📊" },
  { id: "create_outline", label: "Create Outline", icon: "📑" },
  { id: "rewrite", label: "Rewrite", icon: "✍️" },
  { id: "improve_grammar", label: "Improve Grammar", icon: "✨" },
  { id: "make_professional", label: "Make Professional", icon: "💼" },
  { id: "make_shorter", label: "Make Shorter", icon: "✂️" },
  { id: "expand", label: "Expand", icon: "🔍" },
  { id: "generate_questions", label: "Generate Questions", icon: "❓" },
];

export const WorkspaceDetail: React.FC<WorkspaceDetailProps> = ({
  workspace,
  userPlan,
  usageCount,
  credits,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onBackToDashboard,
  onOpenUpgradeModal,
  onIncrementUsage,
  onUpdateCredits,
  addToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("documents");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [viewingDocument, setViewingDocument] = useState<WorkspaceDocument | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareInitialDocId, setCompareInitialDocId] = useState<string | undefined>(undefined);

  // Rename & Delete Workspace
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(workspace.name);
  const [renameDesc, setRenameDesc] = useState(workspace.description || "");
  const [isConfirmingDeleteWs, setIsConfirmingDeleteWs] = useState(false);

  // Document Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Notes State
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => {
    return workspace.notes[0]?.id || null;
  });
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isCreatingNewNote, setIsCreatingNewNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Context Selection for Grounded AI
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(() =>
    workspace.documents.map((d) => d.id)
  );
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>(() =>
    workspace.notes.map((n) => n.id)
  );
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);

  // AI Chat & Quick Actions State
  const [chatInput, setChatInput] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Keep note form in sync with selected note
  useEffect(() => {
    if (selectedNoteId) {
      const active = workspace.notes.find((n) => n.id === selectedNoteId);
      if (active) {
        setNoteTitle(active.title);
        setNoteContent(active.content);
        setIsCreatingNewNote(false);
      }
    } else if (workspace.notes.length > 0 && !isCreatingNewNote) {
      setSelectedNoteId(workspace.notes[0].id);
      setNoteTitle(workspace.notes[0].title);
      setNoteContent(workspace.notes[0].content);
    }
  }, [selectedNoteId, workspace.notes, isCreatingNewNote]);

  // Keep selected document & note IDs synchronized when items are added/deleted
  useEffect(() => {
    const validDocIds = new Set(workspace.documents.map((d) => d.id));
    setSelectedDocIds((prev) => {
      const filtered = prev.filter((id) => validDocIds.has(id));
      // If a new doc was added, include it
      for (const doc of workspace.documents) {
        if (!prev.includes(doc.id)) filtered.push(doc.id);
      }
      return filtered;
    });

    const validNoteIds = new Set(workspace.notes.map((n) => n.id));
    setSelectedNoteIds((prev) => {
      const filtered = prev.filter((id) => validNoteIds.has(id));
      for (const note of workspace.notes) {
        if (!prev.includes(note.id)) filtered.push(note.id);
      }
      return filtered;
    });
  }, [workspace.documents, workspace.notes]);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === "chat" && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTab, workspace.chatHistory.length]);

  // ==========================================
  // DOCUMENT HANDLERS
  // ==========================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    setIsUploading(true);
    addToast(`Uploading and extracting "${file.name}"...`, "info");

    try {
      const isTextFile =
        file.type.startsWith("text/") ||
        /\.(txt|md|csv|json|js|ts|html|css)$/i.test(file.name);

      let textContent: string | undefined;
      let base64Data: string | undefined;

      if (isTextFile) {
        textContent = await file.text();
      } else {
        // Read as base64 for PDF or image OCR
        const reader = new FileReader();
        const loadPromise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        base64Data = await loadPromise;
      }

      const res = await uploadDocumentApi(workspace.id, {
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        text: textContent,
        base64Data,
      });

      onUpdateWorkspace(res.workspace);

      if (res.document.status === "ready") {
        addToast(`"${file.name}" processed successfully!`, "success");
      } else {
        addToast(
          `"${file.name}" uploaded, but text could not be extracted: ${res.document.errorMessage || "Unreadable format"}`,
          "error"
        );
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      addToast(err.message || "Failed to upload document.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const updatedWs = await deleteDocumentApi(workspace.id, docId);
      onUpdateWorkspace(updatedWs);
      setDeletingDocId(null);
      addToast("Document removed.", "info");
    } catch (err: any) {
      addToast(err.message || "Failed to remove document.", "error");
    }
  };

  // ==========================================
  // NOTE HANDLERS
  // ==========================================
  const handleSaveNote = async () => {
    if (!noteTitle.trim() && !noteContent.trim()) {
      addToast("Note cannot be empty.", "error");
      return;
    }

    try {
      setIsSavingNote(true);
      if (isCreatingNewNote || !selectedNoteId) {
        const res = await createNoteApi(workspace.id, {
          title: noteTitle.trim() || "Untitled Note",
          content: noteContent,
        });
        onUpdateWorkspace(res.workspace);
        setSelectedNoteId(res.note.id);
        setIsCreatingNewNote(false);
        addToast("Note created.", "success");
      } else {
        const res = await updateNoteApi(workspace.id, selectedNoteId, {
          title: noteTitle.trim() || "Untitled Note",
          content: noteContent,
        });
        onUpdateWorkspace(res.workspace);
        addToast("Note saved.", "success");
      }
    } catch (err: any) {
      addToast(err.message || "Failed to save note.", "error");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const updatedWs = await deleteNoteApi(workspace.id, noteId);
      onUpdateWorkspace(updatedWs);
      setDeletingNoteId(null);
      if (selectedNoteId === noteId) {
        setSelectedNoteId(updatedWs.notes[0]?.id || null);
      }
      addToast("Note deleted.", "info");
    } catch (err: any) {
      addToast(err.message || "Failed to delete note.", "error");
    }
  };

  const handleStartNewNote = () => {
    setSelectedNoteId(null);
    setIsCreatingNewNote(true);
    setNoteTitle("");
    setNoteContent("");
  };

  // ==========================================
  // AI CHAT & GROUNDED ACTIONS
  // ==========================================
  const handleTriggerAiChat = async (promptText?: string, actionType?: string) => {
    const textToSend = (promptText !== undefined ? promptText : chatInput).trim();
    if (!textToSend && !actionType) return;

    // Check user limits
    const access = checkActionAccess(usageCount, userPlan, credits);
    if (!access.canPerformAction) {
      onOpenUpgradeModal("pro");
      addToast(
        access.reason ||
          "You've used today's 5 free actions. 💙 Your free actions reset tomorrow. You can also upgrade to Pro for higher usage and AI Credits.",
        "error"
      );
      return;
    }

    setIsAiProcessing(true);
    setChatInput("");

    try {
      const requestId = `req_ws_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const res = await sendWorkspaceChatApi(workspace.id, {
        prompt: textToSend,
        action: actionType,
        selectedDocumentIds: selectedDocIds,
        selectedNoteIds: selectedNoteIds,
        usageCount,
        requestId,
      });

      onUpdateWorkspace(res.workspace);

      if (res.actionSource === "credit") {
        if (typeof res.creditsRemaining === "number") {
          onUpdateCredits(res.creditsRemaining);
        }
        addToast("Workspace action completed (1 AI Credit used)!", "success");
      } else {
        onIncrementUsage();
        addToast("Workspace action completed!", "success");
      }

      // Switch to chat tab so user sees the response
      setActiveTab("chat");
    } catch (err: any) {
      console.error("AI error:", err);
      if (err.status === 403 || err.limitReached) {
        onOpenUpgradeModal("pro");
      }
      addToast(err.message || "Failed to process AI request.", "error");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleClearChat = async () => {
    try {
      const updatedWs = await clearWorkspaceChatApi(workspace.id);
      onUpdateWorkspace(updatedWs);
      addToast("Chat history cleared.", "info");
    } catch (err: any) {
      addToast(err.message || "Failed to clear chat.", "error");
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleSaveMessageAsNote = async (text: string) => {
    try {
      const title = `AI Note - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const res = await createNoteApi(workspace.id, {
        title,
        content: text,
      });
      onUpdateWorkspace(res.workspace);
      setSelectedNoteId(res.note.id);
      addToast("Saved to Notes!", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to save note.", "error");
    }
  };

  // ==========================================
  // SEARCH FILTERING
  // ==========================================
  const filteredDocuments = workspace.documents.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.extractedText.toLowerCase().includes(q);
  });

  const filteredNotes = workspace.notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const selectedDocsCount = selectedDocIds.length;
  const selectedNotesCount = selectedNoteIds.length;

  return (
    <div className="space-y-4">
      {/* Top Workspace Bar */}
      <div className="bg-[#0c0c0e] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="p-2 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              title="Back to all workspaces"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              {isRenaming ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={renameName}
                    onChange={(e) => setRenameName(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-bold"
                  />
                  <input
                    type="text"
                    value={renameDesc}
                    onChange={(e) => setRenameDesc(e.target.value)}
                    placeholder="Description..."
                    className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!renameName.trim()) return;
                        const res = await updateWorkspaceApi(workspace.id, {
                          name: renameName.trim(),
                          description: renameDesc.trim(),
                        });
                        onUpdateWorkspace(res);
                        setIsRenaming(false);
                        addToast("Workspace renamed.", "success");
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRenaming(false)}
                      className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold text-white truncate">
                      {workspace.name}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameName(workspace.name);
                        setRenameDesc(workspace.description || "");
                        setIsRenaming(true);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                      title="Rename workspace"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 truncate max-w-xl mt-0.5">
                    {workspace.description || "Project Workspace • Zero-fabrication Grounded AI"}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            {/* Context indicator button */}
            <button
              type="button"
              onClick={() => setIsContextDrawerOpen(!isContextDrawerOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-300 hover:border-blue-400/50 transition-colors cursor-pointer"
              title="Click to select which documents and notes are fed to the AI"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>
                Context: {selectedDocsCount} doc{selectedDocsCount === 1 ? "" : "s"} · {selectedNotesCount} note{selectedNotesCount === 1 ? "" : "s"}
              </span>
              {isContextDrawerOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Delete workspace button */}
            <button
              type="button"
              onClick={() => setIsConfirmingDeleteWs(true)}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-900/40"
              title="Delete Workspace"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Workspace Context Selector */}
        {isContextDrawerOpen && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Grounded Context Controls
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDocIds(workspace.documents.map((d) => d.id));
                    setSelectedNoteIds(workspace.notes.map((n) => n.id));
                  }}
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDocIds([]);
                    setSelectedNoteIds([]);
                  }}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mb-3">
              The AI strictly receives only the selected materials. Unselected documents or notes will be excluded from the context.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Document selection checklist */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Documents ({workspace.documents.length})
                </span>
                {workspace.documents.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No documents uploaded yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {workspace.documents.map((d) => {
                      const isChecked = selectedDocIds.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDocIds((prev) => [...prev, d.id]);
                              } else {
                                setSelectedDocIds((prev) => prev.filter((id) => id !== d.id));
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                          />
                          <span className="truncate">{d.name}</span>
                          {d.status === "unreadable" && (
                            <span className="text-[10px] text-amber-400">(Unreadable)</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Note selection checklist */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Notes ({workspace.notes.length})
                </span>
                {workspace.notes.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No notes created yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {workspace.notes.map((n) => {
                      const isChecked = selectedNoteIds.includes(n.id);
                      return (
                        <label
                          key={n.id}
                          className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedNoteIds((prev) => [...prev, n.id]);
                              } else {
                                setSelectedNoteIds((prev) => prev.filter((id) => id !== n.id));
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
                          />
                          <span className="truncate">{n.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs and Search Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0c0c0e] border border-slate-800 p-2 sm:p-2.5 rounded-2xl">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "documents"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documents</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-900/60 border border-slate-700/50">
              {workspace.documents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "notes"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Notes</span>
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-900/60 border border-slate-700/50">
              {workspace.notes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "chat"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grounded AI Chat</span>
            {workspace.chatHistory.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-900/60 border border-slate-700/50">
                {workspace.chatHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Workspace Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents & notes..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: DOCUMENTS */}
      {/* ======================================================== */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {/* Upload trigger bar */}
          <div className="bg-[#0c0c0e] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Workspace Documents
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload PDFs, Word docs, text, markdown, CSV, or scans. Extracted text is fed to grounded AI.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.md,.markdown,.csv,.json,.pdf,.doc,.docx,image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-blue-950/40 cursor-pointer active:scale-98"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Document...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Document</span>
                  </>
                )}
              </button>

              {workspace.documents.filter((d) => d.status === "ready").length >= 2 && (
                <button
                  type="button"
                  onClick={() => setIsCompareModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Compare two documents in this workspace"
                >
                  <GitCompare className="w-4 h-4 text-blue-400" />
                  <span className="hidden sm:inline">Compare</span>
                </button>
              )}
            </div>
          </div>

          {/* Document list */}
          {filteredDocuments.length === 0 ? (
            <div className="bg-[#0c0c0e] border border-slate-800 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {searchQuery ? "No matching documents" : "No documents uploaded yet"}
              </h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                {searchQuery
                  ? `No documents match "${searchQuery}".`
                  : "Upload contracts, reports, project specs, or notes to ground your AI answers in verified facts."}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-950/40"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload First Document</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredDocuments.map((doc) => {
                const formattedSize =
                  doc.size < 1024
                    ? `${doc.size} B`
                    : doc.size < 1024 * 1024
                    ? `${(doc.size / 1024).toFixed(0)} KB`
                    : `${(doc.size / (1024 * 1024)).toFixed(1)} MB`;

                return (
                  <div
                    key={doc.id}
                    className="bg-[#0c0c0e] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition-all shadow-sm flex flex-col justify-between gap-3 text-left"
                  >
                    <div>
                      {/* Title & Status */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-xs" title={doc.name}>
                              {doc.name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span>{formattedSize}</span>
                              <span aria-hidden="true">·</span>
                              <span>{doc.wordCount.toLocaleString()} words</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {doc.status === "ready" ? (
                          <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-950/30 border border-emerald-500/30">
                            Ready
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-bold text-amber-400 px-2 py-0.5 rounded-md bg-amber-950/30 border border-amber-500/30"
                            title={doc.errorMessage || "Text could not be extracted"}
                          >
                            Unreadable
                          </span>
                        )}
                      </div>

                      {/* Error or Preview Text Snippet */}
                      {doc.status === "unreadable" ? (
                        <p className="text-[11px] text-amber-400/90 bg-amber-950/20 border border-amber-500/20 p-2 rounded-lg leading-relaxed mb-2">
                          {doc.errorMessage || "No readable text detected in this document."}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 font-mono">
                          {doc.extractedText || "No text available"}
                        </p>
                      )}
                    </div>

                    {/* Document Intelligence Actions */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingDocument(doc)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                        >
                          View Content
                        </button>

                        {doc.status === "ready" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDocIds([doc.id]);
                                handleTriggerAiChat(
                                  `Summarize the key takeaways and conclusions of "${doc.name}".`,
                                  "summarize"
                                );
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-950/30 hover:bg-blue-900/40 rounded-lg border border-blue-500/20 transition-colors cursor-pointer"
                            >
                              Summarize
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDocIds([doc.id]);
                                setActiveTab("chat");
                                setChatInput(`What are the key points and findings in "${doc.name}"?`);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                            >
                              Ask Questions
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCompareInitialDocId(doc.id);
                                setIsCompareModalOpen(true);
                              }}
                              className="hidden sm:inline-block px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                            >
                              Compare
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setDeletingDocId(doc.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                        title="Remove Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: NOTES */}
      {/* ======================================================== */}
      {activeTab === "notes" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Notes Sidebar List */}
          <div className="lg:col-span-4 bg-[#0c0c0e] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Saved Notes ({workspace.notes.length})
              </span>
              <button
                type="button"
                onClick={handleStartNewNote}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Note</span>
              </button>
            </div>

            {filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                {searchQuery ? "No matching notes." : "No notes yet. Click \"New Note\" to write your first reference."}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredNotes.map((note) => {
                  const isSelected = selectedNoteId === note.id && !isCreatingNewNote;
                  return (
                    <div
                      key={note.id}
                      onClick={() => {
                        setSelectedNoteId(note.id);
                        setIsCreatingNewNote(false);
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500/50 shadow-sm"
                          : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <h4 className="text-xs font-bold text-white truncate mb-1">
                        {note.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {note.content || "Empty note"}
                      </p>
                      <span className="text-[10px] text-slate-500 block mt-2">
                        Updated {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Note Editor */}
          <div className="lg:col-span-8 bg-[#0c0c0e] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {isCreatingNewNote ? "Create New Note" : "Edit Note"}
              </span>

              <div className="flex items-center gap-2">
                {selectedNoteId && !isCreatingNewNote && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNoteIds([selectedNoteId]);
                        setActiveTab("chat");
                        setChatInput(`Summarize the main takeaways from note "${noteTitle}".`);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-950/30 border border-blue-500/20 rounded-lg transition-colors cursor-pointer"
                    >
                      Send to AI Chat
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingNoteId(selectedNoteId)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                      title="Delete Note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={isSavingNote}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-blue-950/40 cursor-pointer"
                >
                  {isSavingNote ? "Saving..." : "Save Note"}
                </button>
              </div>
            </div>

            {/* Note form */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Note Title
                </label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Key Takeaways from Q3 Meeting"
                  className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Content
                </label>
                <textarea
                  rows={14}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Type notes, research findings, drafted paragraphs, or project outlines..."
                  className="w-full px-3.5 py-3 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 font-mono leading-relaxed resize-y"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: GROUNDED AI CHAT & ACTIONS */}
      {/* ======================================================== */}
      {activeTab === "chat" && (
        <div className="bg-[#0c0c0e] border border-slate-800 rounded-2xl flex flex-col shadow-xl overflow-hidden min-h-[600px] max-h-[82vh]">
          {/* Chat Header & Context pill */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-white truncate">
                  Grounded Workspace Intelligence
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  Answers prioritize workspace material · Zero hallucination of workspace facts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {workspace.chatHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Clear Chat
                </button>
              )}
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-950/40 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
                Quick Actions:
              </span>
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.id}
                  type="button"
                  disabled={isAiProcessing}
                  onClick={() => handleTriggerAiChat(undefined, qa.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[30px] rounded-lg text-[11px] font-semibold bg-slate-900 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-800 text-slate-200 transition-colors shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  <span>{qa.icon}</span>
                  <span>{qa.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {workspace.chatHistory.length === 0 ? (
              <div className="text-center py-16 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1.5">
                  Ask Anything About This Workspace
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  The AI uses your selected documents and notes. If a question cannot be supported by your workspace material, the AI will explicitly state that it couldn't be verified.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTriggerAiChat("Summarize this project based on the uploaded documents.", "summarize")}
                    className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    "Summarize this project"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerAiChat("What are the main problems or findings identified in these documents?")}
                    className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    "What are the main problems identified?"
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerAiChat("Turn my saved notes into a structured professional report.", "create_report")}
                    className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    "Turn notes into a report"
                  </button>
                </div>
              </div>
            ) : (
              workspace.chatHistory.map((msg) => {
                const isAssistant = msg.role === "assistant";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isAssistant ? "items-start" : "items-end"
                    }`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                        isAssistant
                          ? "bg-slate-900 border border-slate-800 text-slate-100"
                          : "bg-blue-600 text-white shadow-md shadow-blue-950/40"
                      }`}
                    >
                      {/* Unverified Warning Notice */}
                      {isAssistant && msg.unverifiedNotice && (
                        <div className="mb-2.5 p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span className="font-semibold text-[11px]">
                            Notice: Could not verify requested claim from workspace documents.
                          </span>
                        </div>
                      )}

                      {/* General Knowledge Tag */}
                      {isAssistant && msg.isGeneralKnowledge && (
                        <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/40 border border-indigo-500/30 text-indigo-300">
                          <Info className="w-3 h-3" />
                          <span>General Knowledge</span>
                        </div>
                      )}

                      {/* Sources Used Banner */}
                      {isAssistant && msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                        <div className="mb-2 flex flex-wrap items-center gap-1 text-[10px] text-blue-300">
                          <span className="font-bold text-slate-400">Grounded from:</span>
                          {msg.sourcesUsed.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-blue-950/50 border border-blue-500/20"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Content */}
                      <div className="whitespace-pre-wrap select-text font-sans">
                        {msg.content}
                      </div>

                      {/* Assistant message action buttons */}
                      {isAssistant && (
                        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                            >
                              {copiedMessageId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Copied</span>
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
                              onClick={() => handleSaveMessageAsNote(msg.content)}
                              className="hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>Save as Note</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isAiProcessing && (
              <div className="flex items-center gap-2 text-xs text-blue-400 animate-pulse p-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Lexis Workspace AI is reasoning over your documents...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/60 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTriggerAiChat();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                disabled={isAiProcessing}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your documents, summarize, or instruct AI..."
                className="flex-1 px-4 py-2.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isAiProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all shadow-md shadow-blue-950/40 cursor-pointer"
              >
                {isAiProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT VIEWER MODAL */}
      <DocumentViewerModal
        document={viewingDocument}
        isOpen={Boolean(viewingDocument)}
        onClose={() => setViewingDocument(null)}
        onSendToChat={(docName, text) => {
          if (viewingDocument) {
            setSelectedDocIds([viewingDocument.id]);
          }
          setActiveTab("chat");
          setChatInput(`Analyze document "${docName}" and highlight major points.`);
        }}
        onCreateNote={async (title, content) => {
          try {
            const res = await createNoteApi(workspace.id, { title, content });
            onUpdateWorkspace(res.workspace);
            addToast("Created note from document!", "success");
          } catch (err: any) {
            addToast(err.message || "Failed to create note.", "error");
          }
        }}
      />

      {/* DOCUMENT COMPARE MODAL */}
      <DocumentCompareModal
        documents={workspace.documents}
        initialDocId={compareInitialDocId}
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        onCompareWithAi={(docA, docB) => {
          setSelectedDocIds([docA.id, docB.id]);
          setActiveTab("chat");
          handleTriggerAiChat(
            `Perform a thorough side-by-side comparison between "${docA.name}" and "${docB.name}". Identify key differences, common themes, and changes.`,
            "explain"
          );
        }}
      />

      {/* DELETE DOCUMENT CONFIRMATION */}
      {deletingDocId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setDeletingDocId(null)}
        >
          <div className="w-full max-w-sm bg-[#0c0c0e] border border-red-900/40 rounded-2xl shadow-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-1.5">Remove Document?</h3>
            <p className="text-xs text-slate-400 mb-5">
              This document will be removed from this workspace and will no longer be available for AI context.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingDocId(null)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDocument(deletingDocId)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE NOTE CONFIRMATION */}
      {deletingNoteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setDeletingNoteId(null)}
        >
          <div className="w-full max-w-sm bg-[#0c0c0e] border border-red-900/40 rounded-2xl shadow-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-1.5">Delete Note?</h3>
            <p className="text-xs text-slate-400 mb-5">
              Are you sure you want to delete this note? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingNoteId(null)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNote(deletingNoteId)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE WORKSPACE CONFIRMATION */}
      {isConfirmingDeleteWs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsConfirmingDeleteWs(false)}
        >
          <div className="w-full max-w-sm bg-[#0c0c0e] border border-red-900/40 rounded-2xl shadow-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-1.5">Delete Entire Workspace?</h3>
            <p className="text-xs text-slate-400 mb-5">
              All documents, notes, and chat history in "{workspace.name}" will be deleted permanently.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDeleteWs(false)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteWorkspace(workspace.id);
                  onBackToDashboard();
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
