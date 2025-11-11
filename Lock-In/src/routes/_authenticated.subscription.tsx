/**
 * Subscription Management Page
 *
 * This page allows users to view and manage their subscription,
 * upgrade/downgrade plans, and access the billing portal.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { useCustomer } from "~/lib/autumn-client";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/subscription")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Get customer data from Autumn
  const {
    customer,
    isLoading: isCustomerLoading,
    checkout,
    openBillingPortal,
  } = useCustomer({
    expand: ["products", "invoices"],
  });

  // Get available products
  const { data: products } = useSuspenseQuery({
    queryKey: ["subscriptions.listProducts"],
  });

  // Handle checkout
  const handleCheckout = async (productId: string) => {
    setIsCheckingOut(true);
    try {
      await checkout({
        productId,
        // You can use a custom dialog component here
        // dialog: CustomCheckoutDialog,
      });
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Handle billing portal
  const handleBillingPortal = () => {
    openBillingPortal({
      returnUrl: window.location.href,
    });
  };

  if (isCustomerLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#8b949e] text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p>Loading subscription data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9]">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Subscription & Billing
          </h1>
          <p className="text-[#8b949e]">
            Manage your subscription and billing settings
          </p>
        </div>

        {/* Current Subscription */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Current Subscription
          </h2>
          {customer?.products && customer.products.length > 0 ? (
            <div className="space-y-4">
              {customer.products.map((product: any) => (
                <div
                  key={product.id}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {product.name}
                      </h3>
                      <p className="text-[#8b949e] text-sm mt-1">
                        {product.description}
                      </p>
                      <div className="mt-2 text-sm">
                        <span className="text-[#58a6ff]">
                          ${product.price} / {product.interval}
                        </span>
                      </div>
                      {product.status && (
                        <div className="mt-2">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              product.status === "active"
                                ? "bg-[#238636] text-white"
                                : "bg-[#6e7681] text-white"
                            }`}
                          >
                            {product.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={handleBillingPortal}
                className="mt-4 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white rounded-lg transition-colors"
              >
                Manage Billing
              </button>
            </div>
          ) : (
            <div className="text-[#8b949e] text-center py-8">
              <p className="mb-4">You don't have an active subscription</p>
              <p className="text-sm">
                Choose a plan below to get started with premium features
              </p>
            </div>
          )}
        </div>

        {/* Available Plans */}
        {products && products.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              Available Plans
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product: any) => {
                const isCurrentPlan = customer?.products?.some(
                  (p: any) => p.id === product.id,
                );

                return (
                  <div
                    key={product.id}
                    className={`bg-[#161b22] border rounded-lg p-6 ${
                      isCurrentPlan
                        ? "border-[#58a6ff]"
                        : "border-[#30363d]"
                    }`}
                  >
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {product.name}
                    </h3>
                    <p className="text-[#8b949e] text-sm mb-4">
                      {product.description}
                    </p>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-white">
                        ${product.price}
                      </span>
                      <span className="text-[#8b949e]">
                        {" "}
                        / {product.interval}
                      </span>
                    </div>
                    {product.features && (
                      <ul className="space-y-2 mb-6">
                        {product.features.map((feature: string, i: number) => (
                          <li
                            key={i}
                            className="text-sm text-[#8b949e] flex items-start"
                          >
                            <span className="text-[#58a6ff] mr-2">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={() => handleCheckout(product.id)}
                      disabled={isCurrentPlan || isCheckingOut}
                      className={`w-full px-4 py-2 rounded-lg transition-colors ${
                        isCurrentPlan
                          ? "bg-[#21262d] text-[#8b949e] cursor-not-allowed"
                          : "bg-[#238636] hover:bg-[#2ea043] text-white"
                      }`}
                    >
                      {isCurrentPlan
                        ? "Current Plan"
                        : isCheckingOut
                          ? "Loading..."
                          : "Subscribe"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Invoices */}
        {customer?.invoices && customer.invoices.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">
              Recent Invoices
            </h2>
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#0d1117]">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-[#8b949e]">
                      Date
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-[#8b949e]">
                      Description
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-[#8b949e]">
                      Amount
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-[#8b949e]">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-[#8b949e]">
                      Invoice
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customer.invoices.map((invoice: any, i: number) => (
                    <tr
                      key={invoice.id || i}
                      className="border-t border-[#30363d]"
                    >
                      <td className="px-6 py-4 text-sm">
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {invoice.description}
                      </td>
                      <td className="px-6 py-4 text-sm">${invoice.amount}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            invoice.status === "paid"
                              ? "bg-[#238636] text-white"
                              : invoice.status === "pending"
                                ? "bg-[#9e6a03] text-white"
                                : "bg-[#da3633] text-white"
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {invoice.pdf && (
                          <a
                            href={invoice.pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#58a6ff] hover:underline"
                          >
                            View PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
