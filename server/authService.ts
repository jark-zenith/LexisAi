import crypto from "crypto";
import fs from "fs";
import path from "path";
import { UserProfile } from "../src/types";
import { db, runInTransaction } from "./db/database";

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  passwordHash: string | null;
  emailVerified: boolean;
  verificationToken?: string | null;
  verificationTokenExpiresAt?: number | null;
  resetPasswordToken?: string | null;
  resetPasswordTokenExpiresAt?: number | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number;
  ageConfirmed: boolean;
  termsAcceptedVersion: string;
  termsAcceptedAt: number;
  marketingConsent: boolean;
  profilePhotoUrl?: string | null;
  region?: string | null;
  googleId?: string | null;
  authProvider: "local" | "google" | "both";
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  lastActiveAt: number;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory rate limiting map for sliding window checks
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Helper to map DB row to UserRecord
function rowToUserRecord(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    emailVerified: Boolean(row.email_verified),
    verificationToken: row.verification_token,
    verificationTokenExpiresAt: row.verification_expires_at,
    resetPasswordToken: row.reset_token,
    resetPasswordTokenExpiresAt: row.reset_expires_at,
    ageConfirmed: Boolean(row.age_confirmed),
    termsAcceptedVersion: row.terms_version,
    termsAcceptedAt: row.terms_accepted_at,
    marketingConsent: Boolean(row.marketing_consent),
    profilePhotoUrl: row.profile_photo_url,
    region: row.region,
    googleId: row.google_id,
    authProvider: row.auth_provider as any,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

// Import legacy JSON data into SQLite on startup if needed
function migrateLegacyJsonUsers() {
  try {
    const legacyUsersPath = path.join(process.cwd(), ".data", "users.json");
    if (fs.existsSync(legacyUsersPath)) {
      const raw = fs.readFileSync(legacyUsersPath, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO users (
            id, email, full_name, display_name, password_hash, email_verified,
            verification_token, verification_expires_at, reset_token, reset_expires_at,
            age_confirmed, terms_version, terms_accepted_at, marketing_consent,
            profile_photo_url, region, google_id, auth_provider, created_at, updated_at, last_login_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `);

        for (const u of list) {
          if (u && u.id && u.email) {
            insertStmt.run(
              u.id,
              u.email.toLowerCase().trim(),
              u.fullName || "User",
              u.displayName || u.fullName || "User",
              u.passwordHash || null,
              u.emailVerified ? 1 : 0,
              u.verificationToken || null,
              u.verificationTokenExpiresAt || null,
              u.resetPasswordToken || null,
              u.resetPasswordTokenExpiresAt || null,
              u.ageConfirmed ? 1 : 1,
              u.termsAcceptedVersion || "v1.0-2026",
              u.termsAcceptedAt || Date.now(),
              u.marketingConsent ? 1 : 0,
              u.profilePhotoUrl || null,
              u.region || null,
              u.googleId || null,
              u.authProvider || "local",
              u.createdAt || Date.now(),
              u.updatedAt || Date.now(),
              u.lastLoginAt || Date.now()
            );
          }
        }
      }
    }
  } catch (err) {
    console.warn("[AuthService] Legacy JSON migration notice:", err);
  }
}

migrateLegacyJsonUsers();

// Cryptographic Password Hashing using Node.js scrypt (OWASP recommended)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 3 || parts[0] !== "scrypt") {
      return false;
    }
    const salt = parts[1];
    const key = Buffer.from(parts[2], "hex");
    const testKey = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
    });
    return crypto.timingSafeEqual(key, testKey);
  } catch {
    return false;
  }
}

// Password Strength Validator
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (!password || typeof password !== "string") {
    return { valid: false, score: 0, feedback: ["Password is required."] };
  }

  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push("Must be at least 8 characters long.");
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Must include both uppercase and lowercase letters.");
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push("Must include at least one number.");
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Must include at least one special character (e.g. !@#$%^&*).");
  }

  return {
    valid: score >= 3 && password.length >= 8,
    score,
    feedback,
  };
}

// Rate Limiting Utility
export function checkRateLimit(
  actionKey: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(actionKey);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(actionKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxAttempts) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  entry.count += 1;
  return { allowed: true };
}

// User Record Sanitization (Never expose passwordHash or tokens)
export function sanitizeUser(u: UserRecord): UserProfile {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    displayName: u.displayName || u.fullName,
    emailVerified: u.emailVerified,
    profilePhotoUrl: u.profilePhotoUrl || null,
    region: u.region || null,
    ageConfirmed: u.ageConfirmed,
    termsAcceptedVersion: u.termsAcceptedVersion,
    termsAcceptedAt: u.termsAcceptedAt,
    marketingConsent: u.marketingConsent,
    authProvider: u.authProvider,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt,
  };
}

// Create Session in SQLite
export function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): SessionRecord {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days validity

  db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at, last_active_at, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `).run(token, userId, now, expiresAt, now, ipAddress || null, userAgent || null);

  return {
    token,
    userId,
    createdAt: now,
    expiresAt,
    lastActiveAt: now,
    ipAddress,
    userAgent,
  };
}

// Resolve User from Session Token via SQLite
export function resolveUserFromToken(token: string): UserRecord | null {
  if (!token || typeof token !== "string") return null;

  const now = Date.now();
  const row = db.prepare(`
    SELECT u.*, s.expires_at, s.token as session_token
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?;
  `).get(token.trim(), now) as any;

  if (!row) {
    return null;
  }

  // Update last active timestamp
  db.prepare("UPDATE sessions SET last_active_at = ? WHERE token = ?;").run(now, token.trim());

  return rowToUserRecord(row);
}

// Invalidate Session
export function revokeSession(token: string): boolean {
  if (!token) return false;
  const result = db.prepare("DELETE FROM sessions WHERE token = ?;").run(token.trim());
  return result.changes > 0;
}

// Invalidate All User Sessions
export function revokeAllUserSessions(userId: string): void {
  if (!userId) return;
  db.prepare("DELETE FROM sessions WHERE user_id = ?;").run(userId);
}

// User Lookups
export function getUserById(userId: string): UserRecord | null {
  if (!userId) return null;
  const row = db.prepare("SELECT * FROM users WHERE id = ?;").get(userId) as any;
  return row ? rowToUserRecord(row) : null;
}

export function getUserByEmail(email: string): UserRecord | null {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  const row = db.prepare("SELECT * FROM users WHERE email = ?;").get(cleanEmail) as any;
  return row ? rowToUserRecord(row) : null;
}

// Registration
export async function registerUser(payload: {
  email: string;
  password: string;
  fullName: string;
  displayName?: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
  marketingConsent?: boolean;
}): Promise<{ user: UserProfile; session: SessionRecord }> {
  const cleanEmail = payload.email.toLowerCase().trim();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Please provide a valid email address.");
  }

  const existing = getUserByEmail(cleanEmail);
  if (existing) {
    throw new Error("An account is already registered with this email address. Please sign in instead.");
  }

  if (!payload.fullName || payload.fullName.trim().length < 2) {
    throw new Error("Full name must be at least 2 characters.");
  }

  if (!payload.ageConfirmed) {
    throw new Error("You must confirm you meet the minimum age requirement (13+ years of age).");
  }

  if (!payload.termsAccepted) {
    throw new Error("You must accept the Terms of Service and Privacy Policy to create an account.");
  }

  const strength = validatePasswordStrength(payload.password);
  if (!strength.valid) {
    throw new Error(strength.feedback[0] || "Password does not meet security requirements.");
  }

  const now = Date.now();
  const userId = `usr_${now}_${crypto.randomBytes(6).toString("hex")}`;
  const passwordHash = hashPassword(payload.password);
  const verificationToken = crypto.randomBytes(32).toString("hex");

  const newUser: UserRecord = {
    id: userId,
    email: cleanEmail,
    fullName: payload.fullName.trim(),
    displayName: (payload.displayName || payload.fullName).trim(),
    passwordHash,
    emailVerified: false,
    verificationToken,
    verificationTokenExpiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    ageConfirmed: true,
    termsAcceptedVersion: "v1.0-2026",
    termsAcceptedAt: now,
    marketingConsent: Boolean(payload.marketingConsent),
    authProvider: "local",
  };

  return runInTransaction(() => {
    db.prepare(`
      INSERT INTO users (
        id, email, full_name, display_name, password_hash, email_verified,
        verification_token, verification_expires_at, age_confirmed,
        terms_version, terms_accepted_at, marketing_consent, auth_provider,
        created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `).run(
      newUser.id,
      newUser.email,
      newUser.fullName,
      newUser.displayName,
      newUser.passwordHash,
      0,
      newUser.verificationToken,
      newUser.verificationTokenExpiresAt,
      1,
      newUser.termsAcceptedVersion,
      newUser.termsAcceptedAt,
      newUser.marketingConsent ? 1 : 0,
      newUser.authProvider,
      newUser.createdAt,
      newUser.updatedAt,
      newUser.lastLoginAt
    );

    // Initialize free subscription and 0 credits in SQLite
    db.prepare(`
      INSERT OR IGNORE INTO subscriptions (user_id, plan, status, payment_provider, verified_at)
      VALUES (?, 'free', 'none', 'none', ?);
    `).run(newUser.id, new Date().toISOString());

    db.prepare(`
      INSERT OR IGNORE INTO user_credits (user_id, balance, updated_at)
      VALUES (?, 0, ?);
    `).run(newUser.id, now);

    const session = createSession(userId);
    return { user: sanitizeUser(newUser), session };
  });
}

// Local Sign-In
export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: UserProfile; session: SessionRecord }> {
  const cleanEmail = email.toLowerCase().trim();
  const user = getUserByEmail(cleanEmail);

  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password. Please verify your credentials and try again.");
  }

  const isMatch = verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    throw new Error("Invalid email or password. Please verify your credentials and try again.");
  }

  const now = Date.now();
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?;").run(now, user.id);
  user.lastLoginAt = now;

  const session = createSession(user.id, ipAddress, userAgent);
  return { user: sanitizeUser(user), session };
}

