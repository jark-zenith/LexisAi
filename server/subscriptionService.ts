import {
  PlanType,
  SubscriptionStatus,
  PaymentProvider,
  ServerSubscriptionRecord,
  FREE_DAILY_ACTIONS_LIMIT,
  PRO_ACTIONS_LIMIT,
} from "../src/types";
import { getUserCredits } from "./creditService";
import { db, runInTransaction } from "./db/database";


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

import { resolveUserFromToken } from "./authService";

/**
 * Generate a consistent fallback userId or read from request headers
 */
export function resolveUserIdFromRequest(req: any): string {
  // 1. Authoritative resolved user from requireAuth or optionalAuth
  if (req.userId && typeof req.userId === "string") {
    return req.userId;
  }
  if (req.user && typeof req.user.id === "string") {
    return req.user.id;
  }

  // 2. Extract and verify session token if present
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const verifiedUser = resolveUserFromToken(token);
    if (verifiedUser) {
      req.userId = verifiedUser.id;
      req.user = verifiedUser;
      return verifiedUser.id;
    }
  }

  const customToken = req.headers?.["x-auth-token"];
  if (typeof customToken === "string" && customToken.trim()) {
    const verifiedUser = resolveUserFromToken(customToken.trim());
    if (verifiedUser) {
      req.userId = verifiedUser.id;
      req.user = verifiedUser;
      return verifiedUser.id;
    }
  }

  // Fallback to client IP or default guest identity for public playground only
  // Never trust a caller-supplied X-Forwarded-For header directly. Express's req.ip
  // is based on socket.remoteAddress unless a trusted proxy is explicitly configured.
  const ip = typeof req.ip === "string" ? req.ip : req.socket?.remoteAddress;
  return ip ? `guest_${Buffer.from(ip).toString("hex").slice(0, 10)}` : "guest_user";
}

/**
 * Server-authoritative check to verify whether a user has an active, valid Pro subscription.
 */
function recordFromRow(row: any): ServerSubscriptionRecord {
  return {
    userId: row.user_id,
    plan: row.plan as PlanType,
    subscriptionStatus: row.status as SubscriptionStatus,
    paymentProvider: row.payment_provider as PaymentProvider,
    providerCustomerId: row.provider_customer_id ?? null,
    providerSubscriptionId: row.provider_subscription_id ?? null,
    subscriptionStartDate: row.start_date ?? null,
    subscriptionExpiryDate: row.expiry_date ?? null,
    isPro: Boolean(row.is_pro),
    verifiedAt: row.verified_at,
  };
}

function persistSubscriptionRecord(record: ServerSubscriptionRecord): void {
  db.prepare(`
    INSERT INTO subscriptions (
      user_id, plan, status, payment_provider, provider_customer_id,
      provider_subscription_id, start_date, expiry_date, is_pro, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      plan = excluded.plan,
      status = excluded.status,
      payment_provider = excluded.payment_provider,
      provider_customer_id = excluded.provider_customer_id,
      provider_subscription_id = excluded.provider_subscription_id,
      start_date = excluded.start_date,
      expiry_date = excluded.expiry_date,
      is_pro = excluded.is_pro,
      verified_at = excluded.verified_at
  `).run(
    record.userId,
    record.plan,
    record.subscriptionStatus,
    record.paymentProvider,
    record.providerCustomerId,
    record.providerSubscriptionId,
    record.subscriptionStartDate,
    record.subscriptionExpiryDate,
    record.isPro ? 1 : 0,
    record.verifiedAt
  );
}

/**
 * Server-authoritative subscription lookup backed by SQLite.
 * Subscription state survives process restarts and is shared across handlers.
 */
