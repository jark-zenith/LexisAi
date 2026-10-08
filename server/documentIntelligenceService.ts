import { db, runInTransaction } from "./db/database";
import crypto from "crypto";

export interface DocumentChunk {
  id: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  chunkIndex: number;
  content: string;
  wordCount: number;
  charStart: number;
  charEnd: number;
}

export interface RetrievedPassage {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  score: number;
}

/**
 * Intelligent section and paragraph-aware text chunker.
 * Targets ~600 words with 100-word overlap to preserve context across boundaries.
 */
export function chunkDocumentText(params: {
  documentId: string;
  workspaceId: string;
  userId: string;
  text: string;
}): DocumentChunk[] {
  const { documentId, workspaceId, userId, text } = params;

  if (!text || !text.trim()) {
    return [];
  }

  // Remove existing chunks for this document in SQLite
  db.prepare("DELETE FROM document_chunks WHERE document_id = ? AND user_id = ?;").run(documentId, userId);

  const paragraphs = text.split(/\n{2,}/);
  const chunks: DocumentChunk[] = [];

  let currentWords: string[] = [];
  let chunkStartIndex = 0;
  let charCursor = 0;
  let chunkIndex = 0;

  const flushChunk = (words: string[], charStart: number) => {
    if (words.length === 0) return;
    const content = words.join(" ");
    const chunkId = `chk_${Date.now()}_${chunkIndex}_${crypto.randomBytes(4).toString("hex")}`;
    const chunk: DocumentChunk = {
      id: chunkId,
      documentId,
      workspaceId,
      userId,
      chunkIndex,
      content,
      wordCount: words.length,
      charStart,
      charEnd: charStart + content.length,
    };
    chunks.push(chunk);
    chunkIndex++;
  };

  for (const para of paragraphs) {
    const paraWords = para.trim().split(/\s+/).filter(Boolean);
    if (paraWords.length === 0) continue;

    if (currentWords.length + paraWords.length > 600) {
      if (currentWords.length > 0) {
        flushChunk(currentWords, chunkStartIndex);
        // Overlap: keep last ~80 words for boundary context
        const overlapCount = Math.min(80, currentWords.length);
        const overlap = currentWords.slice(-overlapCount);
        currentWords = [...overlap, ...paraWords];
        chunkStartIndex = charCursor;
      } else {
        // Single huge paragraph: chunk by words directly
        for (let i = 0; i < paraWords.length; i += 500) {
          const slice = paraWords.slice(i, i + 500);
          flushChunk(slice, charCursor + i * 5);
        }
      }
    } else {
      currentWords.push(...paraWords);
    }
    charCursor += para.length + 2;
  }

  if (currentWords.length > 0) {
    flushChunk(currentWords, chunkStartIndex);
  }

  // Persist chunks in SQLite within transaction
  runInTransaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO document_chunks (
        id, document_id, workspace_id, user_id, chunk_index, content, word_count, char_start, char_end, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    const now = Date.now();
    for (const chk of chunks) {
      insertStmt.run(
        chk.id,
        chk.documentId,
        chk.workspaceId,
        chk.userId,
        chk.chunkIndex,
        chk.content,
        chk.wordCount,
        chk.charStart,
        chk.charEnd,
        now
      );
    }
  });

  return chunks;
}

/**
 * Retrieves the most relevant document passages using BM25-style keyword relevance,
 * exact phrase scoring, and heading matching, strictly isolated to the user and workspace.
 */
export function retrieveRelevantPassages(params: {
  workspaceId: string;
  userId: string;
  query: string;
  selectedDocumentIds?: string[];
  maxPassages?: number;
}): RetrievedPassage[] {
  const { workspaceId, userId, query, selectedDocumentIds, maxPassages = 5 } = params;

  // Retrieve user's authorized chunks and document names
  let sql = `
    SELECT c.id as chunk_id, c.document_id, d.name as document_name, c.chunk_index, c.content
    FROM document_chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE c.workspace_id = ? AND c.user_id = ? AND d.status = 'ready'
  `;
  const sqlParams: any[] = [workspaceId, userId];

  if (selectedDocumentIds && selectedDocumentIds.length > 0) {
    const placeholders = selectedDocumentIds.map(() => "?").join(",");
    sql += ` AND c.document_id IN (${placeholders})`;
    sqlParams.push(...selectedDocumentIds);
  }

  const rows = db.prepare(sql).all(...sqlParams) as {
    chunk_id: string;
    document_id: string;
    document_name: string;
    chunk_index: number;
    content: string;
  }[];

  if (rows.length === 0) {
    return [];
  }

  const queryTokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const cleanQuery = query.toLowerCase().trim();

  // Score chunks
  const scored: RetrievedPassage[] = rows.map((row) => {
    const textLower = row.content.toLowerCase();
    let score = 0;

    // Exact phrase match bonus
    if (cleanQuery.length > 4 && textLower.includes(cleanQuery)) {
      score += 15;
    }

    // Token frequency and keyword presence
    for (const token of queryTokens) {
      const occurrences = (textLower.match(new RegExp(`\\b${token}\\b`, "g")) || []).length;
      if (occurrences > 0) {
        score += Math.min(occurrences * 2, 8);
      } else if (textLower.includes(token)) {
        score += 1;
      }
    }

    return {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentName: row.document_name,
      chunkIndex: row.chunk_index,
      content: row.content,
      score,
    };
  });

  // Sort by highest score first, fallback to chunk ordering if scores equal
  scored.sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex);

  return scored.slice(0, maxPassages);
}

/**
 * Builds grounded context for Gemini model with strict factual citations
 */
export function buildGroundedContextPrompt(passages: RetrievedPassage[]): {
  contextBlock: string;
  sourcesList: string[];
} {
  if (passages.length === 0) {
    return {
      contextBlock: "No specific document passages were retrieved for this query.",
      sourcesList: [],
    };
  }

  const sourcesSet = new Set<string>();
  const blocks: string[] = [];

  for (const p of passages) {
    sourcesSet.add(p.documentName);
    blocks.push(
      `--- EXCERPT [Source: "${p.documentName}", Section/Part ${p.chunkIndex + 1}] ---\n${p.content}`
    );
  }

  const contextBlock = blocks.join("\n\n");
  return {
    contextBlock,
    sourcesList: Array.from(sourcesSet),
  };
}
