import {
  PlanType,
  SubscriptionStatus,
  PaymentProvider,
  ServerSubscriptionRecord,
  CREDIT_PACKAGES,
} from "../src/types";
import { activateProSubscriptionFromPayment, verifyServerSubscription } from "./subscriptionService";
import { addCredits, getUserCredits } from "./creditService";

/**
 * Paystack Transaction Initialization and Verification Service
 * Operates strictly server-side using PAYSTACK_SECRET_KEY (never exposed to client).
 */

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export interface InitializePaystackOptions {
  userId: string;
  email: string;
  amountInKobo?: number; // Lowest currency unit (100000 cents for 1000 KES)
  currency?: string;
  channels?: string[];
  callbackUrl?: string;
  metadata?: Record<string, any>;
  paymentType?: "subscription" | "credits";
  packageId?: string;
}

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    id: number;
    status: string; // "success", "failed", "abandoned"
    reference: string;
    amount: number;
    currency: string;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    ip_address: string;
    customer: {
      id: number;
      customer_code: string;
      email: string;
    };
    metadata?: Record<string, any>;
  };
}

/**
 * Helper to get the Paystack Secret Key safely.
 * Returns null if not configured in environment.
 * Operates strictly server-side using PAYSTACK_SECRET_KEY.
 */
export function getPaystackSecretKey(): string | null {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (secretKey && secretKey.trim().length > 0) {
    return secretKey.trim();
  }
  return null;
}

/**
 * Helper to get the Paystack Public Key for frontend initialization.
 * CRITICAL SECURITY: Strictly ensures only Live public keys (pk_live_...) are ever returned to the client.
 * Never returns a secret key (sk_...).
 */
export function getPaystackPublicKey(): string | null {
  const key = process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY;
  if (key && key.trim().startsWith("pk_live_")) {
    return key.trim();
  }
  return null;
}

/**
 * Helper to get the configured currency.
 * Defaults strictly to "KES" (Kenyan Shillings).
 */
export function getPaystackConfiguredCurrency(): string {
  return "KES";
}

/**
 * Initializes a transaction with Paystack API.
 * Calls POST https://api.paystack.co/transaction/initialize
 */
