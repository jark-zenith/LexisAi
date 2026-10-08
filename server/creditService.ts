import fs from "fs";
import path from "path";

/**
 * Server-Authoritative AI Credits Storage & Management Engine
 *
 * Security & Reliability Principles:
 * 1. The server is the SOLE authority for user credit balances.
 * 2. Credits are only added after server-side verification of payment with Paystack.
 * 3. Client-side localStorage or browser dev tools can NEVER modify the balance.
 * 4. Deductions are strictly 1 credit per successful AI writing action.
 * 5. Failed, cancelled, stopped, or unsuccessful requests never deduct credits.
 * 6. Idempotency prevents double-crediting payments or double-deducting retried requests.
 * 7. Negative balances are strictly forbidden (clamped to 0).
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const CREDITS_FILE = path.join(DATA_DIR, "user_credits.json");
const PROCESSED_TXS_FILE = path.join(DATA_DIR, "processed_txs.json");
const DEDUCTED_REQUESTS_FILE = path.join(DATA_DIR, "deducted_requests.json");

// In-memory credit store backed by local disk storage
const userCreditsMap = new Map<string, number>();

// Track processed transaction references to prevent duplicate crediting on retries
const processedReferences = new Set<string>();

// Track completed request IDs to prevent duplicate deduction on retries
const processedRequestIds = new Set<string>();

// Initialize persistent directories and restore saved balances
function initStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(CREDITS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CREDITS_FILE, "utf-8"));
      if (typeof data === "object" && data !== null) {
        for (const [userId, count] of Object.entries(data)) {
          if (typeof count === "number" && !isNaN(count) && count >= 0) {
            userCreditsMap.set(userId, Math.floor(count));
          }
        }
      }
    }

    if (fs.existsSync(PROCESSED_TXS_FILE)) {
      const txs = JSON.parse(fs.readFileSync(PROCESSED_TXS_FILE, "utf-8"));
      if (Array.isArray(txs)) {
        for (const ref of txs) {
          if (typeof ref === "string") processedReferences.add(ref);
        }
      }
    }

    if (fs.existsSync(DEDUCTED_REQUESTS_FILE)) {
      const reqs = JSON.parse(fs.readFileSync(DEDUCTED_REQUESTS_FILE, "utf-8"));
      if (Array.isArray(reqs)) {
        for (const id of reqs) {
          if (typeof id === "string") processedRequestIds.add(id);
        }
      }
    }
  } catch (err) {
    console.warn("[CreditStore] Warning initializing storage:", err);
  }
}

// Persist data safely to disk
function saveCreditsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const obj: Record<string, number> = {};
    for (const [userId, count] of userCreditsMap.entries()) {
      obj[userId] = count;
    }
    fs.writeFileSync(CREDITS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("[CreditStore] Error writing credits to disk:", err);
  }
}

function saveProcessedTxsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      PROCESSED_TXS_FILE,
      JSON.stringify(Array.from(processedReferences), null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("[CreditStore] Error writing processed transactions to disk:", err);
  }
}

function saveDeductedRequestsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // Limit stored IDs to most recent 1000
    const list = Array.from(processedRequestIds).slice(-1000);
    fs.writeFileSync(DEDUCTED_REQUESTS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[CreditStore] Error writing deducted requests to disk:", err);
  }
}

// Initialize on module load
initStore();

/**
 * Returns the current authoritative credit balance for a user.
 */
export function getUserCredits(userId: string): number {
  if (!userId) return 0;
  return userCreditsMap.get(userId) || 0;
}

/**
 * Check if user has at least 1 credit available.
 */
export function hasCredits(userId: string): boolean {
  return getUserCredits(userId) > 0;
}

/**
 * Adds credits to a user upon verified real-money payment via Paystack.
 * Includes transaction reference idempotency check to prevent duplicate credits.
 */
export function addCredits(
  userId: string,
  actionsToAdd: number,
  reference?: string
): {
  success: boolean;
  newBalance: number;
  alreadyProcessed: boolean;
} {
  if (!userId || actionsToAdd <= 0) {
    return {
      success: false,
      newBalance: getUserCredits(userId),
      alreadyProcessed: false,
    };
  }

  // Idempotency check: if transaction reference was already credited, return current balance
  if (reference) {
    const cleanRef = reference.trim();
    if (processedReferences.has(cleanRef)) {
      console.log(`[CreditStore] Transaction reference '${cleanRef}' already credited. Skipping.`);
      return {
        success: true,
        newBalance: getUserCredits(userId),
        alreadyProcessed: true,
      };
    }
    processedReferences.add(cleanRef);
    saveProcessedTxsToDisk();
  }

  const current = getUserCredits(userId);
  const updated = current + Math.floor(actionsToAdd);
  userCreditsMap.set(userId, updated);
  saveCreditsToDisk();

  console.log(
    `[CreditStore] Added ${actionsToAdd} credits to user '${userId}'. Previous: ${current}, New: ${updated}. Ref: ${reference || "none"}`
  );

  return {
    success: true,
    newBalance: updated,
    alreadyProcessed: false,
  };
}

/**
 * Deducts exactly 1 credit for a successful AI writing action.
 * Only called after the action has completely succeeded.
 * Prevents negative balances and prevents double-deduction if client retried with same requestId.
 */
export function deductCredit(
  userId: string,
  requestId?: string
): {
  success: boolean;
  remainingCredits: number;
  alreadyDeducted: boolean;
} {
  if (!userId) {
    return { success: false, remainingCredits: 0, alreadyDeducted: false };
  }

  // Idempotency check on requestId
  if (requestId && requestId.trim()) {
    const cleanId = requestId.trim();
    if (processedRequestIds.has(cleanId)) {
      console.log(
        `[CreditStore] Request '${cleanId}' already deducted credit. Skipping re-deduction on retry.`
      );
      return {
        success: true,
        remainingCredits: getUserCredits(userId),
        alreadyDeducted: true,
      };
    }
  }

  const current = getUserCredits(userId);
  if (current <= 0) {
    return {
      success: false,
      remainingCredits: 0,
      alreadyDeducted: false,
    };
  }

  const updated = Math.max(0, current - 1);
  userCreditsMap.set(userId, updated);
  saveCreditsToDisk();

  if (requestId && requestId.trim()) {
    processedRequestIds.add(requestId.trim());
    saveDeductedRequestsToDisk();
  }

  console.log(
    `[CreditStore] Deducted 1 credit from user '${userId}'. Remaining: ${updated}. RequestId: ${requestId || "none"}`
  );

  return {
    success: true,
    remainingCredits: updated,
    alreadyDeducted: false,
  };
}
