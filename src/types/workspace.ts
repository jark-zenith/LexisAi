export interface WorkspaceDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  extractedText: string;
  wordCount: number;
  status: "ready" | "error" | "unreadable";
  uploadedAt: number;
  errorMessage?: string;
}

export interface WorkspaceNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sourcesUsed?: string[];
  isGeneralKnowledge?: boolean;
  unverifiedNotice?: boolean;
}

export interface Workspace {
  id: string;
  userId?: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  documents: WorkspaceDocument[];
  notes: WorkspaceNote[];
  chatHistory: WorkspaceChatMessage[];
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  documentCount: number;
  noteCount: number;
}
