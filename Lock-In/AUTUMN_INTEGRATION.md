# Autumn Billing Integration Guide

This document provides comprehensive documentation for the Autumn billing and subscription system integrated into the Lock-In project.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup & Configuration](#setup--configuration)
4. [Backend Integration](#backend-integration)
5. [Frontend Integration](#frontend-integration)
6. [Usage Examples](#usage-examples)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Next Steps](#next-steps)

## Overview

Autumn is an open-source pricing and billing platform built on top of Stripe. It provides a simplified abstraction for managing:

- **Subscriptions** - Recurring billing plans
- **Usage-based billing** - Metered features and pay-as-you-go
- **Feature access control** - Restrict features based on subscription
- **One-time payments** - Add-ons and top-ups
- **Trials** - Free trial periods
- **Credits** - Credit-based systems

### Key Benefits

- **No webhooks required** - Autumn handles Stripe webhooks for you
- **Type-safe** - Full TypeScript support
- **Convex integration** - Native integration with Convex backend
- **Better Auth compatible** - Works seamlessly with Better Auth
- **Three core functions** - `check()`, `track()`, and `checkout()`

## Architecture

### Integration Flow

```
User Browser
    ↓
React Components (useCustomer hook)
    ↓
AutumnProvider (Frontend)
    ↓
Convex Backend (convex/autumn.ts)
    ↓
Autumn API
    ↓
Stripe
```

### File Structure

```
Lock-In/
├── convex/
│   ├── convex.config.ts          # Autumn component registration
│   ├── autumn.ts                 # Autumn client initialization
│   └── subscriptions.ts          # Subscription management functions
├── src/
│   ├── lib/
│   │   └── autumn-client.tsx     # Frontend Autumn provider
│   ├── components/
│   │   └── FeatureGuard.tsx      # Feature access component
│   └── routes/
│       ├── __root.tsx            # AutumnProvider setup
│       ├── _authenticated.subscription.tsx  # Subscription management page
│       └── _authenticated.autumn-demo.tsx   # Integration examples
└── .env.local                    # Environment variables
```

## Setup & Configuration

### 1. Packages Installed

```json
{
  "dependencies": {
    "@useautumn/convex": "latest",
    "autumn-js": "latest"
  }
}
```

### 2. Environment Variables

The following environment variables are configured:

```bash
# In .env.local
AUTUMN_SECRET_KEY=am_sk_test_xxxxxxxxxxxxx

# Also set in Convex
# npx convex env set AUTUMN_SECRET_KEY "am_sk_test_xxxxxxxxxxxxx"
```

### 3. Convex Configuration

The Autumn component is registered in `convex/convex.config.ts`:

```typescript
import { defineApp } from "convex/server";
import autumn from "@useautumn/convex/convex.config";

const app = defineApp();
app.use(autumn);
export default app;
```

## Backend Integration

### Autumn Client (`convex/autumn.ts`)

The Autumn client is initialized with Better Auth integration:

```typescript
import { Autumn } from "@useautumn/convex";
import { authComponent } from "./auth";

export const autumn = new Autumn(components.autumn, {
  identify: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    return user ? user.id : null;
  },
});
```

The `identify` function determines which customer (user) is making the request. This is called on every Autumn API request.

### Subscription Functions (`convex/subscriptions.ts`)

The integration provides the following Convex functions:

#### Query Functions

- **`checkFeatureAccess`** - Check if user has access to a feature
- **`getCustomer`** - Get customer data and subscription info
- **`listProducts`** - List all available products/plans

#### Mutation Functions

- **`trackUsage`** - Track usage of metered features
- **`createCheckout`** - Create a checkout session
- **`cancelSubscription`** - Cancel a subscription
- **`getBillingPortal`** - Get Stripe billing portal URL

### Example: Checking Feature Access (Backend)

```typescript
// In a Convex function
import { autumn } from "./autumn";

export const performPremiumAction = mutation({
  handler: async (ctx, args) => {
    // Check if user has access
    const { data, error } = await autumn.check(ctx, {
      featureId: "premium_feature",
    });

    if (!data?.allowed) {
      throw new Error("Premium subscription required");
    }

    // User has access, perform the action
    // ...
  },
});
```

### Example: Tracking Usage (Backend)

```typescript
// Track usage server-side to prevent tampering
export const sendMessage = mutation({
  handler: async (ctx, args) => {
    // Send the message
    // ...

    // Track usage
    await autumn.track(ctx, {
      featureId: "messages",
      value: 1,
    });
  },
});
```

## Frontend Integration

### Autumn Provider (`src/lib/autumn-client.tsx`)

The AutumnProvider wraps the application in `src/routes/__root.tsx`:

```tsx
<ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
  <AutumnProvider>
    <App />
  </AutumnProvider>
</ConvexBetterAuthProvider>
```

### useCustomer Hook

The `useCustomer` hook provides access to customer data and billing functions:

```typescript
import { useCustomer } from "~/lib/autumn-client";

function MyComponent() {
  const { customer, checkout, openBillingPortal, track, isLoading } =
    useCustomer({
      expand: ["products", "invoices"],
    });

  // Check feature access (client-side)
  const hasAccess = customer?.check?.({ featureId: "premium" })?.allowed;

  // Open checkout
  const handleUpgrade = () => {
    checkout({
      productId: "pro_plan",
      dialog: CheckoutDialog, // Optional custom dialog
    });
  };

  // Open billing portal
  const handleManageBilling = () => {
    openBillingPortal({
      returnUrl: window.location.href,
    });
  };

  return <div>{/* ... */}</div>;
}
```

### Feature Guard Component

The `FeatureGuard` component restricts access to premium features:

```tsx
import { FeatureGuard } from "~/components/FeatureGuard";

function MyPage() {
  return (
    <FeatureGuard
      featureId="advanced_analytics"
      upgradePlan="pro_plan"
      deniedMessage="Upgrade to Pro for advanced analytics"
    >
      <AdvancedAnalyticsDashboard />
    </FeatureGuard>
  );
}
```

### useFeatureAccess Hook

For more control, use the `useFeatureAccess` hook:

```typescript
import { useFeatureAccess } from "~/components/FeatureGuard";

function MyComponent() {
  const { hasAccess, trackUsage } = useFeatureAccess("api_calls");

  const makeApiCall = async () => {
    if (!hasAccess) {
      alert("Upgrade required");
      return;
    }

    // Make the API call
    // ...

    // Track usage
    await trackUsage(1);
  };

  return <button onClick={makeApiCall}>Make API Call</button>;
}
```

## Usage Examples

### Example 1: Subscription Management Page

A complete subscription management page is available at `/subscription` (`src/routes/_authenticated.subscription.tsx`). Features include:

- Display current subscription
- List available plans
- Upgrade/downgrade buttons
- Billing portal access
- Invoice history

### Example 2: Metered Feature with Usage Tracking

```typescript
// Backend: Track usage securely
export const generateAIResponse = mutation({
  handler: async (ctx, args) => {
    // Check access
    const { data } = await autumn.check(ctx, {
      featureId: "ai_generations",
    });

    if (!data?.allowed) {
      throw new Error("AI generation limit reached");
    }

    // Generate AI response
    const response = await generateResponse(args.prompt);

    // Track usage
    await autumn.track(ctx, {
      featureId: "ai_generations",
      value: 1,
      eventName: "ai_generation_completed",
    });

    return response;
  },
});

// Frontend: Display usage limits
function AIGenerator() {
  const { customer } = useCustomer();
  const generations = useMutation(api.subscriptions.generateAIResponse);

  // Get current usage from customer data
  const usage = customer?.usage?.find(
    (u: any) => u.featureId === "ai_generations",
  );

  return (
    <div>
      <p>
        Used: {usage?.current || 0} / {usage?.limit || "unlimited"}
      </p>
      <button onClick={() => generations.mutate({ prompt: "..." })}>
        Generate
      </button>
    </div>
  );
}
```

### Example 3: Seat-Based Licensing

```typescript
// Backend: Check seat availability
export const inviteTeamMember = mutation({
  handler: async (ctx, args) => {
    const { data } = await autumn.check(ctx, {
      featureId: "team_seats",
    });

    if (!data?.allowed) {
      throw new Error("No available team seats");
    }

    // Create the team member
    // ...

    // Track seat usage
    await autumn.track(ctx, {
      featureId: "team_seats",
      value: 1,
    });
  },
});
```

### Example 4: Trial Period

```typescript
// Create checkout with trial
const handleStartTrial = () => {
  checkout({
    productId: "pro_plan",
    trial: true, // Enable trial period
  });
};
```

## Best Practices

### Security

1. **Always check access on the backend** - Client-side checks can be bypassed
2. **Track usage server-side** - Prevent users from manipulating usage data
3. **Use idempotency keys** - Prevent duplicate usage tracking

```typescript
// Good: Backend check + tracking
export const performAction = mutation({
  handler: async (ctx, args) => {
    const access = await autumn.check(ctx, { featureId: "feature" });
    if (!access.data?.allowed) throw new Error("Access denied");

    // Perform action
    await autumn.track(ctx, {
      featureId: "feature",
      idempotencyKey: `${ctx.user.id}-${Date.now()}`,
    });
  },
});

// Bad: Client-side only
function MyComponent() {
  const { customer } = useCustomer();
  if (customer?.check?.({ featureId: "feature" })?.allowed) {
    // Don't rely only on this!
  }
}
```

### Performance

1. **Expand only what you need** - Don't request unnecessary data

```typescript
// Good: Only request what you need
const { customer } = useCustomer({
  expand: ["products"], // Only products
});

// Less efficient: Requesting everything
const { customer } = useCustomer({
  expand: ["products", "invoices", "entities", "referrals", "paymentMethods"],
});
```

2. **Cache customer data** - Use React Query's caching

```typescript
const { data: customer } = useSuspenseQuery({
  queryKey: ["subscriptions.getCustomer", { expand: ["products"] }],
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### User Experience

1. **Show clear upgrade prompts** - Use FeatureGuard or custom components
2. **Display usage limits** - Let users know how much they've used
3. **Provide billing management** - Easy access to billing portal

```tsx
<div className="usage-indicator">
  <p>
    {usage.current} / {usage.limit} API calls used
  </p>
  {usage.current >= usage.limit * 0.8 && (
    <button onClick={handleUpgrade}>Upgrade for more</button>
  )}
</div>
```

## Troubleshooting

### Common Issues

#### Issue: "AUTUMN_SECRET_KEY is not set"

**Solution:** Ensure the key is set in both `.env.local` and Convex:

```bash
# Set in Convex
npx convex env set AUTUMN_SECRET_KEY "am_sk_test_xxxxx"
```

#### Issue: "Customer not authenticated"

**Solution:** Ensure the user is logged in with Better Auth before accessing Autumn features:

```typescript
const user = await authComponent.getAuthUser(ctx);
if (!user) {
  throw new Error("User not authenticated");
}
```

#### Issue: "AutumnProvider not working"

**Solution:** Verify the provider is placed inside `ConvexBetterAuthProvider`:

```tsx
<ConvexBetterAuthProvider>
  <AutumnProvider>{/* Your app */}</AutumnProvider>
</ConvexBetterAuthProvider>
```

#### Issue: "Feature check always returns false"

**Solution:**
1. Ensure products are created in the Autumn dashboard
2. Verify features are associated with products
3. Check that the user has an active subscription

### Debug Mode

To enable debug logging, check the Convex dashboard logs when calling Autumn functions.

## Next Steps

### 1. Set Up Autumn Dashboard

1. Go to [useautumn.com](https://useautumn.com)
2. Create an account or log in
3. Set up your pricing plans and products
4. Configure features for each product
5. Connect your Stripe account

### 2. Configure Stripe

1. Add your Stripe test keys to the Autumn dashboard
2. Test the checkout flow in development
3. Switch to production keys when ready

### 3. Create Your Pricing Plans

Example products to create:

- **Free Tier**
  - Feature: `basic_features` (unlimited)
  - Feature: `api_calls` (100/month)

- **Pro Plan** ($19/month)
  - Feature: `basic_features` (unlimited)
  - Feature: `api_calls` (1000/month)
  - Feature: `premium_features` (enabled)
  - Feature: `team_seats` (5)

- **Enterprise Plan** ($99/month)
  - Feature: `basic_features` (unlimited)
  - Feature: `api_calls` (unlimited)
  - Feature: `premium_features` (enabled)
  - Feature: `team_seats` (unlimited)
  - Feature: `priority_support` (enabled)

### 4. Implement Feature Gating

Add `FeatureGuard` components around premium features:

```tsx
// In your components
<FeatureGuard featureId="premium_analytics" upgradePlan="pro_plan">
  <PremiumAnalytics />
</FeatureGuard>
```

### 5. Add Usage Tracking

Track usage for metered features:

```typescript
// In your Convex mutations
await autumn.track(ctx, {
  featureId: "api_calls",
  value: 1,
  eventName: "api_call_made",
});
```

### 6. Test the Integration

1. Navigate to `/subscription` to view the subscription page
2. Navigate to `/autumn-demo` to see integration examples
3. Test the checkout flow with Stripe test cards
4. Verify feature access control works correctly
5. Test usage tracking and limits

### 7. Production Checklist

Before going to production:

- [ ] Switch to production Stripe keys in Autumn dashboard
- [ ] Update `AUTUMN_SECRET_KEY` with production key
- [ ] Test all payment flows with real cards
- [ ] Set up monitoring for failed payments
- [ ] Add error tracking (Sentry, etc.)
- [ ] Configure email notifications in Stripe
- [ ] Review and test refund/cancellation flows
- [ ] Add terms of service and privacy policy links
- [ ] Test tax calculation (if applicable)
- [ ] Set up customer support for billing questions

## Additional Resources

- [Autumn Documentation](https://docs.useautumn.com)
- [Autumn GitHub](https://github.com/useautumn/autumn)
- [Better Auth Autumn Plugin](https://www.better-auth.com/docs/plugins/autumn)
- [Convex Autumn Component](https://www.convex.dev/components/autumn)
- [Stripe Documentation](https://stripe.com/docs)

## Support

For issues specific to:
- **Autumn**: Open an issue on [GitHub](https://github.com/useautumn/autumn)
- **Better Auth**: Check [Better Auth docs](https://www.better-auth.com)
- **Convex**: Check [Convex docs](https://docs.convex.dev)
- **This integration**: Check the demo pages at `/subscription` and `/autumn-demo`
