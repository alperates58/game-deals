import { MembershipTier, Role, User } from "@prisma/client";

export interface UserEntitlements {
  tier: MembershipTier;
  isPro: boolean;
  isOwner: boolean;
  maxActiveAlerts: number;
  instantNotifications: boolean;
  canAccessDetailedHistory: boolean;
  canUseCustomScoreThresholds: boolean;
}

/**
 * Evaluates entitlements for a given user.
 * OWNER automatically has all privileges without requiring a payment or subscription.
 */
export function getUserEntitlements(
  user: { role: Role; membershipTier: MembershipTier } | null
): UserEntitlements {
  if (!user) {
    return {
      tier: MembershipTier.FREE,
      isPro: false,
      isOwner: false,
      maxActiveAlerts: 5,
      instantNotifications: false,
      canAccessDetailedHistory: false,
      canUseCustomScoreThresholds: false,
    };
  }

  const isOwner = user.role === Role.OWNER;
  const isPro = isOwner || user.membershipTier === MembershipTier.PRO;

  return {
    tier: user.membershipTier,
    isPro,
    isOwner,
    maxActiveAlerts: isPro ? 500 : 10,
    instantNotifications: isPro,
    canAccessDetailedHistory: isPro,
    canUseCustomScoreThresholds: isPro,
  };
}
