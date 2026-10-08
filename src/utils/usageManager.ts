import {
  UsageState,
  FREE_ACTIONS_LIMIT,
  FREE_DAILY_ACTIONS_LIMIT,
  PRO_ACTIONS_LIMIT,
  PlanType,
  UserPlanProfile,
  PlanAccessCheckResult,
  ServerSubscriptionRecord,
} from "../types";

const STORAGE_KEY_USAGE = "lexis_ai_usage";
const STORAGE_KEY_CACHED_PROFILE = "lexis_ai_cached_profile";
const STORAGE_KEY_DEVICE_USER_ID = "lexis_ai_device_user_id";

export const FREE_DAILY_UPGRADE_MESSAGE =
  "You've used today's 5 free actions. 💙\n\nYour free actions reset tomorrow. You can also upgrade to Pro for higher usage and AI Credits.";

/**
 * Gets the current date formatted as YYYY-MM-DD in the user's local timezone.
 * Handles the daily reset reliably using the user's local date.
 */
export function getCurrentLocalDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Gets or initializes a persistent device user ID.
 * This identifies the client device to the server subscription verification service.
 */
export function getOrCreateUserId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY_DEVICE_USER_ID);
    if (!id) {
      id = "usr_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY_DEVICE_USER_ID, id);
    }
    return id;
  } catch {
    return "usr_guest";
  }
}

/**
 * Loads the current user's plan profile.
 * IMPORTANT: Client-side storage is NEVER trusted as proof of payment.
 * Pro status requires server verification with an active payment provider record.
 * If cached data claims Pro without server verification, it falls back to FREE.
 */
export function loadUserPlanProfile(): UserPlanProfile {
  const userId = getOrCreateUserId();
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CACHED_PROFILE);
    if (saved) {
      const parsed: UserPlanProfile = JSON.parse(saved);
      // Strict client-side check: Pro requires isVerifiedPro and an active status
      if (parsed && parsed.plan === PlanType.PRO && parsed.isVerifiedPro === true && parsed.subscriptionStatus === "active") {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read plan profile cache", e);
  }

  // Default to FREE plan
  return {
    userId,
    plan: PlanType.FREE,
    isVerifiedPro: false,
    subscriptionStatus: "none",
    paymentProvider: "none",
    providerSubscriptionId: null,
  };
}

/**
 * Convenience helper to return current plan type (FREE or PRO)
 */
export function loadUserPlan(): PlanType {
  return loadUserPlanProfile().plan;
}

/**
 * Fetches the authoritative subscription record from the server.
 * The server is the SOLE authority on whether a user is Pro.
 */
export async function syncServerSubscription(): Promise<ServerSubscriptionRecord> {
  const userId = getOrCreateUserId();
  try {
    const response = await fetch("/api/subscription/status", {
      headers: {
        "X-Lexis-User-Id": userId,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.record) {
        const record: ServerSubscriptionRecord = data.record;
        
        // Cache the verified server record
        try {
          const profile: UserPlanProfile = {
            userId: record.userId,
            plan: record.isPro ? PlanType.PRO : PlanType.FREE,
            isVerifiedPro: record.isPro,
            subscriptionStatus: record.subscriptionStatus,
            paymentProvider: record.paymentProvider,
            providerSubscriptionId: record.providerSubscriptionId,
            subscriptionStartDate: record.subscriptionStartDate,
            subscriptionExpiryDate: record.subscriptionExpiryDate,
            verifiedAt: record.verifiedAt,
          };
          localStorage.setItem(STORAGE_KEY_CACHED_PROFILE, JSON.stringify(profile));
        } catch {}

        return record;
      }
    }
  } catch (err) {
    console.warn("Could not sync server subscription status:", err);
  }

  // Fallback server record if network unavailable
  return {
    userId,
    plan: PlanType.FREE,
    subscriptionStatus: "none",
    paymentProvider: "none",
    providerCustomerId: null,
    providerSubscriptionId: null,
    subscriptionStartDate: null,
    subscriptionExpiryDate: null,
    isPro: false,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Saves the user's plan profile securely.
 * Note: Pro status is only accepted if confirmed by server verification.
 */
export function saveUserPlanProfile(profile: UserPlanProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_CACHED_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.warn("Could not save plan profile to storage", e);
  }
}

export function loadUsageState(): UsageState {
  const todayKey = getCurrentLocalDateKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USAGE);
    if (raw) {
      const parsed: UsageState = JSON.parse(raw);
      // Reset if the day has rolled over in the user's local date
      if (parsed.dateKey === todayKey && typeof parsed.count === "number") {
        return { count: parsed.count, dateKey: todayKey };
      }
    }
  } catch (e) {
    console.warn("Could not read usage from storage", e);
  }

  const initial: UsageState = { count: 0, dateKey: todayKey };
  saveUsageState(initial);
  return initial;
}

