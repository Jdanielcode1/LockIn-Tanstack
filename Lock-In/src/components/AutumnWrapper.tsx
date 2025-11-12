"use client";
import { AutumnProvider } from "autumn-js/react";
import { api } from "../../convex/_generated/api";
import { useConvex } from "convex/react";

/**
 * AutumnWrapper wraps the application with Autumn's React context.
 * This enables the use of Autumn hooks (useCustomer, useEntity) and
 * components (PricingTable, CheckoutDialog, etc.) throughout the app.
 */
export function AutumnWrapper({ children }: { children: React.ReactNode }) {
  const convex = useConvex();

  return (
    <AutumnProvider convex={convex} convexApi={(api as any).autumn}>
      {children}
    </AutumnProvider>
  );
}
