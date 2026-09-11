import { useNavigate } from 'react-router-dom';
import { User, Users, MapPin, ChevronRight, LogOut } from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import { getAdminProfile } from '@/utils/adminProfile';
import { MapView } from '@/components/map/MapView';
import './HomeScreen.css';

export function HomeScreen() {
  const navigate = useNavigate();
  const adminProfile = getAdminProfile();

  return (
    <div className="home-layout">
      {/* Sidebar */}
      <aside className="home-sidebar">
        <div className="home-sidebar__brand">
          <div className="home-sidebar__brand-logo">
            <img src={dtakLogo} alt="DTAK Logo" className="home-sidebar__logo-img" width="48" height="48" />
            <div className="home-sidebar__brand-text">
              <span className="home-sidebar__brand-title">DTAK</span>
              <span className="home-sidebar__brand-subtitle">ADMIN CONSOLE</span>
            </div>
          </div>
        </div>

        <nav className="home-sidebar__nav">
          {/* Order 1: HOME */}
          <div
            className="home-sidebar__nav-item home-sidebar__nav-item--active"
            onClick={() => navigate(ROUTES.HOME)}
          >
            <div className="home-sidebar__active-indicator" />
            <MapPin size={18} className="home-sidebar__nav-icon" />
            <span>HOME</span>
          </div>

          {/* Order 2: USERS */}
          <div
            className="home-sidebar__nav-item"
            onClick={() => navigate(ROUTES.USER_MANAGEMENT)}
          >
            <User size={18} className="home-sidebar__nav-icon" />
            <span>USERS</span>
          </div>

          {/* Order 3: GROUPS */}
          <div
            className="home-sidebar__nav-item"
            onClick={() => navigate(ROUTES.GROUP_MANAGEMENT)}
          >
            <Users size={18} className="home-sidebar__nav-icon" />
            <span>GROUPS</span>
          </div>
        </nav>

        {/* Profile Footer */}
        <div className="home-sidebar__user-profile">
          <div className="home-sidebar__user-profile-top">
            <div className="home-sidebar__user-avatar">
              {adminProfile.initials ? (
                <span>{adminProfile.initials}</span>
              ) : (
                <User size={16} color="#A1A1AA" />
              )}
            </div>
            <div className="home-sidebar__user-info">
              {adminProfile.name && <span className="home-sidebar__user-name">{adminProfile.name}</span>}
              {adminProfile.role && <span className="home-sidebar__user-role">{adminProfile.role}</span>}
            </div>
            <ChevronRight size={16} className="home-sidebar__user-chevron" />
          </div>

          <div className="home-sidebar__user-status">
            <span className="home-sidebar__status-dot">●</span> SECURE SESSION · AUTH LVL 5
          </div>

          <button
            type="button"
            className="home-sidebar__logout-btn"
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

      {/* Main Map Content Area */}
      <main className="home-main">
        {/* Header */}
        <header className="home-header">
          <h1 className="home-header__title">MAP CONSOLE</h1>
          <div className="home-header__tags">
            <span className="home-tag home-tag--net">● NET SECURE</span>
            <span className="home-tag home-tag--node">NODE: CENTCOM-MAP-01</span>
          </div>
        </header>

        {/* Map Container */}
        <section className="home-map-container">
          <MapView />
        </section>
      </main>
    </div>
  );
}
