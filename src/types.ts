export type ToolAction =
  | "rewrite"
  | "summarize"
  | "improve"
  | "tone"
  | "generate"
  | "shorten"
  | "expand"
  | "bulletize"
  | "grammar";

export type ToneType =
  | "professional"
  | "friendly"
  | "concise"
  | "persuasive"
  | "academic"
  | "casual"
  | "confident"
  | "empathetic"
  | "witty";

export type FormatType =
  | "general"
  | "email"
  | "message"
  | "caption"
  | "cover_letter"
  | "bullets"
  | "formal_letter";

export * from "./types/capabilities";
export * from "./types/workspace";
export * from "./types/auth";

export interface Variation {
  title: string;
  content: string;
}

export interface TransformationItem {
  id: string;
  timestamp: number;
  inputText: string;
  outputText: string;
  action: ToolAction;
  tone?: ToneType;
  format?: FormatType;
  customInstruction?: string;
  variations: Variation[];
  selectedVariationIndex: number;
  notes?: string;
  elapsedMs?: number;
  sources?: Array<{ title: string; uri: string; snippet?: string }>;
  mode?: string;
  documentType?: string;
}

export interface PresetExample {
  id: string;
  title: string;
  category: string;
  action: ToolAction;
  tone?: ToneType;
  format?: FormatType;
  customInstruction?: string;
  text: string;
}

export type AssetSource = "upload" | "camera" | "photos";

export interface PickedAsset {
  id: string;
  name: string;
  size: number;
  type: string;
  source: AssetSource;
  previewUrl?: string;
  textSnippet?: string;
  base64Data?: string;
  extractedText?: string;
  isImage: boolean;
  isTextFile: boolean;
}

export enum PlanType {
  FREE = "free",
  PRO = "pro",
}

export type SubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "expired";

export type PaymentProvider = "none" | "paystack" | "stripe" | "paypal" | "custom";

/**
 * Server-authoritative subscription record.
 * Contains cryptographic or database fields required for real-money payment verification.
 */
export interface ServerSubscriptionRecord {
  userId: string;
  plan: PlanType;
  subscriptionStatus: SubscriptionStatus;
  paymentProvider: PaymentProvider;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  subscriptionStartDate: string | null; // ISO 8601 string
  subscriptionExpiryDate: string | null; // ISO 8601 string
  isPro: boolean;
  verifiedAt: string; // Server verification timestamp
}

export interface UserPlanProfile {
  userId?: string;
  plan: PlanType;
  isVerifiedPro?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  paymentProvider?: PaymentProvider;
  providerSubscriptionId?: string | null;
  subscriptionStartDate?: string | null;
  subscriptionExpiryDate?: string | null;
  verifiedAt?: string;
}

export interface UsageState {
  count: number;
  dateKey?: string; // e.g. "2026-10-06" (user's local date for daily reset)
  monthKey?: string; // backwards compatibility
}

export const FREE_DAILY_ACTIONS_LIMIT = 5;
export const FREE_ACTIONS_LIMIT = 5; // 5 free AI actions per day
export const PRO_ACTIONS_LIMIT = 500; // Substantially higher usage for Pro users (500 actions / month, no daily 5-action cap)

export interface CreditPackage {
  id: "credits_30" | "credits_100" | "credits_250";
  actions: number;
  priceKes: number;
  amountInKobo: number; // Lowest currency unit in Paystack (100 KES = 10,000 subunits)
  label: string;
  popular?: boolean;
  name?: string;
  badge?: string;
  description?: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "credits_30",
    actions: 30,
    priceKes: 100,
    amountInKobo: 10000,
    label: "30 actions — KSh 100",
    name: "Starter Pack",
    description: "Great for occasional tasks and quick touch-ups.",
  },
  {
    id: "credits_100",
    actions: 100,
    priceKes: 250,
    amountInKobo: 25000,
    label: "100 actions — KSh 250",
    popular: true,
    badge: "Best Value",
    name: "Creator Pack",
    description: "Perfect for active projects, articles, and presentations.",
  },
  {
    id: "credits_250",
    actions: 250,
    priceKes: 500,
    amountInKobo: 50000,
    label: "250 actions — KSh 500",
    badge: "Max Savings",
    name: "Power Pack",
    description: "Heavy-duty writing allowance for power creators.",
  },
];

export interface PlanAccessCheckResult {
  canPerformAction: boolean;
  reason?: string;
  plan: PlanType;
  usageCount: number;
  limit: number;
  remaining: number;
  credits: number;
  usingCredits?: boolean;
}

export * from "./types/capabilities";

