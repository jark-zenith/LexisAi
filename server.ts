import "dotenv/config";

// Security: Cleanse any accidental secret keys from client-exposed VITE_ environment variables
if (process.env.VITE_PAYSTACK_PUBLIC_KEY && process.env.VITE_PAYSTACK_PUBLIC_KEY.startsWith("sk_")) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    process.env.PAYSTACK_SECRET_KEY = process.env.VITE_PAYSTACK_PUBLIC_KEY;
  }
  delete process.env.VITE_PAYSTACK_PUBLIC_KEY;
}

if (process.env.PAYSTACK_CURRENCY && (process.env.PAYSTACK_CURRENCY.startsWith("sk_") || process.env.PAYSTACK_CURRENCY.startsWith("pk_"))) {
  process.env.PAYSTACK_CURRENCY = "KES";
}

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  verifyServerSubscription,
  verifyActionPermission,
  resolveUserIdFromRequest,
} from "./server/subscriptionService";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  getPaystackPublicKey,
  getPaystackSecretKey,
  getPaystackConfiguredCurrency,
} from "./server/paystackService";
import { getUserCredits, deductCredit } from "./server/creditService";
import { CREDIT_PACKAGES } from "./src/types";
import { buildTaskPromptAndConfig, CapabilityRequest } from "./server/taskHandlers";
import {
  getUserWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addDocumentToWorkspace,
  removeDocumentFromWorkspace,
  addNoteToWorkspace,
  updateNoteInWorkspace,
  deleteNoteFromWorkspace,
  appendChatMessageToWorkspace,
  clearWorkspaceChatHistory,
  purgeUserWorkspaces,
  claimGuestWorkspaces,
} from "./server/workspaceService";
import { purgeUserCredits } from "./server/creditService";
import { purgeUserSubscription } from "./server/subscriptionService";
import {
  registerUser,
  loginUser,
  authenticateWithGoogle,
  verifyUserEmail,
  resendVerificationToken,
  requestPasswordReset,
  resetPasswordWithToken,
  changePassword,
  updateUserProfile,
  deleteUserAccount,
  revokeSession,
  sanitizeUser,
  checkRateLimit,
} from "./server/authService";
import {
  requireAuth,
  optionalAuth,
  extractTokenFromRequest,
  resolveAuthoritativeUserId,
} from "./server/authMiddleware";


// Singleton Gemini Client
let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// In-memory cache for instant responses on identical queries
interface CacheEntry {
  data: any;
  timestamp: number;
}
const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_SIZE = 80;

function generateCacheKey(params: {
  text: string;
  action: string;
  tone?: string;
  format?: string;
  customInstruction?: string;
  generateVariations?: boolean;
}): string {
  return JSON.stringify([
    params.action,
    params.tone || "",
    params.format || "",
    params.customInstruction || "",
    Boolean(params.generateVariations),
    params.text.trim(),
  ]);
}

// Fast supported models in priority order for low latency
const MODEL_CANDIDATES = [
  "gemini-3.1-flash-lite", // Primary: sub-second generation, minimal latency
  "gemini-3.6-flash",      // Fallback 1: extremely robust, active Gemini 3 model
  "gemini-flash-latest",   // Fallback 2: fast flash alias
  "gemini-3.8-flash",      // Fallback 3: reliable Gemini 3 text model
];

// Resilient non-streaming Gemini API call
async function callGeminiWithRetry(
  ai: GoogleGenAI,
  params: {
    model?: string;
    contents: any;
    config?: any;
    abortSignal?: AbortSignal;
    mode?: string;
    userInputText?: string;
  }
) {
  const modelsToTry = Array.from(
    new Set([params.model || MODEL_CANDIDATES[0], ...MODEL_CANDIDATES])
  );

  let lastError: any = null;
  let activeConfig = { ...params.config };

  for (const modelName of modelsToTry) {
    try {
      if (params.abortSignal?.aborted) {
        throw new Error("Client cancelled request");
      }

      const controller = new AbortController();
      const timeoutMs = 35000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      if (params.abortSignal) {
        params.abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }

      const configWithThinking = {
        ...activeConfig,
        ...(modelName === "gemini-3.1-flash-lite"
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
          : modelName.startsWith("gemini-3")
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
      };

      const responsePromise = ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: configWithThinking,
      });

      const timeoutPromise = new Promise((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(new Error(params.abortSignal?.aborted ? "Client cancelled request" : `Model ${modelName} timed out after ${timeoutMs}ms`));
        });
      });

      const response = (await Promise.race([
        responsePromise,
        timeoutPromise,
      ])) as any;

      clearTimeout(timeoutId);

      if (
        response &&
        (response.text !== undefined || (response as any).candidates)
      ) {
        return { response, modelUsed: modelName, toolsDropped: false };
      }
    } catch (err: any) {
      lastError = err;
      if (params.abortSignal?.aborted) {
        throw new Error("Client cancelled request");
      }
      console.warn(
        `[Gemini API] Call to ${modelName} failed (${err?.message || err}), attempting fallback...`
      );

      // If call failed while tools (like googleSearch) were active, drop tools and retry immediately
      if (activeConfig?.tools && activeConfig.tools.length > 0) {
        console.warn(`[Gemini API] Retrying ${modelName} without external tools due to tool failure/quota restriction.`);
        delete activeConfig.tools;
        try {
          const fallbackConfig = {
            ...activeConfig,
            ...(params.mode === "research"
              ? {
                  systemInstruction: `You are an analytical assistant.
CRITICAL MANDATES:
1. Google Search grounding is unavailable.
2. DO NOT present synthesized or model-generated information as verified research, current facts, statistics, sources, or citations.
3. Clearly label this output at the very top with the exact header:
## Search unavailable — analytical draft
4. Use ONLY information already provided by the user in the prompt. Do not assume, assert, or extrapolate real-world facts, dates, market figures, statistics, studies, or empirical claims beyond what the user provided.
5. DO NOT fabricate sources, citations, dates, statistics, market data, or factual claims.
6. Provide an analytical draft, logical decomposition, or conceptual outline strictly grounded in the user's provided input. Clearly state that live search verification is unavailable.`,
                }
              : {}),
            ...(modelName === "gemini-3.1-flash-lite"
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
              : modelName.startsWith("gemini-3")
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          };

          const fallbackContents =
            params.mode === "research"
              ? `Topic / Information provided by user:
"${params.userInputText || (typeof params.contents === "string" ? params.contents : "")}"

CRITICAL INSTRUCTION:
Google Search grounding is unavailable. Do NOT present synthesized or model-generated information as verified research, current facts, statistics, sources, or citations.
Clearly label the output at the top as "Search unavailable — analytical draft" and use ONLY information already provided by the user above. Do NOT fabricate sources, dates, statistics, market data, or factual claims.`
              : params.contents;

          const fallbackRes = await ai.models.generateContent({
            model: modelName,
            contents: fallbackContents,
            config: fallbackConfig,
          });
          if (fallbackRes && (fallbackRes.text !== undefined || (fallbackRes as any).candidates)) {
            return { response: fallbackRes, modelUsed: modelName, toolsDropped: true };
          }
        } catch (retryErr: any) {
          console.warn(`[Gemini API] Retried ${modelName} without tools but also failed:`, retryErr?.message || retryErr);
        }
      }

      // Brief backoff before next model fallback to handle transient RPM rate limits
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  throw lastError;
}

// Resilient streaming Gemini API call
async function streamGeminiWithRetry(
  ai: GoogleGenAI,
  params: {
    model?: string;
    contents: any;
    config?: any;
    abortSignal?: AbortSignal;
    onChunk: (chunkText: string) => void;
  }
) {
  const modelsToTry = Array.from(
    new Set([params.model || MODEL_CANDIDATES[0], ...MODEL_CANDIDATES])
  );

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      if (params.abortSignal?.aborted) {
        throw new Error("Client cancelled request");
      }

      const configWithThinking = {
        ...params.config,
        ...(modelName === "gemini-3.1-flash-lite"
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }
          : modelName.startsWith("gemini-3")
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
      };

      const stream = await ai.models.generateContentStream({
        model: modelName,
        contents: params.contents,
        config: configWithThinking,
      });

      let fullText = "";
      let chunkCount = 0;

      for await (const chunk of stream) {
        if (params.abortSignal?.aborted) {
          throw new Error("Client cancelled request");
        }
        const text = chunk.text;
        if (text) {
          chunkCount++;
          fullText += text;
          params.onChunk(text);
        }
      }

      if (chunkCount > 0 || fullText) {
        return { fullText, modelUsed: modelName };
      }
    } catch (err: any) {
      lastError = err;
      if (params.abortSignal?.aborted) {
        throw new Error("Client cancelled request");
      }
      console.warn(
        `[Gemini API Stream] Stream on ${modelName} failed (${err?.message || err}), attempting fallback...`
      );
    }
  }

  throw lastError;
}

