import React, { useState } from "react";
import {
  FolderKanban,
  Plus,
  Search,
  FileText,
  BookOpen,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  FolderOpen,
  Check,
} from "lucide-react";
import { WorkspaceSummary } from "../../types";

export interface WorkspaceTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultName: string;
  defaultDescription: string;
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "school",
    name: "School Project",
    icon: "🎓",
    description: "Organize lecture notes, research, assignments, and project documents.",
    defaultName: "School Project",
    defaultDescription: "Organize lecture notes, research, assignments, and project documents.",
  },
  {
    id: "job",
    name: "Job Search",
    icon: "💼",
    description: "Keep CVs, cover letters, job descriptions, and application materials together.",
    defaultName: "Job Search",
    defaultDescription: "Keep CVs, cover letters, job descriptions, and application materials together.",
  },
  {
    id: "research",
    name: "Research Project",
    icon: "📑",
    description: "Organize research documents, notes, sources, and questions.",
    defaultName: "Research Project",
    defaultDescription: "Organize research documents, notes, sources, and questions.",
  },
  {
    id: "business",
    name: "Business Project",
    icon: "🚀",
    description: "Manage business ideas, plans, proposals, and supporting documents.",
    defaultName: "Business Project",
    defaultDescription: "Manage business ideas, plans, proposals, and supporting documents.",
  },
  {
    id: "blank",
    name: "Blank Workspace",
    icon: "✨",
    description: "Start with an empty workspace.",
    defaultName: "",
    defaultDescription: "",
  },
];

interface WorkspaceDashboardProps {
  workspaces: WorkspaceSummary[];
  isLoading: boolean;
  onOpenWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (data: { name: string; description?: string }) => Promise<void>;
  onRenameWorkspace: (workspaceId: string, name: string, description?: string) => Promise<void>;
  onDeleteWorkspace: (workspaceId: string) => Promise<void>;
  onBackToStudio: () => void;
}

