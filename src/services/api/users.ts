import { apiClient } from './client';
import { userCache } from '@/cache/userCache';
import type {
  ApiUsersResponse,
  ApiUserDetailResponse,
  ApiDisableUserResponse,
  ApiEnableUserResponse,
  ApiDeleteUserResponse,
} from '@/types/api';

export const userService = {
  getUsers: async (): Promise<ApiUsersResponse> => {
    const data = await apiClient.get<ApiUsersResponse>('/users');
    userCache.set(data);
    return data;
  },

  getCachedUsers: (): ApiUsersResponse | null => {
    return userCache.get();
  },

  clearCache: (): void => {
    userCache.clear();
  },

  getUserByUsername: async (username: string): Promise<ApiUserDetailResponse> => {
    if (!username || !username.trim()) {
      throw new Error('Username is required');
    }
    return apiClient.get<ApiUserDetailResponse>(`/users/${encodeURIComponent(username.trim())}`);
  },

  disableUser: async (username: string, reason = 'No reason provided'): Promise<ApiDisableUserResponse> => {
    if (!username || !username.trim()) {
      throw new Error('Username is required to disable user');
    }
    const res = await apiClient.post<ApiDisableUserResponse>(`/users/${encodeURIComponent(username.trim())}/disable`, {
      reason,
    });
    userCache.updateUserStatus(username, 'disabled');
    return res;
  },

  enableUser: async (username: string): Promise<ApiEnableUserResponse> => {
    if (!username || !username.trim()) {
      throw new Error('Username is required to enable user');
    }
    const res = await apiClient.post<ApiEnableUserResponse>(`/users/${encodeURIComponent(username.trim())}/enable`);
    userCache.updateUserStatus(username, 'active');
    return res;
  },

  deleteUser: async (username: string, reason = 'not required'): Promise<ApiDeleteUserResponse> => {
    if (!username || !username.trim()) {
      throw new Error('Username is required to delete user');
    }
    const res = await apiClient.delete<ApiDeleteUserResponse>(`/users/${encodeURIComponent(username.trim())}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirm: true, reason }),
    });
    userCache.removeUser(username);
    return res;
  },

  activateUser: async (username: string): Promise<ApiEnableUserResponse> => {
    if (!username || !username.trim()) {
      throw new Error('Username is required to activate user');
    }
    const res = await apiClient.post<ApiEnableUserResponse>(`/users/${encodeURIComponent(username.trim())}/enable`);
    userCache.updateUserStatus(username, 'active');
    return res;
  },
};
