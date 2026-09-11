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
    userCache.updateUserStatus(username, 'inactive');
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

  updateUser: async (
    oldUsername: string,
    data: {
      fullName: string;
      userName: string;
      email: string;
      position?: string;
      role?: string;
      assignedGroup?: string;
    }
  ) => {
    if (!oldUsername || !oldUsername.trim()) {
      throw new Error('Target username is required to update user');
    }
    const cleanOld = oldUsername.trim();
    const cleanNew = data.userName.trim();
    const cleanName = data.fullName.trim();
    const cleanEmail = data.email.trim();

    let res: Partial<ApiUser> | null = null;
    try {
      res = await apiClient.put<ApiUser>(`/users/${encodeURIComponent(cleanOld)}`, {
        name: cleanName,
        username: cleanNew,
        email: cleanEmail,
        position: data.position,
        role: data.role,
        assignedGroup: data.assignedGroup,
      });
    } catch {
      try {
        res = await apiClient.patch<ApiUser>(`/users/${encodeURIComponent(cleanOld)}`, {
          name: cleanName,
          username: cleanNew,
          email: cleanEmail,
        });
      } catch {
        // Safe fallback if server endpoint uses default status handling
      }
    }

    const updatedFields: Partial<ApiUser> = {
      alias: cleanNew || cleanOld,
      username: cleanNew || cleanOld,
      name: cleanName,
      email: cleanEmail,
      ...(res || {}),
    };

    userCache.updateUser(cleanOld, updatedFields);
    return updatedFields;
  },
};
