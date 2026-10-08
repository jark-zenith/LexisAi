import { getOrCreateUserId, syncServerSubscription } from "./usageManager";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref?: string;
        metadata?: Record<string, any>;
        callback: (response: { reference: string; status?: string }) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

export interface PaystackConfig {
  publicKey: string | null;
  hasSecretKey: boolean;
  isConfigured: boolean;
  mode: string;
  amount: number;
  currency: string;
  planName: string;
}

/**
 * Fetches Paystack public configuration from the secure backend.
 * Never exposes the secret key.
 */
export async function fetchPaystackConfig(): Promise<PaystackConfig> {
  const envKey = (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string) || "";
  const clientSafeKey = envKey.startsWith("pk_live_") ? envKey : null;

  try {
    const res = await fetch("/api/paystack/config");
    if (res.ok) {
      const data = await res.json();
      const serverKey =
        data.publicKey &&
        typeof data.publicKey === "string" &&
        data.publicKey.startsWith("pk_live_")
          ? data.publicKey
          : null;

      return {
        publicKey: serverKey || clientSafeKey,
        hasSecretKey: Boolean(data.hasSecretKey),
        isConfigured: Boolean(data.isConfigured),
        mode: data.mode || "live",
        amount: 100000,
        currency: "KES",
        planName: data.planName || "LexisAi Pro (KSh 1,000 / 30 days)",
      };
    }
  } catch (err) {
    console.warn("Could not fetch Paystack config:", err);
  }

  return {
    publicKey: clientSafeKey,
    hasSecretKey: false,
    isConfigured: false,
    mode: "live",
    amount: 100000,
    currency: "KES",
    planName: "LexisAi Pro (KSh 1,000 / 30 days)",
  };
}

/**
 * Initializes a transaction on the secure backend.
 * Receives the authoritative transaction reference from Paystack.
 */
export async function initializeTransactionOnServer(
  email: string,
  amount = 100000,
  currency = "KES",
  options?: {
    paymentType?: "subscription" | "credits";
    packageId?: string;
  }
): Promise<{
  success: boolean;
  reference?: string;
  accessCode?: string;
  authorizationUrl?: string;
  publicKey?: string;
  currency?: string;
  paymentType?: "subscription" | "credits";
  error?: string;
}> {
  const userId = getOrCreateUserId();
  const res = await fetch("/api/paystack/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lexis-User-Id": userId,
    },
    body: JSON.stringify({
      email,
      amount,
      currency: "KES",
      paymentType: options?.paymentType || "subscription",
      packageId: options?.packageId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    return {
      success: false,
      error: data.error || `Initialization failed (${res.status})`,
    };
  }

  return {
    success: true,
    reference: data.reference,
    accessCode: data.accessCode,
    authorizationUrl: data.authorizationUrl,
    publicKey: data.publicKey,
    currency: data.currency,
    paymentType: data.paymentType,
  };
}

/**
 * Calls the backend to verify the transaction with Paystack API.
 * The server is the SOLE authority that activates Pro or credits.
 */
export async function verifyTransactionOnServer(reference: string): Promise<{
  success: boolean;
  paymentType?: "subscription" | "credits";
  isPro: boolean;
  creditsAdded?: number;
  totalCredits?: number;
  message?: string;
  error?: string;
}> {
  const userId = getOrCreateUserId();
  const res = await fetch("/api/paystack/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lexis-User-Id": userId,
    },
    body: JSON.stringify({ reference }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.success) {
    return {
      success: false,
      isPro: false,
      error: data.error || "Payment verification could not be confirmed.",
    };
  }

  // Refresh server subscription profile in local cache
  await syncServerSubscription();

  return {
    success: true,
    paymentType: data.paymentType || "subscription",
    isPro: Boolean(data.isPro),
    creditsAdded: data.creditsAdded,
    totalCredits: data.totalCredits,
    message: data.message || "Payment verified successfully!",
  };
}