export async function initializePaystackTransaction(
  options: InitializePaystackOptions
): Promise<{
  success: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference: string;
  publicKey?: string;
  currency?: string;
  paymentType?: "subscription" | "credits";
  error?: string;
}> {
  const secretKey = getPaystackSecretKey();
  const publicKey = getPaystackPublicKey();

  const isCredits = options.paymentType === "credits";
  const selectedPackage = isCredits
    ? CREDIT_PACKAGES.find((p) => p.id === options.packageId) || CREDIT_PACKAGES[0]
    : null;

  // Generate a unique reference with timestamp and user ID
  const reference = isCredits
    ? `lexis_cred_${selectedPackage?.id || "pkg"}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    : `lexis_pro_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Determine amount in lowest currency subunits (10,000 for 100 KES, 25,000 for 250 KES, 50,000 for 500 KES, 100,000 for 1000 KES Pro)
  const amount = isCredits && selectedPackage
    ? selectedPackage.amountInKobo
    : (options.amountInKobo || 100000);
  const currencyToUse = "KES";

  if (!secretKey) {
    return {
      success: false,
      reference,
      error: "PAYSTACK_SECRET_KEY is not configured on the server. Please provide your Paystack Live Secret Key in environment variables.",
    };
  }

  try {
    const payload: Record<string, any> = {
      email: options.email,
      amount,
      reference,
      currency: currencyToUse,
      callback_url: options.callbackUrl,
      channels: ["card", "mobile_money"],
      metadata: {
        userId: options.userId,
        paymentType: isCredits ? "credits" : "subscription",
        ...(isCredits && selectedPackage
          ? {
              packageId: selectedPackage.id,
              actionsToAdd: selectedPackage.actions,
              priceKes: selectedPackage.priceKes,
            }
          : {
              plan: "pro",
            }),
        source: "lexis_ai_web",
        ...(options.metadata || {}),
      },
    };

    let res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let data: PaystackInitResponse = await res.json();

    // Fallback: If currency was included and Paystack returned "Currency not supported by merchant",
    // automatically retry without the currency field so Paystack defaults to the merchant's active currency!
    if (
      (!res.ok || !data.status) &&
      payload.currency &&
      data.message?.toLowerCase().includes("currency not supported")
    ) {
      console.warn(
        `[Paystack] Currency '${payload.currency}' is not enabled for this merchant account. Automatically retrying with merchant default currency...`
      );
      delete payload.currency;
      res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      data = await res.json();
    }

    if (!res.ok || !data.status || !data.data) {
      console.warn("Paystack initialize error response:", data);
      return {
        success: false,
        reference,
        error: data.message || `Paystack initialization failed with HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
      publicKey: publicKey || undefined,
      currency: "KES",
    };
  } catch (err: any) {
    console.error("Paystack initialize request failed:", err);
    return {
      success: false,
      reference,
      error: err.message || "Failed to communicate with Paystack API.",
    };
  }
}

/**
 * Verifies a transaction with Paystack API.
 * Calls GET https://api.paystack.co/transaction/verify/:reference
 *
 * CRITICAL SECURITY:
 * Pro plan is ONLY granted if:
 * 1. Paystack responds HTTP 200 with status === true.
 * 2. data.status === "success".
 * 3. data.currency === "KES" and amount === 100000 subunits.
 * 4. The transaction reference matches.
 * 5. The server activates the subscription in the authoritative store.
 */
export async function verifyPaystackTransaction(
  reference: string,
  expectedUserId?: string
): Promise<{
  success: boolean;
  paymentType?: "subscription" | "credits";
  isPro: boolean;
  record?: ServerSubscriptionRecord;
  creditsAdded?: number;
  totalCredits?: number;
  message?: string;
  error?: string;
  paystackData?: any;
}> {
  const secretKey = getPaystackSecretKey();

  if (!secretKey) {
    return {
      success: false,
      isPro: false,
      error: "PAYSTACK_SECRET_KEY is not configured on the server.",
    };
  }

  if (!reference || typeof reference !== "string") {
    return {
      success: false,
      isPro: false,
      error: "Valid transaction reference is required.",
    };
  }

  try {
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference.trim())}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    const data: PaystackVerifyResponse = await res.json();

    if (!res.ok || !data.status || !data.data) {
      console.warn("Paystack verification failed response:", data);
      return {
        success: false,
        isPro: false,
        error: data.message || `Paystack verification failed with HTTP ${res.status}`,
      };
    }

    // The provider's verified reference must be exactly the reference we requested.
    if (data.data.reference !== reference.trim()) {
      return {
        success: false,
        isPro: false,
        error: "Paystack returned a different transaction reference.",
        paystackData: data.data,
      };
    }

    // Verify transaction status is strictly "success".
    if (data.data.status !== "success") {
      return {
        success: false,
        isPro: false,
        error: `Transaction status is '${data.data.status}', not successful.`,
        paystackData: data.data,
      };
    }

    // Currency must be explicitly KES; missing currency is not accepted.
    if (!data.data.currency || data.data.currency.toUpperCase() !== "KES") {
      return {
        success: false,
        isPro: false,
        error: `Transaction currency is '${data.data.currency}', expected KES.`,
        paystackData: data.data,
      };
    }

    // Extract target userId from transaction metadata or fallback to caller
    const metaUserId = data.data.metadata?.userId;
    const targetUserId = metaUserId || expectedUserId;

    if (!targetUserId) {
      return {
        success: false,
        isPro: false,
        error: "Unable to associate transaction with a user account.",
        paystackData: data.data,
      };
    }

    // Determine if this is an AI Credits purchase or Pro subscription
    const isCreditPayment =
      data.data.metadata?.paymentType === "credits" ||
      reference.startsWith("lexis_cred_") ||
      Boolean(data.data.metadata?.packageId);

    if (isCreditPayment) {
      // Find package definition
      const selectedPkg =
        CREDIT_PACKAGES.find((p) => p.id === data.data.metadata?.packageId) ||
        CREDIT_PACKAGES.find((p) => p.amountInKobo === data.data.amount) ||
        CREDIT_PACKAGES.find((p) => p.amountInKobo <= data.data.amount) ||
        CREDIT_PACKAGES[0];

      if (typeof data.data.amount === "number" && data.data.amount < selectedPkg.amountInKobo) {
        return {
          success: false,
          isPro: false,
          error: `Transaction amount is '${data.data.amount}', expected ${selectedPkg.amountInKobo} KES subunits for ${selectedPkg.actions} actions.`,
          paystackData: data.data,
        };
      }

      // Add credits on the authoritative server store
      const creditRes = addCredits(targetUserId, selectedPkg.actions, data.data.reference);
      const currentSub = verifyServerSubscription(targetUserId);

      console.log(
        `[Paystack Success] Added ${selectedPkg.actions} AI credits for user '${targetUserId}'. Total credits: ${creditRes.newBalance}`
      );

      return {
        success: true,
        paymentType: "credits",
        isPro: currentSub.isPro,
        record: currentSub,
        creditsAdded: selectedPkg.actions,
        totalCredits: creditRes.newBalance,
        message: `Payment verified! ${selectedPkg.actions} AI credits have been added to your account.`,
        paystackData: {
          id: data.data.id,
          reference: data.data.reference,
          amount: data.data.amount,
          currency: data.data.currency,
          paidAt: data.data.paid_at,
          customer: data.data.customer,
        },
      };
    }

    // Pro subscription: Verify amount is at least 100,000 KES subunits (KSh 1,000)
    if (typeof data.data.amount === "number" && data.data.amount < 100000) {
      return {
        success: false,
        isPro: false,
        error: `Transaction amount is '${data.data.amount}', expected 100000 KES subunits for Pro subscription.`,
        paystackData: data.data,
      };
    }

    // Persist the verified transaction and subscription atomically. A repeated
    // verification returns the existing state and never moves the expiry date.
    const customerCode = data.data.customer?.customer_code || String(data.data.customer?.id || "paystack_cust");
    const activation = activateProSubscriptionFromPayment(targetUserId, {
      paymentProvider: "paystack",
      providerCustomerId: customerCode,
      providerSubscriptionId: data.data.reference,
      durationDays: 30,
      transactionReference: data.data.reference,
      amount: data.data.amount,
      currency: data.data.currency,
    });
    const record = activation.record;

    console.log(`[Paystack Success] ${activation.alreadyProcessed ? "Payment already processed" : "Activated Pro subscription"} for user '${targetUserId}' via reference '${reference}'`);

    return {
      success: true,
      paymentType: "subscription",
      isPro: Boolean(record.isPro),
      record,
      message: activation.alreadyProcessed
        ? "This payment was already processed. No additional subscription time was added."
        : "Payment verified successfully! Welcome to LexisAi Pro.",
      paystackData: {
        id: data.data.id,
        reference: data.data.reference,
        amount: data.data.amount,
        currency: data.data.currency,
        paidAt: data.data.paid_at,
        customer: data.data.customer,
      },
    };
  } catch (err: any) {
    console.error("Paystack verification exception:", err);
    return {
      success: false,
      isPro: false,
      error: err.message || "Failed to communicate with Paystack API for verification.",
    };
  }
}
