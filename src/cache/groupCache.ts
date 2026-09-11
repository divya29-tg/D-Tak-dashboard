import type { ApiGroupsResponse, ApiGroup } from '@/types/api';

/**
 * In-memory cache for Group Management API data.
 * - Stores latest successfully fetched groups response in JS runtime memory.
 * - Supports granular instant mutations (add, edit, status update, remove).
 * - Survives React component unmount/remount during the single application session.
 * - Cleared automatically on browser refresh/reload.
 */
class GroupCache {
  private cache: ApiGroupsResponse | null = null;

  /**
   * Get cached API data if present.
   */
  public get(): ApiGroupsResponse | null {
    return this.cache;
  }

  /**
   * Store fresh API data in cache.
   */
  public set(data: ApiGroupsResponse): void {
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
    return this.cache !== null && Array.isArray(this.cache.groups);
  }

  /**
   * Add a group to cache immediately.
   */
  public addGroup(newGroup: ApiGroup): void {
    if (!this.cache) {
      this.cache = { totalCount: 1, groups: [newGroup] };
      return;
    }
    if (!Array.isArray(this.cache.groups)) {
      this.cache.groups = [newGroup];
    } else {
      this.cache.groups = [newGroup, ...this.cache.groups];
    }
    this.cache.totalCount = this.cache.groups.length;
  }

  /**
   * Update details of a group in cache.
   */
  public updateGroup(groupId: string, updatedFields: Partial<ApiGroup>): void {
    if (!this.cache || !Array.isArray(this.cache.groups)) return;
    this.cache.groups = this.cache.groups.map((g) =>
      g.groupId === groupId ? { ...g, ...updatedFields } : g
    );
  }

  /**
   * Remove a group from cache immediately.
   */
  public removeGroup(groupId: string): void {
    if (!this.cache || !Array.isArray(this.cache.groups)) return;
    this.cache.groups = this.cache.groups.filter((g) => g.groupId !== groupId);
    this.cache.totalCount = this.cache.groups.length;
  }
}

export const groupCache = new GroupCache();