// Google OAuth Sign-In or Registration
export async function authenticateWithGoogle(payload: {
  googleId: string;
  email: string;
  fullName: string;
  profilePhotoUrl?: string;
  emailVerified?: boolean;
}): Promise<{ user: UserProfile; session: SessionRecord; isNewUser: boolean }> {
  const cleanEmail = payload.email.toLowerCase().trim();
  let user = getUserByEmail(cleanEmail);
  const now = Date.now();
  let isNewUser = false;

  return runInTransaction(() => {
    if (user) {
      const newProvider = user.authProvider === "local" ? "both" : user.authProvider;
      db.prepare(`
        UPDATE users
        SET google_id = ?, email_verified = 1, profile_photo_url = COALESCE(profile_photo_url, ?),
            auth_provider = ?, last_login_at = ?, updated_at = ?
        WHERE id = ?;
      `).run(payload.googleId, payload.profilePhotoUrl || null, newProvider, now, now, user.id);

      user = getUserById(user.id)!;
    } else {
      isNewUser = true;
      const userId = `usr_${now}_${crypto.randomBytes(6).toString("hex")}`;
      db.prepare(`
        INSERT INTO users (
          id, email, full_name, display_name, password_hash, email_verified,
          age_confirmed, terms_version, terms_accepted_at, marketing_consent,
          profile_photo_url, google_id, auth_provider, created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, NULL, 1, 1, 'v1.0-2026', ?, 0, ?, ?, 'google', ?, ?, ?);
      `).run(
        userId,
        cleanEmail,
        payload.fullName.trim() || "Google User",
        payload.fullName.trim() || "Google User",
        now,
        payload.profilePhotoUrl || null,
        payload.googleId,
        now,
        now,
        now
      );

      // Initialize default subscriptions & credits
      db.prepare(`
        INSERT OR IGNORE INTO subscriptions (user_id, plan, status, payment_provider, verified_at)
        VALUES (?, 'free', 'none', 'none', ?);
      `).run(userId, new Date().toISOString());

      db.prepare(`
        INSERT OR IGNORE INTO user_credits (user_id, balance, updated_at)
        VALUES (?, 0, ?);
      `).run(userId, now);

      user = getUserById(userId)!;
    }

    const session = createSession(user.id);
    return { user: sanitizeUser(user), session, isNewUser };
  });
}

