/**
 * Account-specific storage keys.
 *
 * Never use the legacy unscoped cache for authenticated accounts.
 */
export function accountCacheKey(userId: string, name: string): string {
  if (!userId.trim()) {
    throw new Error("Authenticated user ID is required");
  }

  return `cache:user:${encodeURIComponent(userId)}:${encodeURIComponent(name)}`;
}

export function accountStorageKey(userId: string, name: string): string {
  if (!userId.trim()) {
    throw new Error("Authenticated user ID is required");
  }

  return `user:${encodeURIComponent(userId)}:${encodeURIComponent(name)}`;
}
