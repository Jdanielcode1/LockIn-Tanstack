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
  /**
   * Identify the customer making the request.
   *
   * For Better Auth integration, we use the user's ID from the auth session.
   * This ensures that billing is tied to the authenticated user.
   *
   * @param ctx - Convex context with auth information
   * @returns The customer ID (user ID) or null if not authenticated
   */
  identify: async (ctx) => {
    // Get the authenticated user from Better Auth
    const user = await authComponent.getAuthUser(ctx);

    if (!user) {
      // User is not authenticated
      return null;
    }

    // Return the user's ID as the customer ID
    // Autumn will automatically create a customer record if it doesn't exist
    return user.id;
  },
});