// Email Verification
export function verifyUserEmail(token: string): { success: boolean; user?: UserProfile; error?: string } {
  if (!token || typeof token !== "string") {
    return { success: false, error: "Verification token is missing or malformed." };
  }

  const now = Date.now();
  const row = db.prepare(`
    SELECT * FROM users WHERE verification_token = ?;
  `).get(token.trim()) as any;

  if (!row) {
    return { success: false, error: "Invalid or already used email verification link." };
  }

  if (row.verification_expires_at && row.verification_expires_at < now) {
    return { success: false, error: "This email verification link has expired. Please request a new verification link." };
  }

  db.prepare(`
    UPDATE users
    SET email_verified = 1, verification_token = NULL, verification_expires_at = NULL, updated_at = ?
    WHERE id = ?;
  `).run(now, row.id);

  const updated = getUserById(row.id)!;
  return { success: true, user: sanitizeUser(updated) };
}

// Resend Email Verification Token
export function resendVerificationToken(email: string): { success: boolean; token?: string } {
  const cleanEmail = email.toLowerCase().trim();
  const user = getUserByEmail(cleanEmail);

  if (!user || user.emailVerified) {
    return { success: true };
  }

  const now = Date.now();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = now + 24 * 60 * 60 * 1000;

  db.prepare(`
    UPDATE users
    SET verification_token = ?, verification_expires_at = ?, updated_at = ?
    WHERE id = ?;
  `).run(token, expiresAt, now, user.id);

  return { success: true, token };
}

// Request Password Reset
export function requestPasswordReset(email: string): { success: boolean; resetToken?: string } {
  const cleanEmail = email.toLowerCase().trim();
  const user = getUserByEmail(cleanEmail);

  if (!user) {
    return { success: true };
  }

  const now = Date.now();
  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = now + 60 * 60 * 1000; // 1 hour

  db.prepare(`
    UPDATE users
    SET reset_token = ?, reset_expires_at = ?, updated_at = ?
    WHERE id = ?;
  `).run(resetToken, expiresAt, now, user.id);

  return { success: true, resetToken };
}

