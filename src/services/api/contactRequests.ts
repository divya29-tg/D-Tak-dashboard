import { API_CONFIG } from './config';

/**
 * Contact-request endpoints live at the API root (/api/user/:alias/contact-requests,
 * /api/contact/decline), not under the /api/admin prefix the rest of this app's
 * REST endpoints use -- so they're addressed relative to the origin, not apiClient's
 * baseUrl.
 */
const API_ROOT = API_CONFIG.baseUrl.replace(/\/api\/admin\/?$/, '');

export interface ApiContactRequest {
  requestId: string;
  from: string;
  timestamp: number;
  handled: boolean;
}

interface ContactRequestsListResponse {
  alias: string;
  requests: ApiContactRequest[];
  count: number;
  responseTime?: number;
}

interface DeclineContactRequestResponse {
  success?: boolean;
  message?: string;
  error?: string;
  from?: string;
  to?: string;
  declined?: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
  }
  return data as T;
}

export const contactRequestService = {
  /**
   * Pending (or, with includeHandled, all) contact requests addressed to `alias`.
   */
  getContactRequests: async (alias: string, includeHandled = false): Promise<ApiContactRequest[]> => {
    const qs = includeHandled ? '?includeHandled=true' : '';
    const data = await request<ContactRequestsListResponse>(
      `/api/user/${encodeURIComponent(alias)}/contact-requests${qs}`
    );
    return data.requests || [];
  },

  /**
   * Decline a pending contact request from `requesterAlias` addressed to `declinerAlias`.
   */
  declineContactRequest: async (
    requesterAlias: string,
    declinerAlias: string
  ): Promise<DeclineContactRequestResponse> => {
    return request<DeclineContactRequestResponse>('/api/contact/decline', {
      method: 'POST',
      body: JSON.stringify({ requesterAlias, declinerAlias }),
    });
  },
};
