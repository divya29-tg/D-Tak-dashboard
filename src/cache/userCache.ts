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

  /**
   * Get cached API data if present.
   */
  public get(): ApiUsersResponse | null {
    return this.cache;
  }

  /**
   * Store fresh API data in cache.
   */
  public set(data: ApiUsersResponse): void {
    this.cache = data;
  }

  /**
   * Invalidate / clear cached data.
   */
  public clear(): void {
    this.cache = null;
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
    if (!this.cache || !Array.isArray(this.cache.users)) return;
    const target = username.trim().toLowerCase();
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
   * Remove a user from cache immediately (deactivate/delete).
   */
  public removeUser(username: string): void {
    if (!this.cache || !Array.isArray(this.cache.users)) return;
    const target = username.trim().toLowerCase();
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
   * Update details of a user in cache immediately.
   */
  public updateUser(username: string, updatedFields: Partial<ApiUser>): void {
    if (!this.cache || !Array.isArray(this.cache.users)) return;
    const target = username.trim().toLowerCase();
    this.cache.users = this.cache.users.map((u) => {
      const uName = (u.username || u.alias || '').toLowerCase();
      const uAlias = (u.alias || '').toLowerCase();
      if (uName === target || uAlias === target) {
        return { ...u, ...updatedFields };
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
