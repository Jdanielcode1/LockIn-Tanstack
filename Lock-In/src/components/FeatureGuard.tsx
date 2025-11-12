/**
 * Feature Guard Component
 *
 * This component demonstrates how to use Autumn to check feature access
 * and prompt users to upgrade if they don't have access.
 *
 * @example
 * ```tsx
 * <FeatureGuard featureId="advanced_analytics" upgradePlan="pro_plan">
 *   <AdvancedAnalyticsDashboard />
 * </FeatureGuard>
 * ```
 */

import { useCustomer } from "~/lib/autumn-client";
import { type ReactNode, useState } from "react";

interface FeatureGuardProps {
  /**
   * The feature ID to check access for
   */
  featureId: string;
  /**
   * The product/plan ID that provides this feature
   */
  upgradePlan?: string;
  /**
   * Custom message to show when access is denied
   */
  deniedMessage?: string;
  /**
   * Content to show when the user has access
   */
  children: ReactNode;
}

export function FeatureGuard({
  featureId,
  upgradePlan,
  deniedMessage,
  children,
}: FeatureGuardProps) {
  const { customer, checkout, isLoading } = useCustomer();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Check if user has access to the feature
  // Note: This uses client-side check - should be combined with backend verification
  const hasAccess = (customer as any)?.check?.({ featureId })?.allowed ?? false;

  const handleUpgrade = async () => {
    if (!upgradePlan) return;

    setIsCheckingOut(true);
    try {
      await checkout({
        productId: upgradePlan,
      });
    } catch (error) {
      console.error("Upgrade error:", error);
      alert("Failed to start upgrade. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-[#8b949e] text-center">
          <div className="animate-spin text-2xl mb-2">⏳</div>
          <p className="text-sm">Checking access...</p>
        </div>
      </div>
    );
  }

  // If user has access, show the content
  if (hasAccess) {
    return <>{children}</>;
  }

  // Show upgrade prompt if no access
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <h3 className="text-xl font-semibold text-white mb-2">
        Premium Feature
      </h3>
      <p className="text-[#8b949e] mb-6">
        {deniedMessage ||
          "This feature requires an upgraded subscription plan."}
      </p>
      {upgradePlan && (
        <button
          onClick={handleUpgrade}
          disabled={isCheckingOut}
          className="px-6 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCheckingOut ? "Loading..." : "Upgrade Now"}
        </button>
      )}
    </div>
  );
}

/**
 * Hook to check feature access and track usage
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { hasAccess, trackUsage } = useFeatureAccess("messages");
 *
 *   const sendMessage = async () => {
 *     if (!hasAccess) {
 *       alert("Please upgrade to send messages");
 *       return;
 *     }
 *
 *     // Send message...
 *     await trackUsage(1); // Track 1 message sent
 *   };
 * }
 * ```
 */
export function useFeatureAccess(featureId: string) {
  const { customer, track } = useCustomer();

  const hasAccess = (customer as any)?.check?.({ featureId })?.allowed ?? false;

  const trackUsage = async (value?: number) => {
    try {
      await track({
        featureId,
        value,
      });
    } catch (error) {
      console.error("Error tracking usage:", error);
    }
  };

  return {
    hasAccess,
    trackUsage,
    customer,
  };
}