export function verifyServerSubscription(userId: string): ServerSubscriptionRecord {
  let row = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId) as any;

  if (!row) {
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

  if (row.expiry_date && Date.now() > new Date(row.expiry_date).getTime() &&
      (row.status === "active" || row.status === "trialing")) {
    const verifiedAt = new Date().toISOString();
    db.prepare(`
      UPDATE subscriptions
      SET status = 'expired', plan = 'free', is_pro = 0, verified_at = ?
      WHERE user_id = ?
    `).run(verifiedAt, userId);
    row = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId) as any;
  }

  const record = recordFromRow(row);
  const isPro =
    record.plan === PlanType.PRO &&
    (record.subscriptionStatus === "active" || record.subscriptionStatus === "trialing") &&
    record.paymentProvider !== "none" &&
    record.providerSubscriptionId !== null &&
    (!record.subscriptionExpiryDate || Date.now() <= new Date(record.subscriptionExpiryDate).getTime());

  return {
    ...record,
    isPro,
    plan: isPro ? PlanType.PRO : PlanType.FREE,
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
  _clientReportedUsageCount = 0
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
  usagePeriodKey?: string;
} {
  const record = verifyServerSubscription(userId);
  const isPro = record.isPro;
  const plan = isPro ? PlanType.PRO : PlanType.FREE;
  const userCredits = getUserCredits(userId);
  const now = new Date();
  const periodKey = isPro
    ? `pro:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
    : `free:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const limit = isPro ? PRO_ACTIONS_LIMIT : FREE_DAILY_ACTIONS_LIMIT;

  // Atomically reserve one server-side action. The client-reported usage value is
  // intentionally ignored; simultaneous requests cannot exceed the plan allowance.
  const reservedCount = runInTransaction(() => {
    db.prepare(`
      INSERT INTO ai_usage (user_id, period_key, usage_count, updated_at)
      VALUES (?, ?, 0, ?)
      ON CONFLICT(user_id, period_key) DO NOTHING
    `).run(userId, periodKey, Date.now());

    const updated = db.prepare(`
      UPDATE ai_usage
      SET usage_count = usage_count + 1, updated_at = ?
      WHERE user_id = ? AND period_key = ? AND usage_count < ?
      RETURNING usage_count
    `).get(Date.now(), userId, periodKey, limit) as { usage_count: number } | undefined;

    return updated ? updated.usage_count : null;
  });

  if (reservedCount !== null) {
    return {
      allowed: true,
      plan,
      isPro,
      limit,
      remaining: Math.max(0, limit - reservedCount),
      credits: userCredits,
      actionSource: isPro ? "pro" : "free",
      subscriptionRecord: record,
      usagePeriodKey: periodKey,
    };
  }

  if (!isPro && userCredits > 0) {
    return {
      allowed: true,
      plan: PlanType.FREE,
      isPro: false,
      limit,
      remaining: userCredits,
      credits: userCredits,
      actionSource: "credit",
      subscriptionRecord: record,
    };
  }

  return {
    allowed: false,
    plan,
    isPro,
    limit,
    remaining: 0,
    credits: userCredits,
    actionSource: "none",
    reason: isPro
      ? `Monthly Pro limit of ${PRO_ACTIONS_LIMIT} actions reached. Allowance resets on the 1st of next month.`
      : "You've used today's 5 free actions. Your free actions reset tomorrow. You can also upgrade to Pro or use AI Credits.",
    subscriptionRecord: record,
  };
}

/**
 * Release a reserved free/Pro action if the AI operation fails.
 */
export function releaseActionUsage(userId: string, periodKey: string): void {
  db.prepare(`
    UPDATE ai_usage
    SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END,
        updated_at = ?
    WHERE user_id = ? AND period_key = ?
  `).run(Date.now(), userId, periodKey);
}

/**
 * Server-side method to activate a Pro subscription upon verified real-money payment.
 * Invoked by Paystack verification service.
 */
function createProRecord(
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
  return {
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
}

/** Activate a Pro subscription for trusted non-Paystack flows/tests. */
export function activateProSubscription(
  userId: string,
  options: {
    paymentProvider: PaymentProvider;
    providerCustomerId: string;
    providerSubscriptionId: string;
    durationDays?: number;
  }
): ServerSubscriptionRecord {
  const record = createProRecord(userId, options);
  runInTransaction(() => persistSubscriptionRecord(record));
  return record;
}

/**
 * Atomically record a verified Paystack subscription payment and activate Pro.
 * The unique processed_transactions.reference constraint makes retries idempotent,
 * including across server restarts and concurrent verification requests.
 */
export function activateProSubscriptionFromPayment(
  userId: string,
  options: {
    paymentProvider: PaymentProvider;
    providerCustomerId: string;
    providerSubscriptionId: string;
    durationDays?: number;
    transactionReference: string;
    amount: number;
    currency: string;
  }
): { record: ServerSubscriptionRecord; alreadyProcessed: boolean } {
  const reference = options.transactionReference.trim();
  if (!reference) throw new Error("A Paystack transaction reference is required.");
  if (options.currency.toUpperCase() !== "KES" || !Number.isFinite(options.amount) || options.amount < 100000) {
    throw new Error("The Paystack payment amount or currency is invalid for a Pro subscription.");
  }

  return runInTransaction(() => {
    const existing = db.prepare(
      "SELECT user_id, payment_type FROM processed_transactions WHERE reference = ?"
    ).get(reference) as { user_id: string; payment_type: string } | undefined;

    if (existing) {
      if (existing.user_id !== userId) {
        throw new Error("This payment reference has already been used by another account.");
      }
      if (existing.payment_type !== "subscription") {
        throw new Error("This payment reference was already processed for a different payment type.");
      }
      return {
        record: verifyServerSubscription(userId),
        alreadyProcessed: true,
      };
    }

    const record = createProRecord(userId, options);
    db.prepare(`
      INSERT INTO processed_transactions (reference, user_id, payment_type, amount, currency, processed_at)
      VALUES (?, ?, 'subscription', ?, ?, ?)
    `).run(reference, userId, Math.floor(options.amount), options.currency.toUpperCase(), Date.now());
    persistSubscriptionRecord(record);

    return { record, alreadyProcessed: false };
  });
}

/**
 * Permanently purge subscription records for a deleted user
 */
export function purgeUserSubscription(userId: string): void {
  db.prepare("DELETE FROM subscriptions WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM ai_usage WHERE user_id = ?").run(userId);
}
