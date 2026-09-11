// Exact API Interfaces matching backend response specifications

export interface ApiUser {
  alias: string;
  username?: string;
  name?: string;
  email?: string;
  phone?: string;
  status: string; // e.g. "active", "disabled", "inactive"
  deviceCount?: number;
  groupsCount?: number;
  verified?: boolean;
}

export interface ApiUsersResponse {
  totalCount: number;
  activeCount: number;
  disabledCount: number;
  users: ApiUser[];
}

export interface ApiUserDetail {
  alias: string;
  active: boolean;
  lastSeen?: number;
  username: string;
}

export interface ApiUserDetailResponse {
  user: ApiUserDetail;
  devices: unknown[];
  contacts: unknown[];
  groups: unknown[];
  metadata: {
    totalDevices: number;
    totalContacts: number;
    totalGroups: number;
    timestamp: number;
  };
}

export interface ApiDisableUserResponse {
  success: boolean;
  message: string;
  alias: string;
  disabledAt: number;
  reason?: string;
}

export interface ApiEnableUserResponse {
  success: boolean;
  message: string;
  alias: string;
  enabledAt: number;
}

export interface ApiDeleteUserResponse {
  success: boolean;
  message: string;
  alias: string;
  deletedAt: number;
  groupsCleanedUp?: number;
  reason?: string;
}

export interface ApiGroup {
  groupId: string;
  name: string;
  description?: string;
  memberCount: number;
  owner?: string;
  avatar?: string;
  isPublic?: boolean;
  createdAt?: number;
}

export interface ApiGroupsResponse {
  totalCount: number;
  groups: ApiGroup[];
}

export interface ApiGroupDetailResponse {
  group: {
    groupId: string;
    [key: string]: unknown;
  };
  members: unknown[];
  metadata: {
    totalMembers: number;
    admins: number;
    moderators: number;
    regularMembers: number;
    timestamp: number;
  };
}

export interface ApiDashboardResponse {
  timestamp: number;
  system: {
    uptime: number;
    platform: string;
    nodeVersion: string;
  };
  overview: {
    totalUsers: number;
    activeUsers: number;
    disabledUsers: number;
    totalGroups: number;
    totalConnections: number;
    totalMessages: number;
  };
  users: ApiUser[];
  groups: ApiGroup[];
  stats: Record<string, number>;
  recentActivity: unknown[];
}
