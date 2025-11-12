/**
 * Autumn Client Setup for React with Convex
 *
 * This file sets up the Autumn provider for use with Convex backend.
 */

import { AutumnProvider as AutumnProviderBase } from "autumn-js/react";
import { type ReactNode } from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Autumn Provider wrapper component for Convex.
 *
 * Wrap your app with this to enable Autumn billing hooks and components.
 * This should be placed inside ConvexBetterAuthProvider to have access to auth.
 */
export function AutumnProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();

  return (
    <AutumnProviderBase convex={convex} convexApi={(api as any).autumn}>
      {children}
    </AutumnProviderBase>
  );
}

/**
 * Re-export Autumn hooks for convenience
 */
export { useCustomer, useEntity } from "autumn-js/react";
