export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";
export type EntitlementFeature = "storage" | "communications" | "advanced_reports";

export interface NormalizedBillingEvent {
  provider: string;
  id: string;
  customer: string;
  subscription: string;
  plan: "core" | "plus";
  status: SubscriptionStatus;
  occurredAt: number;
  trialEndsAt: string | null;
  periodEndsAt: string | null;
}

export interface BillingProvider {
  name: string;
  verifyAndNormalize: (body: string, signature: string, nowSeconds: number) => NormalizedBillingEvent | null;
}
