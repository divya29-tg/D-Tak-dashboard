import { useNavigate } from 'react-router-dom';
import { User, Users, MapPin, UserCheck, Network, Server, ChevronRight, LogOut } from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import { getAdminProfile } from '@/utils/adminProfile';
import { EdgeNodeMap } from '@/components/map/EdgeNodeMap';
import { useAuth } from '@/app/router/AppRouter';
import './EdgeNodeScreen.css';

export function EdgeNodeScreen() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const adminProfile = getAdminProfile();

  return (
    <div className="enode-layout">
      {/* Sidebar */}
      <aside className="enode-sidebar">
        <div className="enode-sidebar__brand">
          <div className="enode-sidebar__brand-logo">
            <img src={dtakLogo} alt="DTAK Logo" className="enode-sidebar__logo-img" width="48" height="48" />
            <div className="enode-sidebar__brand-text">
              <span className="enode-sidebar__brand-title">DTAK</span>
              <span className="enode-sidebar__brand-subtitle">ADMIN CONSOLE</span>
            </div>
          </div>
        </div>

        <nav className="enode-sidebar__nav">
          <div className="enode-sidebar__nav-item" onClick={() => navigate(ROUTES.HOME)}>
            <MapPin size={18} className="enode-sidebar__nav-icon" />
            <span>HOME</span>
          </div>

          <div className="enode-sidebar__nav-item" onClick={() => navigate(ROUTES.USER_MANAGEMENT)}>
            <User size={18} className="enode-sidebar__nav-icon" />
            <span>USERS</span>
          </div>

          <div className="enode-sidebar__nav-item" onClick={() => navigate(ROUTES.GROUP_MANAGEMENT)}>
            <Users size={18} className="enode-sidebar__nav-icon" />
            <span>GROUPS</span>
          </div>

          <div className="enode-sidebar__nav-item" onClick={() => navigate(ROUTES.CONTACT_REQUESTS)}>
            <UserCheck size={18} className="enode-sidebar__nav-icon" />
            <span>REQUESTS</span>
          </div>

          <div
            className="enode-sidebar__nav-item enode-sidebar__nav-item--active"
            onClick={() => navigate(ROUTES.EDGE_NODES)}
          >
            <div className="enode-sidebar__active-indicator" />
            <Network size={18} className="enode-sidebar__nav-icon" />
            <span>EDGE NODE</span>
          </div>

          <div className="enode-sidebar__nav-item" onClick={() => navigate(ROUTES.NCC)}>
            <Server size={18} className="enode-sidebar__nav-icon" />
            <span>NCC</span>
          </div>
        </nav>

        <div className="enode-sidebar__user-profile">
          <div className="enode-sidebar__user-profile-top">
            <div className="enode-sidebar__user-avatar">
              {adminProfile.initials ? (
                <span>{adminProfile.initials}</span>
              ) : (
                <User size={16} color="#A1A1AA" />
              )}
            </div>
            <div className="enode-sidebar__user-info">
              {adminProfile.name && <span className="enode-sidebar__user-name">{adminProfile.name}</span>}
              {adminProfile.role && <span className="enode-sidebar__user-role">{adminProfile.role}</span>}
            </div>
            <ChevronRight size={16} className="enode-sidebar__user-chevron" />
          </div>

          <div className="enode-sidebar__user-status">
            <span className="enode-sidebar__status-dot">●</span> SECURE SESSION · AUTH LVL 5
          </div>

          <button
            type="button"
            className="enode-sidebar__logout-btn"
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
      <main className="enode-main">
        <header className="enode-header">
          <h1 className="enode-header__title">EDGE NODE NETWORK · BANGALORE</h1>
          <div className="enode-header__tags">
            <span className="enode-tag enode-tag--net">● NET SECURE</span>
            <span className="enode-tag enode-tag--node">NODE: CENTCOM-EDGE-01</span>
          </div>
        </header>

        <section className="enode-map-shell">
          <EdgeNodeMap />
        </section>
      </main>
    </div>
  );
}
