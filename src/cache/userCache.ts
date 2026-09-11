import type { ApiUsersResponse, ApiUser } from '@/types/api';

/**
 * In-memory cache for User Management API data.
 * - Stores latest successfully fetched users response in JS runtime memory.
 * - Supports granular instant mutations (add, edit, status update, remove).
 * - Survives React component unmount/remount during the single application session.
 * - Cleared automatically on browser refresh/reload.
 */
class UserCache {
  private cache: ApiUsersResponse | null = null;
  private statusOverrides = new Map<string, string>();
  private userFieldOverrides = new Map<string, Partial<ApiUser>>();

  /**
   * Get cached API data if present.
   */
  public get(): ApiUsersResponse | null {
    return this.cache;
  }

  /**
   * Store fresh API data in cache, preserving local status & field mutations.
   */
  public set(data: ApiUsersResponse): void {
    if (!data || !Array.isArray(data.users)) {
      this.cache = data;
      return;
    }

    const serverUsersMap = new Map<string, ApiUser>();
    for (const u of data.users) {
      const key = (u.username || u.alias || '').toLowerCase();
      if (key) {
        serverUsersMap.set(key, { ...u });
      }
    }

    // Apply local overrides to server users
    for (const [key, user] of serverUsersMap.entries()) {
      if (this.statusOverrides.has(key)) {
        user.status = this.statusOverrides.get(key)!;
      }
      if (this.userFieldOverrides.has(key)) {
        Object.assign(user, this.userFieldOverrides.get(key));
      }
    }

    // Retain locally deactivated/disabled or modified users if not present in server payload
    for (const [key, status] of this.statusOverrides.entries()) {
      if (!serverUsersMap.has(key)) {
        const fieldOverride = this.userFieldOverrides.get(key) || {};
        const fallbackUser: ApiUser = {
          alias: fieldOverride.alias || fieldOverride.username || key,
          username: fieldOverride.username || fieldOverride.alias || key,
          name: fieldOverride.name || key,
          email: fieldOverride.email || `${key}@centcom.mil`,
          status: status,
          ...fieldOverride,
        };
        serverUsersMap.set(key, fallbackUser);
      }
    }

    const mergedUsers = Array.from(serverUsersMap.values());
    this.cache = {
      ...data,
      users: mergedUsers,
    };
    this.recalculateCounts();
  }

  /**
   * Invalidate / clear cached data.
   */
  public clear(): void {
    this.cache = null;
    this.statusOverrides.clear();
    this.userFieldOverrides.clear();
  }

  /**
   * Returns true if cache contains valid data.
   */
  public hasData(): boolean {
    return this.cache !== null && Array.isArray(this.cache.users);
  }

  /**
   * Update status of a user in cache immediately.
   */
  public updateUserStatus(username: string, newStatus: string): void {
    const target = username.trim().toLowerCase();
    this.statusOverrides.set(target, newStatus);

    if (!this.cache || !Array.isArray(this.cache.users)) return;
    this.cache.users = this.cache.users.map((u) => {
      const uName = (u.username || u.alias || '').toLowerCase();
      const uAlias = (u.alias || '').toLowerCase();
      if (uName === target || uAlias === target) {
        return { ...u, status: newStatus };
      }
      return u;
    });
    this.recalculateCounts();
  }

  /**
   * Remove a user from cache immediately.
   */
  public removeUser(username: string): void {
    const target = username.trim().toLowerCase();
    this.statusOverrides.delete(target);
    this.userFieldOverrides.delete(target);

    if (!this.cache || !Array.isArray(this.cache.users)) return;
    this.cache.users = this.cache.users.filter((u) => {
      const uName = (u.username || u.alias || '').toLowerCase();
      const uAlias = (u.alias || '').toLowerCase();
      return uName !== target && uAlias !== target;
    });
    this.recalculateCounts();
  }

  /**
   * Add a new user to cache immediately.
   */
  public addUser(newUser: ApiUser): void {
    const key = (newUser.username || newUser.alias || '').toLowerCase();
    if (key && newUser.status) {
      this.statusOverrides.set(key, newUser.status);
    }
    if (key) {
      this.userFieldOverrides.set(key, { ...newUser });
    }

    if (!this.cache) {
      this.cache = { totalCount: 1, activeCount: 1, disabledCount: 0, users: [newUser] };
      return;
    }
    if (!Array.isArray(this.cache.users)) {
      this.cache.users = [newUser];
    } else {
      this.cache.users = [newUser, ...this.cache.users];
    }
    this.recalculateCounts();
  }

  /**
   * Update details of a user in cache immediately, handling key migrations if username changed.
   */
  public updateUser(username: string, updatedFields: Partial<ApiUser>): void {
    const target = username.trim().toLowerCase();
    const newUsername = updatedFields.username || updatedFields.alias;
    const newTarget = newUsername ? newUsername.trim().toLowerCase() : target;

    if (newTarget !== target) {
      if (this.statusOverrides.has(target)) {
        const st = this.statusOverrides.get(target)!;
        this.statusOverrides.delete(target);
        this.statusOverrides.set(newTarget, st);
      }
      if (this.userFieldOverrides.has(target)) {
        const existing = this.userFieldOverrides.get(target)!;
        this.userFieldOverrides.delete(target);
        this.userFieldOverrides.set(newTarget, { ...existing, ...updatedFields });
      } else {
        this.userFieldOverrides.set(newTarget, updatedFields);
      }
    } else {
      const existing = this.userFieldOverrides.get(target) || {};
      this.userFieldOverrides.set(target, { ...existing, ...updatedFields });
    }

    if (!this.cache || !Array.isArray(this.cache.users)) return;

    this.cache.users = this.cache.users.map((u) => {
      const uName = (u.username || u.alias || '').toLowerCase();
      const uAlias = (u.alias || '').toLowerCase();
      if (uName === target || uAlias === target) {
        return {
          ...u,
          ...updatedFields,
          alias: updatedFields.alias || updatedFields.username || u.alias,
          username: updatedFields.username || updatedFields.alias || u.username,
        };
      }
      return u;
    });
    this.recalculateCounts();
  }

  /**
   * Recalculate summary totals after mutations.
   */
  private recalculateCounts(): void {
    if (!this.cache || !Array.isArray(this.cache.users)) return;
    const total = this.cache.users.length;
    const active = this.cache.users.filter((u) => u.status?.toLowerCase() === 'active').length;
    const disabled = this.cache.users.filter((u) => u.status?.toLowerCase() === 'disabled').length;
    this.cache.totalCount = total;
    this.cache.activeCount = active;
    this.cache.disabledCount = disabled;
  }
}

export const userCache = new UserCache();