export const WorkspaceDashboard: React.FC<WorkspaceDashboardProps> = ({
  workspaces,
  isLoading,
  onOpenWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onBackToStudio,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("blank");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectTemplate = (template: WorkspaceTemplate) => {
    setSelectedTemplateId(template.id);
    setNewName(template.defaultName);
    setNewDescription(template.defaultDescription);
  };

  const handleOpenCreateModal = (defaultTemplateId: string = "blank") => {
    const tmpl = WORKSPACE_TEMPLATES.find((t) => t.id === defaultTemplateId) || WORKSPACE_TEMPLATES[4];
    setSelectedTemplateId(tmpl.id);
    setNewName(tmpl.defaultName);
    setNewDescription(tmpl.defaultDescription);
    setIsCreateModalOpen(true);
  };

  // Rename state
  const [renamingWorkspace, setRenamingWorkspace] = useState<WorkspaceSummary | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameDescInput, setRenameDescInput] = useState("");

  // Delete state
  const [deletingWorkspace, setDeletingWorkspace] = useState<WorkspaceSummary | null>(null);

  // Active action menu popover
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filter workspaces
  const filteredWorkspaces = workspaces.filter((ws) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return ws.name.toLowerCase().includes(q) || (ws.description || "").toLowerCase().includes(q);
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateWorkspace({
        name: newName.trim(),
        description: newDescription.trim(),
      });
      setNewName("");
      setNewDescription("");
      setSelectedTemplateId("blank");
      setIsCreateModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingWorkspace || !renameInput.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onRenameWorkspace(renamingWorkspace.id, renameInput.trim(), renameDescInput.trim());
      setRenamingWorkspace(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingWorkspace || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onDeleteWorkspace(deletingWorkspace.id);
      setDeletingWorkspace(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor(diffHours * 60));
      return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
    }
    if (diffHours < 24) {
      const hours = Math.floor(diffHours);
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    if (diffHours < 24 * 7) {
      const days = Math.floor(diffHours / 24);
      return `${days} day${days === 1 ? "" : "s"} ago`;
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FolderKanban className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Lexis Workspace
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Dedicated project hubs with grounded document intelligence, notes, and context-aware AI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToStudio}
            className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            ← Back to Editor
          </button>
          <button
            type="button"
            id="create-workspace-btn"
            onClick={() => handleOpenCreateModal("blank")}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md shadow-blue-950/40 transition-all cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>New Workspace</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspaces by name or description..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-900/90 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="text-xs text-slate-400 self-end sm:self-center">
          <span>{workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#0c0c0e] border border-slate-800/80 rounded-2xl p-5 animate-pulse h-44 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-4 bg-slate-800 rounded-md w-3/4" />
                <div className="h-3 bg-slate-800/60 rounded-md w-full" />
                <div className="h-3 bg-slate-800/60 rounded-md w-2/3" />
              </div>
              <div className="h-4 bg-slate-800/40 rounded-md w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        // Empty state
        <div className="bg-[#0c0c0e] border border-slate-800 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <FolderOpen className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-white mb-1.5">
            {searchQuery ? "No matching workspaces found" : "No workspaces created yet"}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            {searchQuery
              ? `No workspaces match "${searchQuery}". Try a different keyword.`
              : "Create a workspace to gather documents, organize research notes, and ask grounded AI questions with zero fabrication."}
          </p>
          <button
            type="button"
            onClick={() => {
              if (searchQuery) setSearchQuery("");
              else handleOpenCreateModal("blank");
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md shadow-blue-950/40 cursor-pointer"
          >
            {searchQuery ? (
              <span>Clear Search Filter</span>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Create Your First Workspace</span>
              </>
            )}
          </button>
        </div>
      ) : (
        // Workspace Cards Grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkspaces.map((ws) => (
            <div
              key={ws.id}
              className="group relative bg-[#0c0c0e] hover:bg-[#111114] border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all shadow-sm hover:shadow-md flex flex-col justify-between gap-4 text-left"
            >
              <div>
                {/* Header with Title and Menu */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div
                    onClick={() => onOpenWorkspace(ws.id)}
                    className="flex-1 cursor-pointer"
                  >
                    <h2 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                      {ws.name}
                    </h2>
                  </div>

                  {/* Menu Trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMenuId(activeMenuId === ws.id ? null : ws.id)
                      }
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      aria-label="Workspace Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === ws.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-36 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-1 z-20"
                        onMouseLeave={() => setActiveMenuId(null)}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            setRenamingWorkspace(ws);
                            setRenameInput(ws.name);
                            setRenameDescInput(ws.description || "");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-left cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Rename</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            setDeletingWorkspace(ws);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors text-left cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p
                  onClick={() => onOpenWorkspace(ws.id)}
                  className="text-xs text-slate-400 line-clamp-2 leading-relaxed cursor-pointer min-h-[32px]"
                >
                  {ws.description || "No description added yet."}
                </p>
              </div>

              {/* Card Footer: Metadata and Open button */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1" title={`${ws.documentCount} documents`}>
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>{ws.documentCount} doc{ws.documentCount === 1 ? "" : "s"}</span>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="flex items-center gap-1" title={`${ws.noteCount} notes`}>
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    <span>{ws.noteCount} note{ws.noteCount === 1 ? "" : "s"}</span>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span title={`Updated ${new Date(ws.updatedAt).toLocaleString()}`}>
                    {formatDate(ws.updatedAt)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenWorkspace(ws.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/20 rounded-lg transition-all cursor-pointer"
                >
                  <span>Open</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE WORKSPACE MODAL WITH TEMPLATES */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setIsCreateModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#0c0c0e] border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-white">Create New Workspace</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Select a workspace template to pre-fill details or start with a blank workspace.
            </p>

            {/* Workspace Template Options */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Choose a Template
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WORKSPACE_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500 shadow-xs ring-1 ring-blue-500/50"
                          : "bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">{tmpl.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={`text-xs font-bold ${isSelected ? "text-blue-300" : "text-white"}`}>
                            {tmpl.name}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                          {tmpl.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Creation Form */}
            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-3 border-t border-slate-800/80">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Workspace Name <span className="text-blue-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. School Project, Research Project, Q3 Strategic Plan"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What is this workspace for? Core objectives, topics, or reference notes."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all cursor-pointer shadow-md shadow-blue-950/40"
                >
                  {isSubmitting ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME WORKSPACE MODAL */}
      {renamingWorkspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setRenamingWorkspace(null);
          }}
        >
          <div className="w-full max-w-md bg-[#0c0c0e] border border-slate-800 rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-bold text-white mb-1">Rename Workspace</h2>
            <p className="text-xs text-slate-400 mb-4">
              Update the name or description of this workspace.
            </p>

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={renameDescInput}
                  onChange={(e) => setRenameDescInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setRenamingWorkspace(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameInput.trim() || isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition-all cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE WORKSPACE CONFIRMATION DIALOG */}
      {deletingWorkspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setDeletingWorkspace(null);
          }}
        >
          <div className="w-full max-w-md bg-[#0c0c0e] border border-red-900/40 rounded-2xl shadow-2xl p-6">
            <div className="w-10 h-10 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-white mb-1.5">
              Delete Workspace "{deletingWorkspace.name}"?
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              This action cannot be undone. All documents, notes, and chat history in this workspace will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeletingWorkspace(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl transition-all cursor-pointer shadow-md shadow-red-950/40"
              >
                {isSubmitting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
