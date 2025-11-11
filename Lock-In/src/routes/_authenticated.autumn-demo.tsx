/**
 * Autumn Integration Demo Page
 *
 * This page demonstrates various ways to use Autumn for:
 * - Feature access control
 * - Usage tracking
 * - Subscription checks
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { api } from "../../convex/_generated/api";
import { FeatureGuard, useFeatureAccess } from "../components/FeatureGuard";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/autumn-demo")({
  component: AutumnDemoPage,
});

function AutumnDemoPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-2">
          Autumn Integration Demo
        </h1>
        <p className="text-[#8b949e] mb-8">
          Examples of using Autumn for billing and feature access
        </p>

        <div className="space-y-8">
          {/* Feature Guard Example */}
          <Section
            title="1. Feature Guard Example"
            description="Wrap premium features with FeatureGuard to require subscription"
          >
            <FeatureGuard
              featureId="advanced_analytics"
              upgradePlan="pro_plan"
              deniedMessage="Advanced analytics is available on our Pro plan."
            >
              <div className="bg-[#238636] text-white rounded-lg p-6">
                <h3 className="font-semibold mb-2">
                  🎉 Advanced Analytics Enabled
                </h3>
                <p className="text-sm">
                  You have access to this premium feature!
                </p>
              </div>
            </FeatureGuard>
          </Section>

          {/* Usage Tracking Example */}
          <Section
            title="2. Usage Tracking Example"
            description="Track feature usage for metered billing"
          >
            <UsageTrackingDemo />
          </Section>

          {/* Backend Feature Check Example */}
          <Section
            title="3. Backend Feature Check Example"
            description="Securely verify feature access on the backend"
          >
            <BackendFeatureCheckDemo />
          </Section>

          {/* Subscription Status Example */}
          <Section
            title="4. Subscription Status Example"
            description="Display user's current subscription information"
          >
            <SubscriptionStatusDemo />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-1">{title}</h2>
      <p className="text-[#8b949e] text-sm mb-4">{description}</p>
      {children}
    </div>
  );
}

function UsageTrackingDemo() {
  const { hasAccess, trackUsage } = useFeatureAccess("api_calls");
  const [calls, setCalls] = useState(0);
  const [isTracking, setIsTracking] = useState(false);

  const handleApiCall = async () => {
    setIsTracking(true);
    try {
      // Simulate an API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Track the usage (should be done server-side in production)
      await trackUsage(1);

      setCalls((prev) => prev + 1);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#0d1117] border border-[#30363d] rounded p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-[#8b949e] mb-1">API Calls Made</p>
            <p className="text-2xl font-bold text-white">{calls}</p>
          </div>
          <button
            onClick={handleApiCall}
            disabled={isTracking}
            className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isTracking ? "Tracking..." : "Make API Call"}
          </button>
        </div>
        <p className="text-xs text-[#8b949e]">
          Each click simulates an API call and tracks usage in Autumn
        </p>
      </div>
      <div className="text-xs text-[#8b949e] bg-[#0d1117] border border-[#30363d] rounded p-3">
        <p className="font-mono">
          Access: {hasAccess ? "✓ Allowed" : "✗ Denied"}
        </p>
      </div>
    </div>
  );
}

function BackendFeatureCheckDemo() {
  const [featureId, setFeatureId] = useState("premium_features");
  const [checkResult, setCheckResult] = useState<any>(null);

  const checkFeature = useMutation({
    mutationFn: async () => {
      // Use the Convex query client to check feature access
      const result = await fetch("/api/subscriptions/checkFeatureAccess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureId }),
      }).then((r) => r.json());
      return result;
    },
    onSuccess: (data) => {
      setCheckResult(data);
    },
  });

  // Alternative: Use TanStack Query with Convex
  const checkFeatureMutation = useMutation({
    mutationFn: async () => {
      // This would use your Convex query
      // For now, showing the pattern
      return { allowed: true, reason: "Demo mode" };
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={featureId}
          onChange={(e) => setFeatureId(e.target.value)}
          placeholder="Feature ID (e.g., premium_features)"
          className="flex-1 px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-white placeholder-[#6e7681]"
        />
        <button
          onClick={() => checkFeature.mutate()}
          disabled={checkFeature.isPending}
          className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {checkFeature.isPending ? "Checking..." : "Check Access"}
        </button>
      </div>

      {checkResult && (
        <div
          className={`bg-[#0d1117] border rounded p-4 ${
            checkResult.allowed
              ? "border-[#238636]"
              : "border-[#da3633]"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">
              {checkResult.allowed ? "✓" : "✗"}
            </span>
            <span className="font-semibold text-white">
              {checkResult.allowed ? "Access Granted" : "Access Denied"}
            </span>
          </div>
          {checkResult.reason && (
            <p className="text-sm text-[#8b949e]">{checkResult.reason}</p>
          )}
        </div>
      )}

      <div className="text-xs text-[#8b949e] bg-[#0d1117] border border-[#30363d] rounded p-3">
        <p className="font-mono mb-2">Backend check pattern:</p>
        <pre className="text-[#6e7681]">
          {`const access = await convex.query(
  api.subscriptions.checkFeatureAccess,
  { featureId: "${featureId}" }
);`}
        </pre>
      </div>
    </div>
  );
}

function SubscriptionStatusDemo() {
  const { data: customer } = useSuspenseQuery({
    queryKey: ["subscriptions.getCustomer", { expand: ["products"] }],
  });

  return (
    <div className="space-y-4">
      {customer ? (
        <>
          <div className="bg-[#0d1117] border border-[#30363d] rounded p-4">
            <p className="text-sm text-[#8b949e] mb-1">Customer ID</p>
            <p className="font-mono text-white">{customer.id || "N/A"}</p>
          </div>

          {customer.products && customer.products.length > 0 ? (
            <div className="bg-[#0d1117] border border-[#238636] rounded p-4">
              <p className="text-sm text-[#8b949e] mb-2">Active Products</p>
              <ul className="space-y-2">
                {customer.products.map((product: any, i: number) => (
                  <li
                    key={i}
                    className="text-white flex items-center justify-between"
                  >
                    <span>{product.name}</span>
                    <span className="text-xs text-[#238636] bg-[#0d1117] px-2 py-1 rounded">
                      {product.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-[#0d1117] border border-[#30363d] rounded p-4">
              <p className="text-[#8b949e]">No active subscriptions</p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[#0d1117] border border-[#30363d] rounded p-4">
          <p className="text-[#8b949e]">No customer data available</p>
        </div>
      )}
    </div>
  );
}
