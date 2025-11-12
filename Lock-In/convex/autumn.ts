/**
 * Autumn Billing Integration with Convex + Better Auth
 *
 * This file initializes the Autumn client for handling subscriptions,
 * usage-based billing, and feature access control.
 */

import { Autumn } from "@useautumn/convex";
import { components } from "./_generated/api";
import { authComponent } from "./auth";

/**
 * Initialize Autumn client with Better Auth integration.
 *
 * The identify function returns the customer ID for the current user.
 * This is called on every Autumn API request to determine which customer
 * the request is for.
 */
export const autumn = new Autumn(components.autumn, {
  secretKey: process.env.AUTUMN_SECRET_KEY!,
  /**
   * Identify the customer making the request.
   *
   * For Better Auth integration, we use the user's ID from the auth session.
   * This ensures that billing is tied to the authenticated user.
   *
   * @param ctx - Convex context with auth information
   * @returns The customer ID (user ID) or null if not authenticated
   */
  identify: async (ctx: any) => {
    // Get the authenticated user from Better Auth
    const user = await authComponent.getAuthUser(ctx);

    if (!user) {
      // User is not authenticated
      return null;
    }

    // Return customer ID and data for Autumn
    // Autumn will automatically create a customer record if it doesn't exist
    // Better Auth user has userId property
    const userId = user.userId || user._id;
    return {
      customerId: userId,
      customerData: {
        name: user.name as string,
        email: user.email as string,
      },
    };
  },
});

/**
 * Export Autumn API functions for use in Convex queries, mutations, and actions.
 *
 * Usage:
 * - check: Verify if a user has access to a feature
 * - track: Record usage of a feature (for metering/billing)
 * - checkout: Create a checkout session for a product
 * - usage: Get usage data for a customer
 * - cancel: Cancel a subscription
 * - billingPortal: Get a link to the customer's billing portal
 * - and more...
 */
export const {
  track,
  cancel,
  query,
  attach,
  check,
  checkout,
  usage,
  setupPayment,
  createCustomer,
  listProducts,
  billingPortal,
  createReferralCode,
  redeemReferralCode,
  createEntity,
  getEntity,
} = autumn.api();
