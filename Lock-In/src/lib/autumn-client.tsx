/**
 * Autumn Client Setup for React
 *
 * This file sets up the Autumn provider and hooks for the frontend.
 */

import { AutumnProvider as AutumnProviderBase } from "autumn-js/react";
import { type ReactNode } from "react";

/**
 * Autumn Provider wrapper component.
 *
 * Wrap your app with this to enable Autumn billing hooks and components.
 * This should be placed inside ConvexBetterAuthProvider to have access to auth.
 */
export function AutumnProvider({ children }: { children: ReactNode }) {
  // Get the site URL from environment variable
  // This should point to your Convex backend where the Autumn handler is mounted
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL;

  if (!siteUrl) {
    console.error(
      "VITE_CONVEX_SITE_URL is not set. Autumn features may not work correctly.",
    );
  }

  return (
    <AutumnProviderBase betterAuthUrl={siteUrl}>
      {children}
    </AutumnProviderBase>
  );
}

/**
 * Re-export Autumn hooks for convenience
 */
export { useCustomer } from "autumn-js/react";
