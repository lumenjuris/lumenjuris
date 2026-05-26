export type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "PENDING";

export type BillingInterval = "month" | "year";

export type SubscriptionData = {
  status: SubscriptionStatus;
  planName: string;
  price: number;
  interval: BillingInterval;
  startAt: string;
  expiresAt: string;
};
