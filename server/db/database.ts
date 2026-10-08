import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "lexisai.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite database instance
export const db = new DatabaseSync(DB_FILE);

// Enable WAL mode for high concurrency and resilience
db.exec("PRAGMA journal_mode = WAL;");
// Enable strict foreign key enforcement
db.exec("PRAGMA foreign_keys = ON;");
// Enable busy timeout to handle concurrent transactions gracefully
db.exec("PRAGMA busy_timeout = 5000;");

/**
 * Migration Manager
 * Implements versioned database migrations with schema_migrations table.
 */
export function runMigrations(): void {
  // 1. Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const appliedVersions = new Set<number>();
  const rows = db.prepare("SELECT version FROM schema_migrations;").all() as { version: number }[];
  for (const r of rows) {
    appliedVersions.add(r.version);
  }

  // Migration 1: Core Relational Schema
  if (!appliedVersions.has(1)) {
    console.log("[Database] Applying Migration 1: Core Relational Schema...");
    db.exec(`
      -- Users & Profiles
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        verification_token TEXT,
        verification_expires_at INTEGER,
        reset_token TEXT,
        reset_expires_at INTEGER,
        age_confirmed INTEGER NOT NULL DEFAULT 1,
        terms_version TEXT NOT NULL DEFAULT 'v1.0-2026',
        terms_accepted_at INTEGER NOT NULL,
        marketing_consent INTEGER NOT NULL DEFAULT 0,
        profile_photo_url TEXT,
        region TEXT,
        google_id TEXT,
        auth_provider TEXT NOT NULL DEFAULT 'local',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_login_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

      -- Sessions
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

      -- Workspaces
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);

      -- Workspace Membership (Supports collaborative sharing if enabled)
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'owner',
        created_at INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, user_id)
      );

      -- Documents
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL DEFAULT 'text/plain',
        file_path TEXT,
        extracted_text TEXT NOT NULL DEFAULT '',
        word_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ready',
        error_message TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

      -- Document Chunks for Retrieval & Grounding
      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        word_count INTEGER NOT NULL,
        char_start INTEGER NOT NULL,
        char_end INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_workspace ON document_chunks(workspace_id);

      -- Notes
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

      -- Workspace Chat History
      CREATE TABLE IF NOT EXISTS workspace_chats (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sources_used TEXT,
        is_general_knowledge INTEGER NOT NULL DEFAULT 0,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chats_workspace ON workspace_chats(workspace_id);

      -- Subscriptions
      CREATE TABLE IF NOT EXISTS subscriptions (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        plan TEXT NOT NULL DEFAULT 'free',
        status TEXT NOT NULL DEFAULT 'none',
        payment_provider TEXT NOT NULL DEFAULT 'none',
        provider_customer_id TEXT,
        provider_subscription_id TEXT,
        start_date TEXT,
        expiry_date TEXT,
        is_pro INTEGER NOT NULL DEFAULT 0,
        verified_at TEXT NOT NULL
      );

      -- AI Credits Balance
      CREATE TABLE IF NOT EXISTS user_credits (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      -- Credit Audit Log
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reference TEXT NOT NULL,
        amount INTEGER NOT NULL,
        action TEXT NOT NULL,
        previous_balance INTEGER NOT NULL,
        new_balance INTEGER NOT NULL,
        request_id TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_credit_tx_ref ON credit_transactions(reference);

      -- Processed Payment Transactions (Prevents double crediting)
      CREATE TABLE IF NOT EXISTS processed_transactions (
        reference TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payment_type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'KES',
        processed_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_processed_tx_user ON processed_transactions(user_id);
    `);

    db.prepare(`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (?, ?, ?);
    `).run(1, "001_core_relational_schema", Date.now());

    console.log("[Database] Migration 1 applied successfully.");
  }
}

/**
 * Execute a function within a strict database transaction.
 * Rolls back automatically if an error occurs.
 */
export function runInTransaction<T>(fn: () => T): T {
  db.exec("BEGIN TRANSACTION;");
  try {
    const result = fn();
    db.exec("COMMIT;");
    return result;
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

// Auto-run migrations on load
runMigrations();
