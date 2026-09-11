import { apiClient } from './client';
import { groupCache } from '@/cache/groupCache';
import type { ApiGroupsResponse, ApiGroupDetailResponse } from '@/types/api';

export const groupService = {
  getGroups: async (): Promise<ApiGroupsResponse> => {
    const data = await apiClient.get<ApiGroupsResponse>('/groups');
    groupCache.set(data);
    return data;
  },

  getCachedGroups: (): ApiGroupsResponse | null => {
    return groupCache.get();
  },

  getGroupById: async (groupId: string): Promise<ApiGroupDetailResponse> => {
    if (!groupId || !groupId.trim()) {
      throw new Error('Group ID is required');
    }
    return apiClient.get<ApiGroupDetailResponse>(`/groups/${encodeURIComponent(groupId.trim())}`);
  },
};
