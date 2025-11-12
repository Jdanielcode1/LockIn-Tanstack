/**
 * Subscription Management Functions
 *
 * This module provides Convex functions for managing user subscriptions,
 * checking feature access, and tracking usage via Autumn.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { autumn } from "./autumn";
import { authComponent } from "./auth";

/**
 * Check if the current user has access to a specific feature.
 *
 * This should be called on the backend to securely verify feature access
 * before allowing the user to perform an action.
 *
 * @example
 * ```typescript
 * const access = await convex.query(api.subscriptions.checkFeatureAccess, {
 *   featureId: "advanced_analytics"
 * });
 *
 * if (access.allowed) {
 *   // User has access to the feature
 * } else {
 *   // User doesn't have access
 *   console.log(access.reason); // Why access was denied
 * }
 * ```
 */
export const checkFeatureAccess = query({
  args: {
    featureId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the user is authenticated
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return {
        allowed: false,
        reason: "User not authenticated",
      };
    }

    // Check feature access via Autumn
    const { data, error } = await autumn.check(ctx, {
      featureId: args.featureId,
    });

    if (error) {
      console.error("Error checking feature access:", error);
      return {
        allowed: false,
        reason: error.message || "Error checking access",
      };
    }

    return {
      allowed: data?.allowed ?? false,
      data,
    };
  },
});

/**
 * Track usage of a feature for billing/analytics.
 *
 * Use this to meter usage-based features or track analytics.
 * Should be called server-side to prevent tampering.
 *
 * @example
 * ```typescript
 * // Track that the user sent 5 messages
 * await convex.mutation(api.subscriptions.trackUsage, {
 *   featureId: "messages",
 *   value: 5,
 *   eventName: "messages_sent"
 * });
 * ```
 */
export const trackUsage = mutation({
  args: {
    featureId: v.string(),
    value: v.optional(v.number()),
    eventName: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the user is authenticated
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Track usage via Autumn
    const { error } = await autumn.track(ctx, {
      featureId: args.featureId,
      value: args.value,
      eventName: args.eventName,
      idempotencyKey: args.idempotencyKey,
    });

    if (error) {
      console.error("Error tracking usage:", error);
      throw new Error(error.message || "Error tracking usage");
    }

    return { success: true };
  },
});

/**
 * Get the current user's customer data including subscription info.
 *
 * @example
 * ```typescript
 * const customer = await convex.query(api.subscriptions.getCustomer, {
 *   expand: ["invoices", "products"]
 * });
 * ```
 */
export const getCustomer = query({
  args: {
    expand: v.optional(v.array(v.string())),
  },
  handler: async (ctx) => {
    // Verify the user is authenticated
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }

    // Note: Autumn customer data is typically fetched client-side
    // This is a placeholder that returns basic user info
    // For full customer data including subscriptions, use the useCustomer hook on the frontend
    return {
      id: user.userId || (user as any).id,
      email: user.email,
      name: user.name,
    };
  },
});

/**
 * Create a checkout session for a product.
 *
 * Returns a checkout URL that the user can be redirected to.
 *
 * @example
 * ```typescript
 * const result = await convex.mutation(api.subscriptions.createCheckout, {
 *   productId: "pro_plan",
 *   successUrl: "https://myapp.com/success",
 *   cancelUrl: "https://myapp.com/cancel"
 * });
 *
 * // Redirect user to result.url
 * window.location.href = result.url;
 * ```
 */
export const createCheckout = mutation({
  args: {
    productId: v.string(),
    successUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the user is authenticated
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Create checkout session via Autumn
    const { data, error } = await autumn.checkout(ctx, {
      productId: args.productId,
      successUrl: args.successUrl,
      // Note: trial configuration should be set in Autumn dashboard for the product
    });

    if (error) {
      console.error("Error creating checkout:", error);
      throw new Error(error.message || "Error creating checkout");
    }

    return data;
  },
});

/**
 * Cancel a product subscription.
 *
 * @example
 * ```typescript
 * await convex.mutation(api.subscriptions.cancelSubscription, {
 *   productId: "pro_plan",
 *   immediate: false // Cancel at end of billing period
 * });
 * ```
 */
export const cancelSubscription = mutation({
  args: {
    productId: v.string(),
    immediate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify the user is authenticated
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Note: Cancellation is typically done through the Stripe billing portal
    // or client-side with the useCustomer hook's cancel() method
    // This is a placeholder for server-side cancellation if needed
    console.log("Cancel subscription:", args.productId, args.immediate);

    return { success: true };
  },
});

/**
 * Get the billing portal URL for the current user.
 *
 * The billing portal allows users to manage their payment methods,
 * view invoices, and update subscription settings.
 *
 * @example
 * ```typescript
 * const result = await convex.mutation(api.subscriptions.getBillingPortal, {
 *   returnUrl: "https://myapp.com/settings"
 * });
 *
 * // Redirect user to the billing portal
 * window.location.href = result.url;
 * ```
 */
export const getBillingPortal = mutation({
  args: {
    returnUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the user is authenticated
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Note: Billing portal is typically accessed client-side
    // using the useCustomer hook's openBillingPortal() method
    // This is a placeholder for server-side portal generation if needed
    console.log("Get billing portal for:", user.userId || user.email, args.returnUrl);

    return { url: "#" };
  },
});

/**
 * List all available products/plans.
 *
 * @example
 * ```typescript
 * const products = await convex.query(api.subscriptions.listProducts);
 * ```
 */
export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    // Note: Product listing is typically done client-side or through the Autumn dashboard
    // This returns a placeholder. In production, you would configure products in the
    // Autumn dashboard and access them via the useCustomer hook on the frontend
    return [];
  },
});
