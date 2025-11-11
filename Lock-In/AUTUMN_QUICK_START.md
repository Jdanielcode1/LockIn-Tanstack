# Autumn Integration - Quick Start Guide

This is a condensed guide to get started quickly with Autumn billing in the Lock-In project.

## What's Already Set Up

✅ **Backend**
- Autumn component registered in `convex/convex.config.ts`
- Autumn client initialized in `convex/autumn.ts` with Better Auth
- Subscription functions in `convex/subscriptions.ts`
- Environment variable `AUTUMN_SECRET_KEY` configured

✅ **Frontend**
- `AutumnProvider` added to root component
- Subscription management page at `/subscription`
- Feature guard component at `src/components/FeatureGuard.tsx`
- Demo page at `/autumn-demo`

## Quick Usage Examples

### 1. Check Feature Access (Backend)

```typescript
// In any Convex mutation/query
import { autumn } from "./autumn";

export const myFunction = mutation({
  handler: async (ctx, args) => {
    // Check if user has access
    const { data, error } = await autumn.check(ctx, {
      featureId: "premium_feature",
    });

    if (!data?.allowed) {
      throw new Error("Premium subscription required");
    }

    // User has access, proceed...
  },
});
```

### 2. Track Usage (Backend)

```typescript
// Track feature usage for metered billing
export const sendMessage = mutation({
  handler: async (ctx, args) => {
    // Do the action...

    // Track it
    await autumn.track(ctx, {
      featureId: "messages",
      value: 1,
    });
  },
});
```

### 3. Use Feature Guard (Frontend)

```tsx
import { FeatureGuard } from "~/components/FeatureGuard";

function MyComponent() {
  return (
    <FeatureGuard
      featureId="advanced_analytics"
      upgradePlan="pro_plan"
    >
      <PremiumContent />
    </FeatureGuard>
  );
}
```

### 4. Check Access in Component (Frontend)

```tsx
import { useCustomer } from "~/lib/autumn-client";

function MyComponent() {
  const { customer, checkout } = useCustomer();

  const hasAccess = customer?.check?.({
    featureId: "premium_feature"
  })?.allowed;

  if (!hasAccess) {
    return (
      <button onClick={() => checkout({ productId: "pro_plan" })}>
        Upgrade to Pro
      </button>
    );
  }

  return <PremiumFeature />;
}
```

### 5. Create Checkout Session (Frontend)

```tsx
import { useCustomer } from "~/lib/autumn-client";

function UpgradeButton() {
  const { checkout } = useCustomer();

  return (
    <button onClick={() => checkout({ productId: "pro_plan" })}>
      Upgrade to Pro
    </button>
  );
}
```

### 6. Open Billing Portal (Frontend)

```tsx
import { useCustomer } from "~/lib/autumn-client";

function ManageBillingButton() {
  const { openBillingPortal } = useCustomer();

  return (
    <button onClick={() => openBillingPortal()}>
      Manage Billing
    </button>
  );
}
```

## Next Steps

### 1. Set Up Autumn Dashboard
1. Go to [useautumn.com](https://useautumn.com)
2. Create/login to your account
3. Create pricing plans (Free, Pro, Enterprise, etc.)
4. Define features for each plan
5. Connect Stripe account

### 2. Define Your Features

Example features to create in Autumn dashboard:

```
Feature ID: basic_features
- Available on: All plans
- Type: Boolean (on/off)

Feature ID: api_calls
- Available on: All plans
- Type: Metered
- Limits: Free (100/month), Pro (1000/month), Enterprise (unlimited)

Feature ID: team_seats
- Available on: Pro, Enterprise
- Type: Metered/Seats
- Limits: Pro (5), Enterprise (unlimited)

Feature ID: advanced_analytics
- Available on: Pro, Enterprise
- Type: Boolean (on/off)
```

### 3. Test the Integration

Visit these pages to test:
- `/subscription` - Subscription management page
- `/autumn-demo` - Integration examples and demos

### 4. Implement in Your Features

Add feature checks to your existing features:

```typescript
// Example: Add to video upload
export const uploadVideo = mutation({
  handler: async (ctx, args) => {
    // Check if user can upload videos
    const access = await autumn.check(ctx, {
      featureId: "video_uploads",
    });

    if (!access.data?.allowed) {
      throw new Error("Upgrade to upload more videos");
    }

    // Proceed with upload...

    // Track the upload
    await autumn.track(ctx, {
      featureId: "video_uploads",
      value: 1,
    });
  },
});
```

## Common Patterns

### Pattern: Metered Feature with Limit Display

```tsx
function VideoUploader() {
  const { customer } = useCustomer();

  // Get usage info
  const usage = customer?.usage?.find(
    u => u.featureId === "video_uploads"
  );

  return (
    <div>
      <p>{usage?.current || 0} / {usage?.limit || "∞"} videos uploaded</p>
      {usage?.current >= usage?.limit && (
        <p>Upgrade to upload more videos</p>
      )}
    </div>
  );
}
```

### Pattern: Conditional Feature Rendering

```tsx
function Dashboard() {
  const { customer } = useCustomer();

  const hasPremium = customer?.check?.({
    featureId: "advanced_analytics"
  })?.allowed;

  return (
    <div>
      <BasicAnalytics />
      {hasPremium && <AdvancedAnalytics />}
    </div>
  );
}
```

### Pattern: Backend + Frontend Check

```tsx
// Backend: Secure check
export const generateReport = mutation({
  handler: async (ctx) => {
    const access = await autumn.check(ctx, {
      featureId: "reports",
    });

    if (!access.data?.allowed) {
      throw new Error("Access denied");
    }

    // Generate report...
  },
});

// Frontend: UX hint
function ReportButton() {
  const { customer } = useCustomer();
  const generate = useMutation(api.reports.generateReport);

  const hasAccess = customer?.check?.({
    featureId: "reports"
  })?.allowed;

  return (
    <button
      onClick={() => generate.mutate()}
      disabled={!hasAccess}
    >
      {hasAccess ? "Generate Report" : "Upgrade for Reports"}
    </button>
  );
}
```

## Files Created/Modified

### Created Files
- `convex/autumn.ts` - Autumn client initialization
- `convex/subscriptions.ts` - Subscription management functions
- `src/lib/autumn-client.tsx` - Frontend Autumn provider
- `src/components/FeatureGuard.tsx` - Feature access guard component
- `src/routes/_authenticated.subscription.tsx` - Subscription page
- `src/routes/_authenticated.autumn-demo.tsx` - Demo page
- `AUTUMN_INTEGRATION.md` - Comprehensive documentation
- `AUTUMN_QUICK_START.md` - This file

### Modified Files
- `convex/convex.config.ts` - Added Autumn component
- `src/routes/__root.tsx` - Added AutumnProvider and navigation link
- `.env.local` - Already had AUTUMN_SECRET_KEY

## Useful Commands

```bash
# View Convex logs
npx convex dashboard

# Set environment variable
npx convex env set KEY "value"

# View environment variables
npx convex env list

# Deploy to production
npx convex deploy
```

## Support

- Full documentation: `AUTUMN_INTEGRATION.md`
- Autumn docs: https://docs.useautumn.com
- Demo page: http://localhost:3001/autumn-demo
- Subscription page: http://localhost:3001/subscription
