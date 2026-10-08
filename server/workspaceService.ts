import fs from "fs";
import path from "path";
import {
  Workspace,
  WorkspaceDocument,
  WorkspaceNote,
  WorkspaceChatMessage,
  WorkspaceSummary,
} from "../src/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const WORKSPACES_FILE = path.join(DATA_DIR, "workspaces.json");

// In-memory cache of all workspaces: Map<workspaceId, Workspace>
const workspacesMap = new Map<string, Workspace>();

function initWorkspaceStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(WORKSPACES_FILE)) {
      const raw = fs.readFileSync(WORKSPACES_FILE, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const ws of list) {
          if (ws && typeof ws.id === "string") {
            workspacesMap.set(ws.id, {
              id: ws.id,
              userId: ws.userId || "usr_guest",
              name: ws.name || "Untitled Workspace",
              description: ws.description || "",
              createdAt: ws.createdAt || Date.now(),
              updatedAt: ws.updatedAt || Date.now(),
              documents: Array.isArray(ws.documents) ? ws.documents : [],
              notes: Array.isArray(ws.notes) ? ws.notes : [],
              chatHistory: Array.isArray(ws.chatHistory) ? ws.chatHistory : [],
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[WorkspaceStore] Failed to initialize workspace disk cache:", err);
  }
}

// Persist store to disk asynchronously
function persistWorkspaces(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const all = Array.from(workspacesMap.values());
    fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(all, null, 2), "utf-8");
  } catch (err) {
    console.error("[WorkspaceStore] Failed to save workspaces to disk:", err);
  }
}

// Initialize on module load
initWorkspaceStore();

/**
 * List all workspaces owned by the user
 */
export function getUserWorkspaces(userId: string): WorkspaceSummary[] {
  const userWs: WorkspaceSummary[] = [];
  for (const ws of workspacesMap.values()) {
    if (ws.userId === userId) {
      userWs.push({
        id: ws.id,
        name: ws.name,
        description: ws.description,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
        documentCount: ws.documents.length,
        noteCount: ws.notes.length,
      });
    }
  }
  // Sort latest updated first
  return userWs.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get single workspace with strict user ownership validation
 */
export function getWorkspace(userId: string, workspaceId: string): Workspace | null {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return null;
  }
  return ws;
}

/**
 * Create a new workspace for user
 */
export function createWorkspace(
  userId: string,
  data: { name: string; description?: string }
): Workspace {
  const now = Date.now();
  const id = `ws_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const newWorkspace: Workspace = {
    id,
    userId,
    name: data.name.trim() || "Untitled Workspace",
    description: (data.description || "").trim(),
    createdAt: now,
    updatedAt: now,
    documents: [],
    notes: [],
    chatHistory: [],
  };

  workspacesMap.set(id, newWorkspace);
  persistWorkspaces();
  return newWorkspace;
}

/**
 * Rename or update description with ownership check
 */
export function updateWorkspace(
  userId: string,
  workspaceId: string,
  data: { name?: string; description?: string }
): Workspace | null {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return null;
  }

  if (typeof data.name === "string" && data.name.trim()) {
    ws.name = data.name.trim();
  }
  if (typeof data.description === "string") {
    ws.description = data.description.trim();
  }
  ws.updatedAt = Date.now();

  persistWorkspaces();
  return ws;
}

/**
 * Delete workspace with ownership check
 */
export function deleteWorkspace(userId: string, workspaceId: string): boolean {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return false;
  }

  workspacesMap.delete(workspaceId);
  persistWorkspaces();
  return true;
}

/**
 * Add document to workspace with ownership check
 */
export function addDocumentToWorkspace(
  userId: string,
  workspaceId: string,
  docData: {
    name: string;
    size: number;
    type: string;
    extractedText: string;
    status: "ready" | "error" | "unreadable";
    errorMessage?: string;
  }
): { workspace: Workspace; document: WorkspaceDocument } | null {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return null;
  }

  const now = Date.now();
  const words = docData.extractedText.trim()
    ? docData.extractedText.trim().split(/\s+/).length
    : 0;

  const newDoc: WorkspaceDocument = {
    id: `doc_${now}_${Math.random().toString(36).substring(2, 9)}`,
    name: docData.name,
    size: docData.size,
    type: docData.type,
    extractedText: docData.extractedText,
    wordCount: words,
    status: docData.status,
    uploadedAt: now,
    errorMessage: docData.errorMessage,
  };

  ws.documents.push(newDoc);
  ws.updatedAt = now;
  persistWorkspaces();

  return { workspace: ws, document: newDoc };
}

/**
 * Remove document from workspace with ownership check
 */
export function removeDocumentFromWorkspace(
  userId: string,
  workspaceId: string,
  docId: string
): Workspace | null {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return null;
  }

  const initialCount = ws.documents.length;
  ws.documents = ws.documents.filter((d) => d.id !== docId);

  if (ws.documents.length !== initialCount) {
    ws.updatedAt = Date.now();
    persistWorkspaces();
  }

  return ws;
}

/**
 * Add note to workspace with ownership check
 */
export function addNoteToWorkspace(
  userId: string,
  workspaceId: string,
  noteData: { title: string; content: string }
): { workspace: Workspace; note: WorkspaceNote } | null {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return null;
  }

  const now = Date.now();
  const newNote: WorkspaceNote = {
    id: `note_${now}_${Math.random().toString(36).substring(2, 9)}`,
    title: noteData.title.trim() || "Untitled Note",
    content: noteData.content.trim(),
    createdAt: now,
    updatedAt: now,
  };

  ws.notes.unshift(newNote);
  ws.updatedAt = now;
  persistWorkspaces();

  return { workspace: ws, note: newNote };
}

/**
 * Update note in workspace with ownership check
 */
export function updateNoteInWorkspace(
  userId: string,
  workspaceId: string,
  noteId: string,
  updates: { title?: string; content?: string }
): { workspace: Workspace; note: WorkspaceNote } | null {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return null;
  }

  const note = ws.notes.find((n) => n.id === noteId);
  if (!note) {
    return null;
  }

  const now = Date.now();
  if (typeof updates.title === "string") {
    note.title = updates.title.trim() || "Untitled Note";
  }
  if (typeof updates.content === "string") {
    note.content = updates.content;
  }
  note.updatedAt = now;
  ws.updatedAt = now;

  persistWorkspaces();
  return { workspace: ws, note };
}

/**
 * Delete note from workspace with ownership check
 */
export function deleteNoteFromWorkspace(
  userId: string,
  workspaceId: string,
  noteId: string
): Workspace | null {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return null;
  }

  const initialCount = ws.notes.length;
  ws.notes = ws.notes.filter((n) => n.id !== noteId);

  if (ws.notes.length !== initialCount) {
    ws.updatedAt = Date.now();
    persistWorkspaces();
  }

  return ws;
}

/**
 * Add chat message to workspace history with ownership check
 */
export function appendChatMessageToWorkspace(
  userId: string,
  workspaceId: string,
  message: WorkspaceChatMessage
): Workspace | null {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return null;
  }

  ws.chatHistory.push(message);
  // Keep last 100 messages per workspace
  if (ws.chatHistory.length > 100) {
    ws.chatHistory = ws.chatHistory.slice(-100);
  }
  ws.updatedAt = Date.now();
  persistWorkspaces();

  return ws;
}

/**
 * Clear chat history in workspace
 */
export function clearWorkspaceChatHistory(
  userId: string,
  workspaceId: string
): Workspace | null {
  const ws = workspacesMap.get(workspaceId);
  if (!ws || ws.userId !== userId) {
    return null;
  }

  ws.chatHistory = [];
  ws.updatedAt = Date.now();
  persistWorkspaces();

  return ws;
}