// Clean potential markdown wrapping around JSON output
function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/i, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

// Formats error messages safely so raw JSON ApiErrors don't leak into the UI
function extractReadableErrorMessage(error: any): string {
  if (!error) return "An unexpected error occurred while processing text.";
  const rawMsg = error.message || String(error);

  try {
    // If message is a JSON string from ApiError
    if (rawMsg.startsWith("{") && rawMsg.endsWith("}")) {
      const parsed = JSON.parse(rawMsg);
      if (parsed.error?.message) {
        if (parsed.error.code === 503 || parsed.error.status === "UNAVAILABLE") {
          return "The AI service is experiencing a brief high-demand spike. Please click Process again in a few moments.";
        }
        if (
          parsed.error.code === 429 ||
          parsed.error.status === "RESOURCE_EXHAUSTED" ||
          parsed.error.message.includes("quota") ||
          parsed.error.message.includes("rate-limit")
        ) {
          return "The AI service is experiencing high demand or rate limits. Please wait a moment and try again.";
        }
        return parsed.error.message;
      }
    }
  } catch {
    // Not valid JSON, continue with regex checks
  }

  if (rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) {
    return "The AI service is currently experiencing high demand. Please try again in a few seconds.";
  }

  if (rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("quota")) {
    return "The AI service is currently rate-limited. Please wait a moment and try again.";
  }

  return rawMsg;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // CORS middleware for iframe and cross-origin compatibility
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept, X-Lexis-User-Id, X-Usage-Count"
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: "10mb" }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json({
      status: "ok",
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      model: MODEL_CANDIDATES[0],
    });
  });

  // -------------------------------------------------------------
  // AUTHENTICATION & USER ACCOUNT API ROUTES (Production-Secured)
  // -------------------------------------------------------------

  // Register with Email & Password
  app.post("/api/auth/register", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const clientIp = req.ip || "unknown_ip";
      const rateCheck = checkRateLimit(`reg_${clientIp}`, 15, 60 * 60 * 1000);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: `Too many registration attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
        });
      }

      const { email, password, fullName, displayName, ageConfirmed, termsAccepted, marketingConsent } = req.body || {};

      const result = await registerUser({
        email,
        password,
        fullName,
        displayName,
        ageConfirmed: Boolean(ageConfirmed),
        termsAccepted: Boolean(termsAccepted),
        marketingConsent: Boolean(marketingConsent),
      });

      res.setHeader(
        "Set-Cookie",
        `lexis_session=${encodeURIComponent(result.session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
      );

      return res.status(201).json({
        success: true,
        user: result.user,
        token: result.session.token,
        message: "Account created successfully. A verification email has been generated.",
      });
    } catch (err: any) {
      console.warn("[Auth API] Registration rejected:", err?.message || err);
      return res.status(400).json({
        success: false,
        error: err.message || "Unable to complete registration. Please check your inputs.",
      });
    }
  });

  // Sign In with Email & Password
  app.post("/api/auth/login", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { email = "", password = "" } = req.body || {};
      const clientIp = req.ip || "unknown_ip";
      const rateCheck = checkRateLimit(`login_${clientIp}_${email.toLowerCase().trim()}`, 8, 15 * 60 * 1000);

      if (!rateCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: `Too many login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        });
      }

      const result = await loginUser(
        email,
        password,
        req.ip,
        req.get("user-agent")
      );

      res.setHeader(
        "Set-Cookie",
        `lexis_session=${encodeURIComponent(result.session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
      );

      return res.json({
        success: true,
        user: result.user,
        token: result.session.token,
        message: "Signed in successfully.",
      });
    } catch (err: any) {
      console.warn("[Auth API] Sign-in failed:", err?.message || err);
      return res.status(401).json({
        success: false,
        error: err.message || "Invalid credentials. Please verify your email and password.",
      });
    }
  });

  // Google OAuth Sign-In & Registration
  app.post("/api/auth/google", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { credential, googleId: directGoogleId, email: directEmail, fullName: directName, profilePhotoUrl: directPhoto } = req.body || {};

      let resolvedGoogleId = directGoogleId;
      let resolvedEmail = directEmail;
      let resolvedName = directName;
      let resolvedPhoto = directPhoto;

      // If official Google ID token was provided from Google Identity Services
      if (credential && typeof credential === "string") {
        try {
          const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
          if (verifyRes.ok) {
            const tokenData = await verifyRes.json();
            if (tokenData && tokenData.sub && tokenData.email) {
              resolvedGoogleId = tokenData.sub;
              resolvedEmail = tokenData.email;
              resolvedName = tokenData.name || tokenData.given_name || "Google User";
              resolvedPhoto = tokenData.picture || null;
            }
          }
        } catch (fetchErr) {
          console.warn("[Google OAuth] Remote token verification warning:", fetchErr);
        }
      }

      if (!resolvedEmail || !resolvedGoogleId) {
        return res.status(400).json({
          success: false,
          error: "Google authentication payload is invalid or could not be verified.",
        });
      }

      const result = await authenticateWithGoogle({
        googleId: resolvedGoogleId,
        email: resolvedEmail,
        fullName: resolvedName || "Google User",
        profilePhotoUrl: resolvedPhoto,
        emailVerified: true,
      });

      res.setHeader(
        "Set-Cookie",
        `lexis_session=${encodeURIComponent(result.session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
      );

      return res.json({
        success: true,
        user: result.user,
        token: result.session.token,
        isNewUser: result.isNewUser,
        message: result.isNewUser ? "Welcome to LexisAi! Account created with Google." : "Welcome back!",
      });
    } catch (err: any) {
      console.error("[Google OAuth] Authentication error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to authenticate with Google.",
      });
    }
  });

  // Sign Out
  app.post("/api/auth/logout", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const token = extractTokenFromRequest(req);
      if (token) {
        revokeSession(token);
      }
      res.setHeader(
        "Set-Cookie",
        "lexis_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
      );
      return res.json({ success: true, message: "Signed out successfully." });
    } catch (err: any) {
      return res.json({ success: true });
    }
  });

  // Get Current Authenticated Profile
  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    return res.json({
      success: true,
      user: sanitizeUser(req.user),
    });
  });

  // Update Profile
  app.patch("/api/auth/profile", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const result = updateUserProfile(req.userId!, req.body || {});
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({ success: true, user: result.user, message: "Profile updated successfully." });
    } catch (err: any) {
      console.error("[Auth API] Profile update error:", err);
      return res.status(500).json({ success: false, error: "Failed to update profile." });
    }
  });

  // Change Password
  app.post("/api/auth/change-password", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { currentPassword, newPassword } = req.body || {};
      const result = changePassword(req.userId!, currentPassword, newPassword);
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({ success: true, message: "Password updated successfully." });
    } catch (err: any) {
      console.error("[Auth API] Change password error:", err);
      return res.status(500).json({ success: false, error: "Failed to update password." });
    }
  });

  // Email Verification
  app.post("/api/auth/verify-email", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { token } = req.body || {};
      const result = verifyUserEmail(token);
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({ success: true, user: result.user, message: "Email successfully verified!" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "Failed to verify email." });
    }
  });

  // Resend Email Verification Token
  app.post("/api/auth/resend-verification", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { email = "" } = req.body || {};
      const clientIp = req.ip || "unknown_ip";
      const rateCheck = checkRateLimit(`resend_${clientIp}_${email.toLowerCase().trim()}`, 3, 60 * 60 * 1000);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: `Please wait ${rateCheck.retryAfterSeconds} seconds before requesting another verification email.`,
        });
      }

      const result = resendVerificationToken(email);
      return res.json({
        success: true,
        message: "If an account exists with this email, a new verification link has been generated.",
        // For development / testing in sandbox preview:
        debugToken: process.env.NODE_ENV !== "production" ? result.token : undefined,
      });
    } catch (err: any) {
      return res.json({ success: true, message: "If an account exists, a link has been sent." });
    }
  });

  // Forgot Password (Request Reset)
  app.post("/api/auth/forgot-password", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { email = "" } = req.body || {};
      const clientIp = req.ip || "unknown_ip";
      const rateCheck = checkRateLimit(`forgot_${clientIp}_${email.toLowerCase().trim()}`, 4, 60 * 60 * 1000);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: `Please wait ${rateCheck.retryAfterSeconds} seconds before submitting another request.`,
        });
      }

      const result = requestPasswordReset(email);
      // Anti-enumeration: always return generic positive response
      return res.json({
        success: true,
        message: "If an account exists with this email, password reset instructions have been generated.",
        debugToken: process.env.NODE_ENV !== "production" ? result.resetToken : undefined,
      });
    } catch (err: any) {
      return res.json({
        success: true,
        message: "If an account exists with this email, password reset instructions have been generated.",
      });
    }
  });

  // Reset Password with Token
  app.post("/api/auth/reset-password", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { token, newPassword } = req.body || {};
      const result = resetPasswordWithToken(token, newPassword);
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      return res.json({
        success: true,
        message: "Your password has been reset successfully. Please sign in with your new password.",
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "Failed to reset password." });
    }
  });

  // Safely Claim Guest Workspaces to Authenticated Account
  app.post("/api/auth/claim-workspaces", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { guestId } = req.body || {};
      if (!guestId || typeof guestId !== "string") {
        return res.status(400).json({ success: false, error: "Guest identifier required." });
      }
      const migrated = claimGuestWorkspaces(guestId.trim(), req.userId!);
      return res.json({ success: true, migratedCount: migrated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "Failed to link guest workspaces." });
    }
  });

  // Delete User Account (Permanent cascade deletion)
  app.delete("/api/auth/account", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const result = deleteUserAccount(userId, req.body || {});
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      // Cascade personal data deletion
      purgeUserWorkspaces(userId);
      purgeUserCredits(userId);
      purgeUserSubscription(userId);

      res.setHeader(
        "Set-Cookie",
        "lexis_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
      );

      return res.json({
        success: true,
        message: "Your account, workspaces, documents, notes, chats, and personal data have been permanently deleted.",
      });
    } catch (err: any) {
      console.error("[Auth API] Account deletion error:", err);
      return res.status(500).json({ success: false, error: "Failed to complete account deletion." });
    }
  });

  // Server-authoritative subscription verification endpoint
  // The server is the SOLE authority for whether a user is Pro and their credit balance.
  app.get("/api/subscription/status", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = resolveUserIdFromRequest(req);
      const record = verifyServerSubscription(userId);
      const credits = getUserCredits(userId);
      return res.json({
        success: true,
        record,
        credits,
      });
    } catch (err: any) {
      console.error("Subscription status error:", err);
      return res.status(500).json({
        success: false,
        error: "Unable to verify subscription status.",
      });
    }
  });

  // Server-authoritative AI Credits balance endpoint
  app.get("/api/credits/balance", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = resolveUserIdFromRequest(req);
      const credits = getUserCredits(userId);
      return res.json({
        success: true,
        credits,
      });
    } catch (err: any) {
      console.error("Credits balance error:", err);
      return res.status(500).json({
        success: false,
        error: "Unable to verify credits balance.",
      });
    }
  });

  // Paystack Configuration Endpoint
  // Exposes Paystack Live Public Key safely to frontend.
  // NEVER exposes PAYSTACK_SECRET_KEY.
  app.get("/api/paystack/config", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const publicKey = getPaystackPublicKey();
    const hasSecretKey = Boolean(getPaystackSecretKey());
    const configuredCurrency = getPaystackConfiguredCurrency();
    return res.json({
      success: true,
      publicKey: publicKey || null,
      hasSecretKey,
      isConfigured: Boolean(hasSecretKey),
      mode: "live",
      amount: 100000, // 1,000 KES in cents (100,000)
      currency: configuredCurrency || "KES",
      planName: "LexisAi Pro (KSh 1,000 / 30 days)",
      creditPackages: CREDIT_PACKAGES,
    });
  });

  // Paystack Transaction Initialize Endpoint
  // Calls Paystack official /transaction/initialize securely using PAYSTACK_SECRET_KEY
  app.post("/api/paystack/initialize", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { email, amount, currency, paymentType = "subscription", packageId } = req.body || {};
      const userId = resolveUserIdFromRequest(req);

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({
          success: false,
          error: "A valid email address is required to initialize payment.",
        });
      }

      const host = req.get("host") || "localhost:3000";
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
      const callbackUrl = `${protocol}://${host}/?payment_ref={reference}`;

      const isCredits = paymentType === "credits";
      const initResult = await initializePaystackTransaction({
        userId,
        email: email.trim().toLowerCase(),
        paymentType: isCredits ? "credits" : "subscription",
        packageId,
        amountInKobo: amount,
        currency: "KES",
        callbackUrl,
        metadata: {
          clientIp: req.ip,
          userAgent: req.get("user-agent"),
        },
      });

      if (!initResult.success) {
        return res.status(400).json({
          success: false,
          error: initResult.error || "Failed to initialize Paystack transaction.",
          reference: initResult.reference,
        });
      }

      return res.json({
        success: true,
        reference: initResult.reference,
        accessCode: initResult.accessCode,
        authorizationUrl: initResult.authorizationUrl,
        publicKey: initResult.publicKey || getPaystackPublicKey(),
        currency: initResult.currency || "KES",
        paymentType: isCredits ? "credits" : "subscription",
      });
    } catch (err: any) {
      console.error("Paystack initialize endpoint error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Internal server error initializing transaction.",
      });
    }
  });

  // Paystack Transaction Verify Endpoint
  // Calls Paystack official GET /transaction/verify/:reference using PAYSTACK_SECRET_KEY
  // Credits are only credited, or Pro is only granted, after server-side verification with Paystack
  app.post("/api/paystack/verify", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { reference } = req.body || {};
      const userId = resolveUserIdFromRequest(req);

      if (!reference || typeof reference !== "string") {
        return res.status(400).json({
          success: false,
          error: "Transaction reference is required for verification.",
        });
      }

      const verifyResult = await verifyPaystackTransaction(reference.trim(), userId);

      if (!verifyResult.success) {
        return res.status(400).json({
          success: false,
          isPro: false,
          error: verifyResult.error || "Payment verification failed. Transaction could not be confirmed.",
        });
      }

      return res.json({
        success: true,
        paymentType: verifyResult.paymentType || "subscription",
        isPro: Boolean(verifyResult.isPro),
        creditsAdded: verifyResult.creditsAdded,
        totalCredits: verifyResult.totalCredits,
        message: verifyResult.message || "Payment verified successfully!",
        record: verifyResult.record,
        details: verifyResult.paystackData,
      });
    } catch (err: any) {
      console.error("Paystack verify endpoint error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Internal server error verifying transaction.",
      });
    }
  });

  // Text transformation API endpoint (with SSE streaming support and in-memory cache)
  app.post("/api/transform", async (req, res) => {
    try {
      const {
        text = "",
        action = "rewrite",
        tone,
        format = "general",
        customInstruction = "",
        generateVariations = false,
        stream = false,
        usageCount = 0,
        requestId = "",
        mode = "transform",
        writingContext,
        documentOptions,
        researchOptions,
        studyOptions,
        jobOptions,
        workflowOptions,
        assetPayload,
      } = req.body;

      if (!text && action !== "generate" && mode === "transform" && !assetPayload?.base64Data && !assetPayload?.textSnippet) {
        return res.status(400).json({ error: "Input text or document is required." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured in the server environment.",
        });
      }

      // Server-authoritative plan, usage, and credits gatekeeper
      const userId = resolveUserIdFromRequest(req);
      const parsedUsage = typeof usageCount === "number" ? usageCount : 0;
      const permission = verifyActionPermission(userId, parsedUsage);

      if (!permission.allowed) {
        return res.status(403).json({
          error: permission.reason || "Monthly action limit reached.",
          limitReached: true,
          plan: permission.plan,
          limit: permission.limit,
          remaining: permission.remaining,
          credits: permission.credits,
          actionSource: permission.actionSource,
        });
      }

      const handleActionCompletion = () => {
        let creditsRemaining = permission.credits;
        if (permission.actionSource === "credit") {
          const deductRes = deductCredit(userId, requestId);
          creditsRemaining = deductRes.remainingCredits;
        } else {
          creditsRemaining = getUserCredits(userId);
        }
        return {
          creditsRemaining,
          actionSource: permission.actionSource,
        };
      };

      const ai = getAI();

      // Build modular task prompt and configuration
      const prepared = buildTaskPromptAndConfig({
        mode,
        text,
        action,
        tone,
        format,
        customInstruction,
        writingContext,
        documentOptions,
        researchOptions,
        studyOptions,
        jobOptions,
        workflowOptions,
        assetPayload,
      });

      // Grounding / Web search and multimodal cannot stream with SSE in the same format
      const hasTools = Boolean(prepared.tools && prepared.tools.length > 0);
      const isMultimodal = Boolean(prepared.isMultimodal);
      const clientWantsStream =
        (stream === true || req.headers.accept?.includes("text/event-stream")) &&
        !generateVariations &&
        !hasTools &&
        !isMultimodal &&
        mode !== "research";

      // 1. Check in-memory cache for zero-latency repeats
      const cacheKey = JSON.stringify([
        mode,
        action,
        tone || "",
        format || "",
        customInstruction || "",
        Boolean(generateVariations),
        documentOptions || "",
        researchOptions || "",
        studyOptions || "",
        jobOptions || "",
        workflowOptions || "",
        (text || "").trim(),
      ]);

      const cachedEntry = queryCache.get(cacheKey);
      if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
        const completion = handleActionCompletion();
        const payloadWithCredits = {
          ...cachedEntry.data,
          elapsedMs: 8,
          cached: true,
          creditsRemaining: completion.creditsRemaining,
          actionSource: completion.actionSource,
        };

        if (clientWantsStream) {
          res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache, no-transform");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders?.();

          const content = cachedEntry.data.primaryResult || "";
          res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
          res.write(
            `data: ${JSON.stringify({
              done: true,
              ...payloadWithCredits,
            })}\n\n`
          );
          return res.end();
        }
        return res.json(payloadWithCredits);
      }

      // 2. Multi-variation generation (JSON format)
      if (generateVariations && !isMultimodal) {
        res.setHeader("Content-Type", "application/json");
        const multiPrompt = `${typeof prepared.contents === "string" ? prepared.contents : text}

Please provide 3 distinctly crafted variations of this output:
1. Option 1: Balanced & Natural (clean, clear, well-rounded)
2. Option 2: Direct & Crisp (concise, high-impact, punchy)
3. Option 3: Polished & Expressive (elevated vocabulary, persuasive or warm)

Format the output strictly as a JSON object with this shape:
{
  "variations": [
    { "title": "Balanced & Natural", "content": "..." },
    { "title": "Direct & Crisp", "content": "..." },
    { "title": "Polished & Expressive", "content": "..." }
  ],
  "summaryNotes": "1-sentence note highlighting the key improvement made."
}`;

        const startTime = Date.now();
        const { response, modelUsed } = await callGeminiWithRetry(ai, {
          model: prepared.model || MODEL_CANDIDATES[0],
          contents: multiPrompt,
          config: {
            systemInstruction: prepared.systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.7,
            tools: prepared.tools,
          },
        });

        const elapsedMs = Date.now() - startTime;
        const rawText = response.text || "{}";
        const cleanedText = cleanJsonString(rawText);
        let variationsList = [{ title: "Result", content: rawText }];
        let summaryNotes = prepared.notes || "";

        try {
          const parsed = JSON.parse(cleanedText);
          if (Array.isArray(parsed.variations) && parsed.variations.length > 0) {
            variationsList = parsed.variations;
          }
          if (parsed.summaryNotes) {
            summaryNotes = parsed.summaryNotes;
          }
        } catch {
          // fallback to raw text
        }

        const completion = handleActionCompletion();
        const responsePayload = {
          success: true,
          variations: variationsList,
          summaryNotes,
          primaryResult: variationsList[0]?.content || rawText,
          elapsedMs,
          modelUsed,
          creditsRemaining: completion.creditsRemaining,
          actionSource: completion.actionSource,
        };

        if (queryCache.size >= MAX_CACHE_SIZE) {
          const oldest = queryCache.keys().next().value;
          if (oldest) queryCache.delete(oldest);
        }
        queryCache.set(cacheKey, { data: responsePayload, timestamp: Date.now() });

        return res.json(responsePayload);
      }

      // 3. Streaming single-output generation (when supported)
      if (clientWantsStream) {
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders?.();

        const clientAbort = new AbortController();
        res.on("close", () => {
          if (!res.writableEnded) {
            clientAbort.abort();
          }
        });

        const startTime = Date.now();
        try {
          const streamResult = await streamGeminiWithRetry(ai, {
            model: prepared.model || MODEL_CANDIDATES[0],
            contents: prepared.contents,
            config: {
              systemInstruction: prepared.systemInstruction,
              temperature: 0.7,
            },
            abortSignal: clientAbort.signal,
            onChunk: (chunkText) => {
              if (!clientAbort.signal.aborted) {
                res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
              }
            },
          });

          const elapsedMs = Date.now() - startTime;
          const trimmedResult = streamResult.fullText.trim();
          const completion = handleActionCompletion();
          const finalPayload = {
            success: true,
            primaryResult: trimmedResult,
            variations: [{ title: "Primary Result", content: trimmedResult }],
            elapsedMs,
            modelUsed: streamResult.modelUsed,
            creditsRemaining: completion.creditsRemaining,
            actionSource: completion.actionSource,
            summaryNotes: prepared.notes,
          };

          if (queryCache.size >= MAX_CACHE_SIZE) {
            const oldest = queryCache.keys().next().value;
            if (oldest) queryCache.delete(oldest);
          }
          queryCache.set(cacheKey, { data: finalPayload, timestamp: Date.now() });

          res.write(
            `data: ${JSON.stringify({
              done: true,
              ...finalPayload,
            })}\n\n`
          );
          return res.end();
        } catch (streamErr: any) {
          if (clientAbort.signal.aborted) {
            return res.end();
          }
          console.error("Stream generation error:", streamErr);
          const friendlyMessage = extractReadableErrorMessage(streamErr);
          res.write(`data: ${JSON.stringify({ error: friendlyMessage })}\n\n`);
          return res.end();
        }
      } else {
        // 4. Standard Non-streaming generation (handles Multimodal, Grounding with Sources, etc.)
        res.setHeader("Content-Type", "application/json");
        const startTime = Date.now();
        const { response, modelUsed, toolsDropped } = await callGeminiWithRetry(ai, {
          model: prepared.model || MODEL_CANDIDATES[0],
          contents: prepared.contents,
          config: {
            systemInstruction: prepared.systemInstruction,
            temperature: 0.7,
            tools: prepared.tools,
          },
          mode,
          userInputText: researchOptions?.topic || text || "",
        });

        const elapsedMs = Date.now() - startTime;
        let resultText = response.text?.trim() || "";

        // Extract Google Search Grounding Metadata / Citations if available
        let sources: Array<{ title: string; uri: string }> = [];
        try {
          const candidate = response.candidates?.[0];
          const chunks = candidate?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            for (const chunk of chunks) {
              if (chunk.web?.uri) {
                sources.push({
                  title: chunk.web.title || chunk.web.uri,
                  uri: chunk.web.uri,
                });
              }
            }
          }
        } catch (sourceErr) {
          console.warn("Could not extract grounding metadata:", sourceErr);
        }

        const isSearchUnavailableInResearch =
          mode === "research" &&
          (toolsDropped || !prepared.tools || prepared.tools.length === 0 || sources.length === 0);

        let summaryNotes = prepared.notes;

        if (isSearchUnavailableInResearch) {
          // In Research Mode, if Google Search grounding is unavailable:
          // 1. Never present synthesized or model-generated information as verified research, sources or citations
          sources = [];

          // 2. Clearly label it as "Search unavailable — analytical draft"
          const hasDraftLabel =
            resultText.toLowerCase().includes("search unavailable — analytical draft") ||
            resultText.toLowerCase().includes("search unavailable - analytical draft");

          if (!hasDraftLabel) {
            resultText = `## Search unavailable — analytical draft\n\n> **Notice:** Google Search grounding is unavailable. This output is an analytical draft based only on information provided by the user. Synthesized or model-generated information is not presented as verified research, current facts, statistics, or citations, and no external sources have been fabricated.\n\n${resultText}`;
          }

          summaryNotes = "Search unavailable — analytical draft";
        } else if (toolsDropped) {
          summaryNotes = summaryNotes
            ? `${summaryNotes} (Search grounding unavailable on key; synthesized analytically)`
            : "Search grounding unavailable on key; synthesized analytically.";
        }

        const completion = handleActionCompletion();
        const finalPayload = {
          success: true,
          primaryResult: resultText,
          variations: [{ title: isSearchUnavailableInResearch ? "Analytical Draft" : "Primary Result", content: resultText }],
          elapsedMs,
          modelUsed,
          creditsRemaining: completion.creditsRemaining,
          actionSource: completion.actionSource,
          sources: sources.length > 0 ? sources : undefined,
          summaryNotes,
        };

        if (queryCache.size >= MAX_CACHE_SIZE) {
          const oldest = queryCache.keys().next().value;
          if (oldest) queryCache.delete(oldest);
        }
        queryCache.set(cacheKey, { data: finalPayload, timestamp: Date.now() });

        return res.json(finalPayload);
      }
    } catch (error: any) {
      console.error("AI Transform Error:", error);
      const friendlyMessage = extractReadableErrorMessage(error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: friendlyMessage })}\n\n`);
        return res.end();
      }
      return res.status(500).json({
        success: false,
        error: friendlyMessage,
      });
    }
  });

  // User feedback endpoint
  app.post("/api/feedback", (req, res) => {
    try {
      const { rating, feedback, comment, timestamp } = req.body || {};
      const userText = feedback || comment || "";
      console.log(`[LexisAi Feedback] Rating: ${rating}/5 | Feedback: ${userText || "(No comment)"} | Timestamp: ${timestamp || new Date().toISOString()}`);
      return res.json({
        success: true,
        message: "Thank you for your feedback!",
      });
    } catch (err) {
      console.warn("Feedback handling error:", err);
      return res.json({ success: true });
    }
  });

  // Asset text extraction / OCR endpoint using Gemini multimodal capabilities
  app.post("/api/extract-asset", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const {
        imageBase64: rawImg64,
        base64Data: rawBase64,
        mimeType = "image/jpeg",
        fileName,
        prompt,
      } = req.body || {};

      const imageBase64 = rawImg64 || rawBase64;

      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured in the server environment.",
        });
      }

      const ai = getAI();
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

      const extractionPrompt = prompt || 
        "Carefully transcribe and extract all text, handwriting, labels, or written information found in this image. " +
        "Preserve original formatting, line breaks, bullet points, and structure as faithfully as possible. " +
        "If there is no text in the image, describe the content and subjects of the image clearly in 2-3 concise sentences so the user can use it for text generation tasks. " +
        "Output ONLY the extracted content with no conversational introductions, meta-chat, or explanations.";

      const startTime = Date.now();
      const { response, modelUsed } = await callGeminiWithRetry(ai, {
        model: MODEL_CANDIDATES[0],
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || "image/jpeg",
            },
          },
          {
            text: extractionPrompt,
          },
        ],
        config: {
          systemInstruction: "You are an accurate OCR and image content transcription specialist. Extract text cleanly and precisely with no preamble.",
          temperature: 0.2,
        },
      });

      const extractedText = response.text?.trim() || "";

      return res.json({
        success: true,
        extractedText,
        fileName: fileName || "asset",
        elapsedMs: Date.now() - startTime,
        modelUsed,
      });
    } catch (err: any) {
      console.error("Asset extraction error:", err);
      const friendlyMessage = extractReadableErrorMessage(err);
      return res.status(500).json({
        error: friendlyMessage,
      });
    }
  });

  // -------------------------------------------------------------
  // LEXIS WORKSPACE API ROUTES (Secure, User-Isolated, Grounded)
  // -------------------------------------------------------------

  // List all workspaces for the authenticated user
  app.get("/api/workspaces", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const workspaces = getUserWorkspaces(userId);
      return res.json({ success: true, workspaces });
    } catch (err: any) {
      console.error("List workspaces error:", err);
      return res.status(500).json({ success: false, error: "Failed to load workspaces." });
    }
  });

  // Create a new workspace
  app.post("/api/workspaces", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const { name, description } = req.body || {};
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, error: "Workspace name is required." });
      }
      const workspace = createWorkspace(userId, { name, description });
      return res.json({ success: true, workspace });
    } catch (err: any) {
      console.error("Create workspace error:", err);
      return res.status(500).json({ success: false, error: "Failed to create workspace." });
    }
  });

  // Get single workspace with documents, notes, and chat history
  app.get("/api/workspaces/:id", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const workspace = getWorkspace(userId, req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, error: "Workspace not found or unauthorized access." });
      }
      return res.json({ success: true, workspace });
    } catch (err: any) {
      console.error("Get workspace error:", err);
      return res.status(500).json({ success: false, error: "Failed to load workspace." });
    }
  });

  // Rename or update workspace description
  app.patch("/api/workspaces/:id", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const { name, description } = req.body || {};
      const workspace = updateWorkspace(userId, req.params.id, { name, description });
      if (!workspace) {
        return res.status(404).json({ success: false, error: "Workspace not found or unauthorized access." });
      }
      return res.json({ success: true, workspace });
    } catch (err: any) {
      console.error("Update workspace error:", err);
      return res.status(500).json({ success: false, error: "Failed to update workspace." });
    }
  });

  // Delete workspace
  app.delete("/api/workspaces/:id", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const deleted = deleteWorkspace(userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Workspace not found or unauthorized access." });
      }
      return res.json({ success: true, message: "Workspace deleted successfully." });
    } catch (err: any) {
      console.error("Delete workspace error:", err);
      return res.status(500).json({ success: false, error: "Failed to delete workspace." });
    }
  });

  // Upload and process document in workspace
  app.post("/api/workspaces/:id/documents", requireAuth, async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const workspace = getWorkspace(userId, req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, error: "Workspace not found or unauthorized access." });
      }

      const { name, size = 0, type = "text/plain", text, base64Data } = req.body || {};

      if (!name || typeof name !== "string") {
        return res.status(400).json({ success: false, error: "Document name is required." });
      }

      let extractedText = "";
      let status: "ready" | "error" | "unreadable" = "ready";
      let errorMessage: string | undefined;

      // 1. Direct text available (from text/markdown/csv/json/code)
      if (typeof text === "string" && text.trim().length > 0) {
        extractedText = text.trim();
        status = "ready";
      } else if (base64Data && typeof base64Data === "string") {
        // 2. Multimodal OCR or PDF extraction using Gemini
        const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
        const isPdf = type.includes("pdf") || name.toLowerCase().endsWith(".pdf");
        const isImage = type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name);

        if (isPdf || isImage) {
          try {
            const ai = getAI();
            const extractionPrompt = isPdf
              ? "Transcribe and extract the full written text, section headings, bullet points, tables, and structural content from this PDF document as accurately and completely as possible. Do not invent missing parts. Preserve structure and wording faithfully."
              : "Transcribe all written text, handwriting, and notes found in this document/image. Preserve original formatting, line breaks, and structure faithfully. If there is no legible text, state clearly that no text was detected.";

            const mime = isPdf ? "application/pdf" : (type.startsWith("image/") ? type : "image/jpeg");
            const { response } = await callGeminiWithRetry(ai, {
              model: MODEL_CANDIDATES[0],
              contents: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: mime,
                  },
                },
                { text: extractionPrompt },
              ],
              config: {
                systemInstruction: "You are an accurate, strict document text extraction and OCR engine. Output only the extracted textual content without meta-introductions.",
                temperature: 0.1,
              },
            });

            const aiText = response.text?.trim() || "";
            if (aiText && !aiText.toLowerCase().includes("no text was detected")) {
              extractedText = aiText;
              status = "ready";
            } else {
              status = "unreadable";
              errorMessage = "No readable text or characters could be detected in this document.";
            }
          } catch (extractErr: any) {
            console.warn("AI extraction warning for document:", extractErr);
            status = "unreadable";
            errorMessage = extractReadableErrorMessage(extractErr) || "Failed to parse document text.";
          }
        } else {
          status = "unreadable";
          errorMessage = "Unsupported binary file format for text extraction.";
        }
      } else {
        status = "unreadable";
        errorMessage = "Document appears to be empty or contains no readable text content.";
      }

      // Never silently treat an unreadable document as successfully processed
      const result = addDocumentToWorkspace(userId, req.params.id, {
        name,
        size: Number(size) || 0,
        type,
        extractedText,
        status,
        errorMessage,
      });

      if (!result) {
        return res.status(500).json({ success: false, error: "Failed to store document in workspace." });
      }

      return res.json({
        success: true,
        document: result.document,
        workspace: result.workspace,
      });
    } catch (err: any) {
      console.error("Upload document error:", err);
      return res.status(500).json({
        success: false,
        error: extractReadableErrorMessage(err) || "Failed to upload document.",
      });
    }
  });

  // Remove document from workspace
  app.delete("/api/workspaces/:id/documents/:docId", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const workspace = removeDocumentFromWorkspace(userId, req.params.id, req.params.docId);
      if (!workspace) {
        return res.status(404).json({ success: false, error: "Document or workspace not found." });
      }
      return res.json({ success: true, workspace });
    } catch (err: any) {
      console.error("Remove document error:", err);
      return res.status(500).json({ success: false, error: "Failed to remove document." });
    }
  });

  // Create note in workspace
  app.post("/api/workspaces/:id/notes", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const { title, content } = req.body || {};
      const result = addNoteToWorkspace(userId, req.params.id, {
        title: title || "Untitled Note",
        content: content || "",
      });
      if (!result) {
        return res.status(404).json({ success: false, error: "Workspace not found or unauthorized access." });
      }
      return res.json({ success: true, note: result.note, workspace: result.workspace });
    } catch (err: any) {
      console.error("Add note error:", err);
      return res.status(500).json({ success: false, error: "Failed to add note." });
    }
  });

  // Update note in workspace
  app.patch("/api/workspaces/:id/notes/:noteId", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const { title, content } = req.body || {};
      const result = updateNoteInWorkspace(userId, req.params.id, req.params.noteId, { title, content });
      if (!result) {
        return res.status(404).json({ success: false, error: "Note or workspace not found." });
      }
      return res.json({ success: true, note: result.note, workspace: result.workspace });
    } catch (err: any) {
      console.error("Update note error:", err);
      return res.status(500).json({ success: false, error: "Failed to update note." });
    }
  });

  // Delete note in workspace
  app.delete("/api/workspaces/:id/notes/:noteId", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const workspace = deleteNoteFromWorkspace(userId, req.params.id, req.params.noteId);
      if (!workspace) {
        return res.status(404).json({ success: false, error: "Note or workspace not found." });
      }
      return res.json({ success: true, workspace });
    } catch (err: any) {
      console.error("Delete note error:", err);
      return res.status(500).json({ success: false, error: "Failed to delete note." });
    }
  });

  // Clear chat history in workspace
  app.post("/api/workspaces/:id/chat/clear", requireAuth, (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const workspace = clearWorkspaceChatHistory(userId, req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, error: "Workspace not found." });
      }
      return res.json({ success: true, workspace });
    } catch (err: any) {
      console.error("Clear chat error:", err);
      return res.status(500).json({ success: false, error: "Failed to clear chat." });
    }
  });

  // Grounded Workspace AI Chat & Quick Actions
  app.post("/api/workspaces/:id/chat", requireAuth, async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const userId = req.userId!;
      const workspace = getWorkspace(userId, req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, error: "Workspace not found or unauthorized access." });
      }

      const {
        prompt = "",
        action = "",
        selectedDocumentIds,
        selectedNoteIds,
        usageCount = 0,
        requestId = "",
      } = req.body || {};

      if (!prompt.trim() && !action) {
        return res.status(400).json({ success: false, error: "A question, instruction, or action is required." });
      }

      // Check centralized plan and credit limits
      const parsedUsage = typeof usageCount === "number" ? usageCount : 0;
      const permission = verifyActionPermission(userId, parsedUsage);

      if (!permission.allowed) {
        return res.status(403).json({
          success: false,
          error: permission.reason || "Monthly action limit reached. Buy AI credits or upgrade to Pro.",
          limitReached: true,
          plan: permission.plan,
          limit: permission.limit,
          remaining: permission.remaining,
          credits: permission.credits,
          actionSource: permission.actionSource,
        });
      }

      // Filter context based on user selection
      const activeDocuments = workspace.documents.filter((d) => {
        if (selectedDocumentIds && Array.isArray(selectedDocumentIds)) {
          return selectedDocumentIds.includes(d.id);
        }
        return true;
      });

      const activeNotes = workspace.notes.filter((n) => {
        if (selectedNoteIds && Array.isArray(selectedNoteIds)) {
          return selectedNoteIds.includes(n.id);
        }
        return true;
      });

      // Prepare context blocks
      const docBlocks: string[] = [];
      const sourcesUsed: string[] = [];

      for (const doc of activeDocuments) {
        if (doc.status === "ready" && doc.extractedText.trim().length > 0) {
          sourcesUsed.push(doc.name);
          // Limit individual document text to 35,000 characters to stay within fast context limits
          const textSnippet = doc.extractedText.length > 35000
            ? doc.extractedText.slice(0, 35000) + "\n...[Document text truncated for length]..."
            : doc.extractedText;
          docBlocks.push(`### Document: "${doc.name}"\n${textSnippet}`);
        }
      }

      for (const note of activeNotes) {
        if (note.content.trim().length > 0) {
          sourcesUsed.push(`Note: ${note.title}`);
          docBlocks.push(`### Note: "${note.title}"\n${note.content}`);
        }
      }

      const hasWorkspaceContext = docBlocks.length > 0;
      const contextText = hasWorkspaceContext
        ? docBlocks.join("\n\n---\n\n")
        : "(No documents or notes are currently selected or available in this workspace context)";

      // Build task action directive if a specific quick action was triggered
      let actionDirective = "";
      if (action) {
        switch (action) {
          case "summarize":
            actionDirective = "Provide a comprehensive, high-level executive summary of the selected workspace materials, highlighting core findings, major takeaways, and key conclusions.";
            break;
          case "explain":
            actionDirective = "Explain the concepts and information in the selected workspace documents in clear, accessible, and structured terms.";
            break;
          case "rewrite":
            actionDirective = "Rewrite and polish the provided workspace material with refined prose, optimal flow, and professional phrasing.";
            break;
          case "improve_grammar":
            actionDirective = "Review the provided text from the workspace, correcting all grammatical, punctuation, and structural issues while preserving original meaning.";
            break;
          case "make_professional":
            actionDirective = "Rewrite the workspace content in an authoritative, polished, executive business tone suitable for stakeholders.";
            break;
          case "make_shorter":
            actionDirective = "Condense the workspace material into concise, high-impact bullet points and brief paragraphs without omitting crucial facts.";
            break;
          case "expand":
            actionDirective = "Elaborate on the topics presented in the workspace documents with deeper explanations, context, and structural completeness based on the material.";
            break;
          case "extract_key_points":
            actionDirective = "Extract the critical key points, arguments, metrics, decisions, and dates from the selected documents in clear, prioritized bullet points.";
            break;
          case "create_outline":
            actionDirective = "Structure an organized, hierarchical outline based on the ideas, documents, and notes in this workspace.";
            break;
          case "create_report":
            actionDirective = "Synthesize the selected documents and notes into a professional, formal report with an executive summary, findings, analysis, and recommendations.";
            break;
          case "generate_questions":
            actionDirective = "Generate thoughtful, analytical questions and discussion prompts that test understanding or probe deeper into the material in this workspace.";
            break;
          default:
            actionDirective = "";
        }
      }

      const systemInstruction = `You are Lexis Workspace AI, a grounded, high-precision intelligence engine for LexisAi.
Your mission is to assist the user by analyzing, summarizing, synthesizing, transforming, and answering questions about the materials in this workspace.

CRITICAL ANTI-FABRICATION & GROUNDING RULES:
1. Prioritize workspace material: Your answers, summaries, facts, and analyses MUST prioritize the provided Workspace Documents and Notes below.
2. Anti-Fabrication & Zero Invention: If the user asks a question about their workspace, documents, or data that CANNOT be verified or supported by the provided workspace material, you MUST NOT invent or guess information.
   Instead, explicitly state:
   "I couldn't verify that from the documents in this workspace."
3. Distinguish General Knowledge: If the user asks for general definitions, standard writing templates, explanations of external terms, or if general knowledge is helpful to complement the answer, you MUST clearly identify it as general AI knowledge (e.g. prefixing or tagging it with [General Knowledge]) rather than information found in the user's workspace documents.
4. Attribution & Citations: Whenever citing specific facts, data, or arguments from the workspace, explicitly reference the source document or note (e.g., "[From: filename.ext]" or "[From Note: title]").
5. Tone: Serious, authoritative, professional, and clear.`;

      const promptParts: string[] = [];
      promptParts.push("=== WORKSPACE CONTEXT (SELECTED DOCUMENTS & NOTES) ===");
      promptParts.push(contextText);
      promptParts.push("======================================================");

      if (actionDirective) {
        promptParts.push(`\n[Action Directive]: ${actionDirective}`);
      }

      if (prompt.trim()) {
        promptParts.push(`\n[User Request / Question]:\n${prompt.trim()}`);
      } else {
        promptParts.push(`\n[User Request]: Please perform the above action directive using the workspace context.`);
      }

      const fullPrompt = promptParts.join("\n");

      const ai = getAI();
      const startTime = Date.now();
      const { response } = await callGeminiWithRetry(ai, {
        model: MODEL_CANDIDATES[0],
        contents: [{ text: fullPrompt }],
        config: {
          systemInstruction,
          temperature: 0.3, // Lower temperature for grounded factual accuracy
        },
      });

      const responseText = response.text?.trim() || "";
      if (!responseText) {
        throw new Error("AI returned an empty response. Please try again.");
      }

      const isUnverified =
        responseText.toLowerCase().includes("couldn't verify that from the documents") ||
        responseText.toLowerCase().includes("could not verify that from the documents");

      const isGeneral =
        responseText.includes("[General Knowledge]") ||
        !hasWorkspaceContext;

      // Handle credit / usage deduction ONLY on successful generation
      let creditsRemaining = permission.credits;
      if (permission.actionSource === "credit") {
        const deductRes = deductCredit(userId, requestId || `req_ws_${Date.now()}`);
        creditsRemaining = deductRes.remainingCredits;
      }

      // Record in workspace chat history
      const now = Date.now();
      const userMsg = {
        id: `msg_u_${now}`,
        role: "user" as const,
        content: prompt.trim() || actionDirective || "Workspace Action",
        timestamp: now,
      };

      const assistantMsg = {
        id: `msg_a_${now + 1}`,
        role: "assistant" as const,
        content: responseText,
        timestamp: now + 1,
        sourcesUsed: hasWorkspaceContext ? sourcesUsed : undefined,
        isGeneralKnowledge: isGeneral,
        unverifiedNotice: isUnverified,
      };

      appendChatMessageToWorkspace(userId, req.params.id, userMsg);
      const updatedWs = appendChatMessageToWorkspace(userId, req.params.id, assistantMsg);

      return res.json({
        success: true,
        message: assistantMsg,
        workspace: updatedWs,
        elapsedMs: Date.now() - startTime,
        creditsRemaining,
        actionSource: permission.actionSource,
      });
    } catch (err: any) {
      console.error("Workspace chat error:", err);
      return res.status(500).json({
        success: false,
        error: extractReadableErrorMessage(err) || "Failed to process workspace AI request.",
      });
    }
  });

  // Serve public assets (manifest, service worker, icons, favicons) with correct headers
  const publicPath = path.join(process.cwd(), "public");
  if (fs.existsSync(publicPath)) {
    // Specific route for service worker to set proper Service-Worker-Allowed scope header
    app.get("/sw.js", (req, res) => {
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Service-Worker-Allowed", "/");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(publicPath, "sw.js"));
    });

    // Specific route for manifest.json / manifest.webmanifest
    app.get(["/manifest.json", "/manifest.webmanifest"], (req, res) => {
      res.setHeader("Content-Type", "application/manifest+json");
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(publicPath, "manifest.json"));
    });

    app.use(express.static(publicPath));
  }

  // Check if we are running in production or dev mode
  const distPath = path.join(process.cwd(), "dist");
  const distIndexPath = path.join(distPath, "index.html");
  const hasDistIndex = fs.existsSync(distIndexPath);
  const isCjsBundle = typeof __filename !== "undefined" && __filename.endsWith(".cjs");
  const isRunningTsx = Boolean(process.argv[1]?.includes("tsx"));

  // Serve static dist only if running the compiled bundle or if dist/index.html is confirmed to exist
  // When running in development (via tsx or absent dist), always mount Vite middleware.
  const shouldUseStatic =
    !isRunningTsx &&
    (isCjsBundle || (process.env.NODE_ENV === "production" && hasDistIndex));

  if (!shouldUseStatic) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (viteError) {
      console.error("Vite server initialization error:", viteError);
      if (hasDistIndex) {
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
          res.sendFile(distIndexPath);
        });
      }
    }
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (fs.existsSync(distIndexPath)) {
        res.sendFile(distIndexPath, (err) => {
          if (err && !res.headersSent) {
            next(err);
          }
        });
      } else {
        res.status(503).send("Application is starting up. Please refresh shortly.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
