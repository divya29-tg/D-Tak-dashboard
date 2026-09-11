import { apiClient } from './client';
import type { ApiDashboardResponse } from '@/types/api';

export const dashboardService = {
  getDashboard: async (): Promise<ApiDashboardResponse> => {
    return apiClient.get<ApiDashboardResponse>('/dashboard');
  },
};