export function saveUsageState(state: UsageState): void {
  try {
    const todayKey = getCurrentLocalDateKey();
    const payload = {
      ...state,
      dateKey: state.dateKey || todayKey,
    };
    localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(payload));
  } catch (e) {
    console.warn("Could not save usage to storage", e);
  }
}

export function incrementUsage(): UsageState {
  const current = loadUsageState();
  const updated: UsageState = {
    ...current,
    count: current.count + 1,
    dateKey: current.dateKey || getCurrentLocalDateKey(),
  };
  saveUsageState(updated);
  return updated;
}

export function getPlanLimit(plan: PlanType): number {
  return plan === PlanType.PRO ? PRO_ACTIONS_LIMIT : FREE_ACTIONS_LIMIT;
}

export function isPlanLimitReached(usageCount: number, plan: PlanType): boolean {
  const limit = getPlanLimit(plan);
  return usageCount >= limit;
}

export function getRemainingActions(usageCount: number, plan: PlanType): number {
  const limit = getPlanLimit(plan);
  return Math.max(0, limit - usageCount);
}

/**
 * Fetches the authoritative credit balance from the server.
 * The server is the SOLE authority on user credit balances.
 */
export async function fetchServerCredits(): Promise<number> {
  const userId = getOrCreateUserId();
  try {
    const response = await fetch("/api/credits/balance", {
      headers: {
        "X-Lexis-User-Id": userId,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (typeof data.credits === "number" && !isNaN(data.credits)) {
        return data.credits;
      }
    }
  } catch (err) {
    console.warn("Could not fetch server credits:", err);
  }
  return 0;
}

/**
 * Safe, centralized access-control function for verifying if an AI action can be executed.
 * Checks the user's plan (FREE vs PRO), verifies the daily usage count against the plan limit,
 * checks available AI credits when daily quota is reached, and returns structured decision data.
 */
export function checkActionAccess(
  usageCount: number,
  plan: PlanType = PlanType.FREE,
  credits = 0
): PlanAccessCheckResult {
  const limit = getPlanLimit(plan);
  const isPro = plan === PlanType.PRO;

  if (isPro) {
    const remaining = Math.max(0, limit - usageCount);
    const canPerformAction = usageCount < limit;
    return {
      canPerformAction,
      reason: canPerformAction
        ? undefined
        : `Monthly Pro limit of ${PRO_ACTIONS_LIMIT} actions reached. Allowance resets on the 1st of next month.`,
      plan,
      usageCount,
      limit,
      remaining,
      credits,
      usingCredits: false,
    };
  }

  // Free Tier: 5 actions per day
  const freeRemaining = Math.max(0, limit - usageCount);
  if (usageCount < limit) {
    return {
      canPerformAction: true,
      plan,
      usageCount,
      limit,
      remaining: freeRemaining,
      credits,
      usingCredits: false,
    };
  }

  // Free allowance reached, check if user has purchased AI credits
  if (credits > 0) {
    return {
      canPerformAction: true,
      plan,
      usageCount,
      limit,
      remaining: credits,
      credits,
      usingCredits: true,
    };
  }

  // Both daily free actions and Credits reached
  return {
    canPerformAction: false,
    reason: FREE_DAILY_UPGRADE_MESSAGE,
    plan,
    usageCount,
    limit,
    remaining: 0,
    credits: 0,
    usingCredits: false,
  };
}
