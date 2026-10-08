import {
  Workspace,
  WorkspaceSummary,
  WorkspaceDocument,
  WorkspaceNote,
  WorkspaceChatMessage,
} from "../types";
import { getOrCreateUserId } from "./usageManager";
import { getAuthHeaders } from "./authClient";

const getHeaders = (extra?: Record<string, string>): Record<string, string> => {
  const userId = getOrCreateUserId();
  return getAuthHeaders({
    "X-Lexis-User-Id": userId,
    ...(extra || {}),
  });
};

export async function fetchWorkspaces(): Promise<WorkspaceSummary[]> {
  try {
    const res = await fetch("/api/workspaces", {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Failed to load workspaces (${res.status})`);
    }
    const data = await res.json();
    return data.workspaces || [];
  } catch (err: any) {
    console.error("fetchWorkspaces error:", err);
    throw err;
  }
}

export async function fetchWorkspace(workspaceId: string): Promise<Workspace> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load workspace (${res.status})`);
  }
  const data = await res.json();
  return data.workspace;
}

export async function createWorkspaceApi(data: {
  name: string;
  description?: string;
}): Promise<Workspace> {
  const res = await fetch("/api/workspaces", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create workspace.");
  }
  const result = await res.json();
  return result.workspace;
}

export async function updateWorkspaceApi(
  workspaceId: string,
  data: { name?: string; description?: string }
): Promise<Workspace> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update workspace.");
  }
  const result = await res.json();
  return result.workspace;
}

export async function deleteWorkspaceApi(workspaceId: string): Promise<boolean> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete workspace.");
  }
  return true;
}

export async function uploadDocumentApi(
  workspaceId: string,
  payload: {
    name: string;
    size: number;
    type: string;
    text?: string;
    base64Data?: string;
  }
): Promise<{ document: WorkspaceDocument; workspace: Workspace }> {
  const res = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/documents`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to upload document.");
  }
  return await res.json();
}

export async function deleteDocumentApi(
  workspaceId: string,
  docId: string
): Promise<Workspace> {
  const res = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(
      docId
    )}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to remove document.");
  }
  const result = await res.json();
  return result.workspace;
}

export async function createNoteApi(
  workspaceId: string,
  note: { title: string; content: string }
): Promise<{ note: WorkspaceNote; workspace: Workspace }> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/notes`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(note),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create note.");
  }
  return await res.json();
}

export async function updateNoteApi(
  workspaceId: string,
  noteId: string,
  updates: { title?: string; content?: string }
): Promise<{ note: WorkspaceNote; workspace: Workspace }> {
  const res = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(
      noteId
    )}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update note.");
  }
  return await res.json();
}

export async function deleteNoteApi(
  workspaceId: string,
  noteId: string
): Promise<Workspace> {
  const res = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(
      noteId
    )}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete note.");
  }
  const result = await res.json();
  return result.workspace;
}

export async function clearWorkspaceChatApi(workspaceId: string): Promise<Workspace> {
  const res = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/chat/clear`,
    {
      method: "POST",
      headers: getHeaders(),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to clear chat history.");
  }
  const result = await res.json();
  return result.workspace;
}

export async function sendWorkspaceChatApi(
  workspaceId: string,
  payload: {
    prompt?: string;
    action?: string;
    selectedDocumentIds?: string[];
    selectedNoteIds?: string[];
    usageCount: number;
    requestId?: string;
  }
): Promise<{
  message: WorkspaceChatMessage;
  workspace: Workspace;
  creditsRemaining?: number;
  actionSource?: string;
}> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/chat`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (res.status === 403) {
    const errData = await res.json().catch(() => ({}));
    const error: any = new Error(
      errData.error || "Monthly action limit reached. Buy AI credits or upgrade to Pro."
    );
    error.status = 403;
    error.limitReached = true;
    throw error;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to process workspace request.");
  }

  return await res.json();
}
