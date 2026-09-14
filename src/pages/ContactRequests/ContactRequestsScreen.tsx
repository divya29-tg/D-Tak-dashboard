import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Users, MapPin, UserCheck, Network, Server, ChevronRight, LogOut, Check, X, Loader2 } from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import { gunService } from '@/services/gunService';
import { contactRequestService } from '@/services/api/contactRequests';
import { getAdminProfile } from '@/utils/adminProfile';
import { useAuth } from '@/app/router/AppRouter';
import './ContactRequestsScreen.css';

type RequestStatus = 'pending' | 'accepted' | 'declined';

interface ContactRequestItem {
  id: string;
  from: string;
  timestamp: number;
  status: RequestStatus;
}

// How often to re-poll the (REST, not live) pending-requests list.
const POLL_INTERVAL_MS = 5000;

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
}

function getMyUsername(): string {
  return gunService.getCurrentUser()?.is?.alias || sessionStorage.getItem('dtak_admin_id') || '';
}

export function ContactRequestsScreen() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const adminProfile = getAdminProfile();
  const [requests, setRequests] = useState<Record<string, ContactRequestItem>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const actionedIdsRef = useRef<Set<string>>(new Set());

  const fetchPending = useCallback(async () => {
    const myUsername = getMyUsername();
    if (!myUsername) return;

    try {
      const pending = await contactRequestService.getContactRequests(myUsername);
      setLoadError(null);
      setRequests((prev) => {
        const next = { ...prev };
        for (const r of pending) {
          // Don't let a slightly-stale poll response resurrect a request this
          // admin already accepted/declined locally moments ago.
          if (actionedIdsRef.current.has(r.requestId)) continue;
          next[r.requestId] = { id: r.requestId, from: r.from, timestamp: r.timestamp, status: 'pending' };
        }
        return next;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load contact requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();
    const interval = setInterval(() => void fetchPending(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleAccept = async (request: ContactRequestItem) => {
    const myUsername = getMyUsername();
    if (!myUsername) return;
    try {
      setActioningId(request.id);
      await gunService.acceptContactRequest(request.id, myUsername, request.from);
      actionedIdsRef.current.add(request.id);
      setRequests((prev) => ({ ...prev, [request.id]: { ...prev[request.id], status: 'accepted' } }));
    } catch (err) {
      console.error('Failed to accept contact request:', err);
    } finally {
      setActioningId(null);
    }
  };

  const handleDecline = async (request: ContactRequestItem) => {
    const myUsername = getMyUsername();
    if (!myUsername) return;
    try {
      setActioningId(request.id);
      await contactRequestService.declineContactRequest(request.from, myUsername);
      actionedIdsRef.current.add(request.id);
      setRequests((prev) => ({ ...prev, [request.id]: { ...prev[request.id], status: 'declined' } }));
    } catch (err) {
      console.error('Failed to decline contact request:', err);
    } finally {
      setActioningId(null);
    }
  };

  const allRequests = Object.values(requests).sort((a, b) => b.timestamp - a.timestamp);

  const filteredRequests = allRequests.filter((request) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return request.from.toLowerCase().includes(q);
  });

  const pendingCount = allRequests.filter((r) => r.status === 'pending').length;
  const acceptedCount = allRequests.filter((r) => r.status === 'accepted').length;
  const declinedCount = allRequests.filter((r) => r.status === 'declined').length;

  return (
    <div className="creq-layout">
      {/* Left Sidebar */}
      <aside className="creq-sidebar">
        <div className="creq-sidebar__brand">
          <div className="creq-sidebar__brand-logo">
            <img src={dtakLogo} alt="DTAK Logo" className="creq-sidebar__logo-img" width="48" height="48" />
            <div className="creq-sidebar__brand-text">
              <span className="creq-sidebar__brand-title">DTAK</span>
              <span className="creq-sidebar__brand-subtitle">ADMIN CONSOLE</span>
            </div>
          </div>
        </div>

        <nav className="creq-sidebar__nav">
          <div className="creq-sidebar__nav-item" onClick={() => navigate(ROUTES.HOME)}>
            <MapPin size={18} className="creq-sidebar__nav-icon" />
            <span>HOME</span>
          </div>

          <div className="creq-sidebar__nav-item" onClick={() => navigate(ROUTES.USER_MANAGEMENT)}>
            <User size={18} className="creq-sidebar__nav-icon" />
            <span>USERS</span>
          </div>

          <div className="creq-sidebar__nav-item" onClick={() => navigate(ROUTES.GROUP_MANAGEMENT)}>
            <Users size={18} className="creq-sidebar__nav-icon" />
            <span>GROUPS</span>
          </div>

          <div
            className="creq-sidebar__nav-item creq-sidebar__nav-item--active"
            onClick={() => navigate(ROUTES.CONTACT_REQUESTS)}
          >
            <div className="creq-sidebar__active-indicator" />
            <UserCheck size={18} className="creq-sidebar__nav-icon" />
            <span>REQUESTS</span>
            {pendingCount > 0 && <span className="creq-sidebar__nav-badge">{pendingCount}</span>}
          </div>

          <div className="creq-sidebar__nav-item" onClick={() => navigate(ROUTES.EDGE_NODES)}>
            <Network size={18} className="creq-sidebar__nav-icon" />
            <span>EDGE NODE</span>
          </div>

          <div className="creq-sidebar__nav-item" onClick={() => navigate(ROUTES.NCC)}>
            <Server size={18} className="creq-sidebar__nav-icon" />
            <span>NCC</span>
          </div>
        </nav>

        <div className="creq-sidebar__user-profile">
          <div className="creq-sidebar__user-profile-top">
            <div className="creq-sidebar__user-avatar">
              {adminProfile.initials ? (
                <span>{adminProfile.initials}</span>
              ) : (
                <User size={16} color="#A1A1AA" />
              )}
            </div>
            <div className="creq-sidebar__user-info">
              {adminProfile.name && <span className="creq-sidebar__user-name">{adminProfile.name}</span>}
              {adminProfile.role && <span className="creq-sidebar__user-role">{adminProfile.role}</span>}
            </div>
            <ChevronRight size={16} className="creq-sidebar__user-chevron" />
          </div>

          <div className="creq-sidebar__user-status">
            <span className="creq-sidebar__status-dot">●</span> SECURE SESSION · AUTH LVL 5
          </div>

          <button
            type="button"
            className="creq-sidebar__logout-btn"
            onClick={() => {
              logout();
              navigate(ROUTES.LOGIN);
            }}
          >
            <span>Logout</span>
            <LogOut size={14} color="#E5484D" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="creq-main">
        <header className="creq-header">
          <h1 className="creq-header__title">CONTACT REQUESTS</h1>
          <div className="creq-header__tags">
            <span className="creq-tag creq-tag--net">● NET SECURE</span>
            <span className="creq-tag creq-tag--node">NODE: CENTCOM-ADMIN-01</span>
          </div>
        </header>

        <section className="creq-stats-row">
          <div className="creq-stat-card">
            <span className="creq-stat-card__number">{pendingCount}</span>
            <span className="creq-stat-card__label creq-stat-card__label--pending">● PENDING</span>
          </div>
          <div className="creq-stat-card">
            <span className="creq-stat-card__number">{acceptedCount}</span>
            <span className="creq-stat-card__label creq-stat-card__label--accepted">● ACCEPTED</span>
          </div>
          <div className="creq-stat-card">
            <span className="creq-stat-card__number">{declinedCount}</span>
            <span className="creq-stat-card__label creq-stat-card__label--declined">● DECLINED</span>
          </div>
        </section>

        {loadError && (
          <div style={{ color: '#FF4D4D', fontSize: 12 }}>
            {loadError} — retrying every {POLL_INTERVAL_MS / 1000}s
          </div>
        )}

        <section className="creq-toolbar">
          <div className="creq-search-bar">
            <Search size={11} className="creq-search-bar__icon" />
            <input
              type="text"
              className="creq-search-bar__input"
              placeholder="Search requester username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </section>

        <section className="creq-table-container">
          <div className="creq-table-scroll">
            <table className="creq-table">
              <thead>
                <tr className="creq-table__header-row">
                  <th>FROM (MOBILE USER)</th>
                  <th>REQUESTED</th>
                  <th className="creq-cell-status">STATUS</th>
                  <th className="creq-cell-actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="creq-empty-cell">
                      <Loader2 size={16} className="animate-spin" /> Loading contact requests...
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="creq-empty-cell">
                      No contact requests found
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((request) => (
                    <tr key={request.id} className="creq-table__data-row">
                      <td className="creq-cell-from">{request.from}</td>
                      <td className="creq-cell-timestamp">{formatTimestamp(request.timestamp)}</td>
                      <td className="creq-cell-status">
                        <span className={`creq-status creq-status--${request.status}`}>
                          <span className="creq-status__dot">●</span> {request.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="creq-cell-actions">
                        {request.status === 'accepted' ? (
                          <span className="creq-accepted-label">
                            <Check size={14} /> Contact added
                          </span>
                        ) : request.status === 'declined' ? (
                          <span className="creq-declined-label">
                            <X size={14} /> Declined
                          </span>
                        ) : (
                          <div className="creq-actions-group">
                            <button
                              type="button"
                              className="creq-accept-btn"
                              onClick={() => handleAccept(request)}
                              disabled={actioningId === request.id}
                            >
                              {actioningId === request.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              className="creq-decline-btn"
                              onClick={() => handleDecline(request)}
                              disabled={actioningId === request.id}
                            >
                              <X size={14} />
                              <span>Decline</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <footer className="creq-table-footer">
            <span>
              SHOWING {filteredRequests.length} OF {allRequests.length} REQUESTS
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}
