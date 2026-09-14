import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Users, MapPin, UserCheck, Network, Server, ChevronRight, LogOut, Check, Loader2 } from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import { gunService } from '@/services/gunService';
import { getAdminProfile } from '@/utils/adminProfile';
import './ContactRequestsScreen.css';

interface ContactRequestItem {
  id: string;
  from: string;
  timestamp: number;
  handled: boolean;
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
}

export function ContactRequestsScreen() {
  const navigate = useNavigate();
  const adminProfile = getAdminProfile();
  const [requests, setRequests] = useState<Record<string, ContactRequestItem>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    const myUsername = gunService.getCurrentUser()?.is?.alias || sessionStorage.getItem('dtak_admin_id') || '';
    if (!myUsername) return;

    gunService.listenContactRequestsForUser(myUsername, (request) => {
      setRequests((prev) => ({ ...prev, [request.id]: request }));
    });
  }, []);

  const handleAccept = async (request: ContactRequestItem) => {
    const myUsername = gunService.getCurrentUser()?.is?.alias || sessionStorage.getItem('dtak_admin_id') || '';
    if (!myUsername) return;
    try {
      setAcceptingId(request.id);
      await gunService.acceptContactRequest(request.id, myUsername, request.from);
      setRequests((prev) => ({
        ...prev,
        [request.id]: { ...prev[request.id], handled: true },
      }));
    } catch (err) {
      console.error('Failed to accept contact request:', err);
    } finally {
      setAcceptingId(null);
    }
  };

  const allRequests = Object.values(requests).sort((a, b) => b.timestamp - a.timestamp);

  const filteredRequests = allRequests.filter((request) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return request.from.toLowerCase().includes(q);
  });

  const pendingCount = allRequests.filter((r) => !r.handled).length;
  const acceptedCount = allRequests.filter((r) => r.handled).length;

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
              sessionStorage.removeItem('dtak_admin_id');
              sessionStorage.removeItem('dtak_admin_name');
              sessionStorage.removeItem('dtak_admin_role');
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
        </section>

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
                {filteredRequests.length === 0 ? (
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
                        <span className={`creq-status creq-status--${request.handled ? 'accepted' : 'pending'}`}>
                          <span className="creq-status__dot">●</span> {request.handled ? 'ACCEPTED' : 'PENDING'}
                        </span>
                      </td>
                      <td className="creq-cell-actions">
                        {request.handled ? (
                          <span className="creq-accepted-label">
                            <Check size={14} /> Contact added
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="creq-accept-btn"
                            onClick={() => handleAccept(request)}
                            disabled={acceptingId === request.id}
                          >
                            {acceptingId === request.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            <span>Accept</span>
                          </button>
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