// Reset Password with Token
export function resetPasswordWithToken(
  token: string,
  newPassword: string
): { success: boolean; error?: string } {
  if (!token || typeof token !== "string") {
    return { success: false, error: "Password reset token is missing or malformed." };
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return { success: false, error: strength.feedback[0] || "Password does not meet security requirements." };
  }

  const now = Date.now();
  const row = db.prepare("SELECT * FROM users WHERE reset_token = ?;").get(token.trim()) as any;

  if (!row) {
    return { success: false, error: "Invalid or already used password reset token." };
  }

  if (row.reset_expires_at && row.reset_expires_at < now) {
    return { success: false, error: "This password reset link has expired. Please submit a new reset request." };
  }

  const newHash = hashPassword(newPassword);
  const newProvider = row.auth_provider === "google" ? "both" : row.auth_provider;

  runInTransaction(() => {
    db.prepare(`
      UPDATE users
      SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL, auth_provider = ?, updated_at = ?
      WHERE id = ?;
    `).run(newHash, newProvider, now, row.id);

    revokeAllUserSessions(row.id);
  });

  return { success: true };
}

// Change Password for Logged-In User
export function changePassword(
  userId: string,
  currentPassword: string | undefined,
  newPassword: string
): { success: boolean; error?: string } {
  const user = getUserById(userId);
  if (!user) {
    return { success: false, error: "User account not found." };
  }

  if (user.passwordHash) {
    if (!currentPassword) {
      return { success: false, error: "Current password is required to set a new password." };
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return { success: false, error: "Current password is incorrect." };
    }
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return { success: false, error: strength.feedback[0] || "Password does not meet security requirements." };
  }

  const newHash = hashPassword(newPassword);
  const newProvider = user.authProvider === "google" ? "both" : user.authProvider;
  const now = Date.now();

  db.prepare(`
    UPDATE users
    SET password_hash = ?, auth_provider = ?, updated_at = ?
    WHERE id = ?;
  `).run(newHash, newProvider, now, userId);

  return { success: true };
}

// Update User Profile
export function updateUserProfile(
  userId: string,
  updates: {
    fullName?: string;
    displayName?: string;
    profilePhotoUrl?: string | null;
    region?: string | null;
    marketingConsent?: boolean;
  }
): { success: boolean; user?: UserProfile; error?: string } {
  const user = getUserById(userId);
  if (!user) {
    return { success: false, error: "User not found." };
  }

  if (typeof updates.fullName === "string" && updates.fullName.trim().length < 2) {
    return { success: false, error: "Full name must be at least 2 characters." };
  }

  const now = Date.now();
  const newFullName = updates.fullName?.trim() ?? user.fullName;
  const newDisplayName = updates.displayName?.trim() ?? user.displayName;
  const newPhoto = updates.profilePhotoUrl !== undefined ? updates.profilePhotoUrl : user.profilePhotoUrl;
  const newRegion = updates.region !== undefined ? updates.region : user.region;
  const newMarketing = updates.marketingConsent !== undefined ? (updates.marketingConsent ? 1 : 0) : (user.marketingConsent ? 1 : 0);

  db.prepare(`
    UPDATE users
    SET full_name = ?, display_name = ?, profile_photo_url = ?, region = ?, marketing_consent = ?, updated_at = ?
    WHERE id = ?;
  `).run(newFullName, newDisplayName, newPhoto, newRegion, newMarketing, now, userId);

  const updated = getUserById(userId)!;
  return { success: true, user: sanitizeUser(updated) };
}

// Permanently Delete User Account (and cascade all personal data)
export function deleteUserAccount(
  userId: string,
  verification: { password?: string; confirmPhrase?: string }
): { success: boolean; error?: string } {
  const user = getUserById(userId);
  if (!user) {
    return { success: false, error: "User not found." };
  }

  // Re-authentication check
  if (user.passwordHash) {
    if (!verification.password) {
      return { success: false, error: "Password confirmation is required to delete your account." };
    }
    if (!verifyPassword(verification.password, user.passwordHash)) {
      return { success: false, error: "Incorrect password. Account deletion aborted." };
    }
  } else {
    if (verification.confirmPhrase !== "DELETE MY ACCOUNT") {
      return { success: false, error: "Please type 'DELETE MY ACCOUNT' to confirm account deletion." };
    }
  }

  // Execute deletion within a single transaction.
  // Foreign keys configured with ON DELETE CASCADE will purge sessions, workspaces, documents, chunks, notes, chats, subscriptions, credits, and audit records.
  runInTransaction(() => {
    db.prepare("DELETE FROM users WHERE id = ?;").run(userId);
  });

  return { success: true };
}
