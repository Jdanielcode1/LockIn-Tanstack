import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";

/**
 * Get the authenticated user ID from the current context.
 * Throws an error if the user is not authenticated.
 *
 * Note: This returns the Lock-In users table ID, not Better Auth's user ID.
 * Better Auth creates its own user/session tables.
 */
export async function getAuthUserId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const betterAuthUser = await authComponent.getAuthUser(ctx);
  if (!betterAuthUser) {
    throw new Error("Not authenticated");
  }

  // Look up Lock-In user by email (Better Auth user email)
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", betterAuthUser.email))
    .first();

  if (!user) {
    throw new Error("User not found in Lock-In database");
  }

  return user._id;
}

/**
 * Get the authenticated user ID, or null if not authenticated.
 */
export async function getAuthUserIdOrNull(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users"> | null> {
  try {
    return await getAuthUserId(ctx);
  } catch {
    return null;
  }
}

/**
 * Get both the user ID and the user document.
 * Throws if not authenticated or user doesn't exist.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return { userId, user };
}
