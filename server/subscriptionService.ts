import {
  PlanType,
  SubscriptionStatus,
  PaymentProvider,
  ServerSubscriptionRecord,
  FREE_ACTIONS_LIMIT,
  PRO_ACTIONS_LIMIT,
} from "../src/types";
import { getUserCredits } from "./creditService";


/**
 * Server-Authoritative Subscription Store & Verification Engine.
 *
 * Security Principles:
 * 1. The server is the SOLE authority on whether a user has an active Pro subscription.
 * 2. Client-side localStorage, browser state, or cookies are NEVER trusted as proof of payment.
 * 3. Pro status requires an active, verified subscription record tied to a payment provider
 *    (such as Stripe or PayPal) with unexpired validity.
 * 4. Free users default to FREE plan with 10 monthly actions.
 */

// In-memory server subscription store (in production this maps to a PostgreSQL / Firestore database)
const subscriptionDatabase = new Map<string, ServerSubscriptionRecord>();

/**
 * Generate a consistent fallback userId or read from request headers
 */
export function resolveUserIdFromRequest(req: any): string {
  const headerUserId = req.headers["x-lexis-user-id"] || req.headers["x-user-id"];
  if (typeof headerUserId === "string" && headerUserId.trim()) {
    return headerUserId.trim();
  }
  // Fallback to client IP or default guest identity for single-user dev testing
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress;
  return ip ? `user_${Buffer.from(ip).toString("hex").slice(0, 12)}` : "guest_user";
}

/**
 * Server-authoritative check to verify whether a user has an active, valid Pro subscription.
 */
export function verifyServerSubscription(userId: string): ServerSubscriptionRecord {
  const record = subscriptionDatabase.get(userId);

  if (record) {
    // Check if subscription has expired
    if (record.subscriptionExpiryDate) {
      const expiry = new Date(record.subscriptionExpiryDate).getTime();
      const now = Date.now();
      if (now > expiry) {
        record.subscriptionStatus = "expired";
        record.isPro = false;
        record.plan = PlanType.FREE;
      }
    }

    const isPro =
      record.plan === PlanType.PRO &&
      (record.subscriptionStatus === "active" || record.subscriptionStatus === "trialing") &&
      record.paymentProvider !== "none" &&
      record.providerSubscriptionId !== null;

    return {
      ...record,
      isPro,
      plan: isPro ? PlanType.PRO : PlanType.FREE,
      verifiedAt: new Date().toISOString(),
    };
  }

  // Default server record: FREE plan, unverified, no payment provider
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
 * Server-side gatekeeper: verifies if an AI request is permitted
 * based on the server-authoritative subscription status, monthly usage count,
 * and purchased AI credits balance.
 */
export function verifyActionPermission(
  userId: string,
  clientReportedUsageCount: number
): {
  allowed: boolean;
  plan: PlanType;
  isPro: boolean;
  limit: number;
  remaining: number;
  credits: number;
  actionSource: "pro" | "free" | "credit" | "none";
  reason?: string;
  subscriptionRecord: ServerSubscriptionRecord;
} {
  const record = verifyServerSubscription(userId);
  const isPro = record.isPro;
  const plan = isPro ? PlanType.PRO : PlanType.FREE;
  const userCredits = getUserCredits(userId);

  if (isPro) {
    const limit = PRO_ACTIONS_LIMIT;
    const remaining = Math.max(0, limit - clientReportedUsageCount);
    const allowed = clientReportedUsageCount < limit;
    let reason: string | undefined = undefined;
    if (!allowed) {
      reason = `Monthly Pro limit of ${PRO_ACTIONS_LIMIT} actions reached. Allowance resets on the 1st of next month.`;
    }
    return {
      allowed,
      plan,
      isPro: true,
      limit,
      remaining,
      credits: userCredits,
      actionSource: allowed ? "pro" : "none",
      reason,
      subscriptionRecord: record,
    };
  }

  // Free Tier
  const freeLimit = FREE_ACTIONS_LIMIT;
  const freeRemaining = Math.max(0, freeLimit - clientReportedUsageCount);

  // Check if within free 10 actions/month allowance
  if (clientReportedUsageCount < freeLimit) {
    return {
      allowed: true,
      plan: PlanType.FREE,
      isPro: false,
      limit: freeLimit,
      remaining: freeRemaining,
      credits: userCredits,
      actionSource: "free",
      subscriptionRecord: record,
    };
  }

  // Free limit exhausted: check if user has purchased AI Credits available
  if (userCredits > 0) {
    return {
      allowed: true,
      plan: PlanType.FREE,
      isPro: false,
      limit: freeLimit,
      remaining: userCredits, // remaining credits
      credits: userCredits,
      actionSource: "credit",
      subscriptionRecord: record,
    };
  }

  // Both Free limit and Credits exhausted
  return {
    allowed: false,
    plan: PlanType.FREE,
    isPro: false,
    limit: freeLimit,
    remaining: 0,
    credits: 0,
    actionSource: "none",
    reason:
      "You've used today's 5 free actions. 💙\n\nYour free actions reset tomorrow. You can also upgrade to Pro for higher usage and AI Credits.",
    subscriptionRecord: record,
  };
}

/**
 * Server-side method to activate a Pro subscription upon verified real-money payment.
 * Invoked by Paystack verification service.
 */
export function activateProSubscription(
  userId: string,
  options: {
    paymentProvider: PaymentProvider;
    providerCustomerId: string;
    providerSubscriptionId: string;
    durationDays?: number;
  }
): ServerSubscriptionRecord {
  const now = new Date();
  const duration = options.durationDays || 30;
  const expiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);

  const newRecord: ServerSubscriptionRecord = {
    userId,
    plan: PlanType.PRO,
    subscriptionStatus: "active",
    paymentProvider: options.paymentProvider,
    providerCustomerId: options.providerCustomerId,
    providerSubscriptionId: options.providerSubscriptionId,
    subscriptionStartDate: now.toISOString(),
    subscriptionExpiryDate: expiry.toISOString(),
    isPro: true,
    verifiedAt: now.toISOString(),
  };

  subscriptionDatabase.set(userId, newRecord);
  return newRecord;
}
