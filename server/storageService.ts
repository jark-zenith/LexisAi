import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), ".data", "uploads");

// Ensure private uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface StoredFileMetadata {
  relativePath: string;
  absolutePath: string;
  size: number;
  mimeType: string;
  originalName: string;
  sha256: string;
}

/**
 * Validates and saves an uploaded file buffer securely to private storage.
 */
export async function saveUploadedFile(params: {
  userId: string;
  workspaceId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<StoredFileMetadata> {
  const { userId, workspaceId, fileName, mimeType, buffer } = params;

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of 10MB.`);
  }

  // Sanitize filename to prevent directory traversal
  const sanitizedName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const uniqueId = crypto.randomBytes(8).toString("hex");

  // User-isolated directory
  const userDir = path.join(UPLOADS_DIR, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const storedFileName = `${Date.now()}_${uniqueId}_${sanitizedName}`;
  const absolutePath = path.join(userDir, storedFileName);
  const relativePath = path.join(".data", "uploads", userId, storedFileName);

  // Atomic write via temp file
  const tempPath = `${absolutePath}.tmp_${uniqueId}`;
  fs.writeFileSync(tempPath, buffer);
  fs.renameSync(tempPath, absolutePath);

  return {
    relativePath,
    absolutePath,
    size: buffer.length,
    mimeType,
    originalName: sanitizedName,
    sha256: hash,
  };
}

/**
 * Retrieves a file securely, verifying that it belongs to the authenticated user.
 */
export function getUploadedFilePath(userId: string, relativePath: string): string | null {
  if (!relativePath || typeof relativePath !== "string") return null;

  const targetPath = path.resolve(process.cwd(), relativePath);
  const expectedUserDir = path.resolve(UPLOADS_DIR, userId);

  // Security check: Must reside within user's private upload directory
  if (!targetPath.startsWith(expectedUserDir)) {
    console.warn(`[StorageSecurity] Path traversal attempt blocked: ${targetPath}`);
    return null;
  }

  if (!fs.existsSync(targetPath)) {
    return null;
  }

  return targetPath;
}

/**
 * Safely deletes an uploaded file from disk.
 */
export function deleteUploadedFile(userId: string, relativePath: string): boolean {
  try {
    const filePath = getUploadedFilePath(userId, relativePath);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.warn("[StorageService] Could not delete file:", err);
  }
  return false;
}
