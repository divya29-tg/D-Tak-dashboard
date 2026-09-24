import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Users, MapPin, UserCheck, Server, ChevronRight, LogOut, MapPinOff } from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import { getAdminProfile } from '@/utils/adminProfile';
import { useAuth } from '@/app/router/AppRouter';
import { SharedMapView } from '@/components/map/SharedMapView';
import { mapShareLabel } from '@/utils/mapShareParsing';
import type { MapShareItem } from '@/utils/mapShareParsing';
import './SharedMapScreen.css';

interface SharedMapLocationState {
  item?: MapShareItem;
  sender?: string;
}

export function SharedMapScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const adminProfile = getAdminProfile();
  const state = (location.state || {}) as SharedMapLocationState;
  const item = state.item;

  return (
    <div className="smap-layout">
      <aside className="smap-sidebar">
        <div className="smap-sidebar__brand">
          <div className="smap-sidebar__brand-logo">
            <img src={dtakLogo} alt="DTAK Logo" className="smap-sidebar__logo-img" width="48" height="48" />
            <div className="smap-sidebar__brand-text">
              <span className="smap-sidebar__brand-title">DTAK</span>
              <span className="smap-sidebar__brand-subtitle">ADMIN CONSOLE</span>
            </div>
          </div>
        </div>

        <nav className="smap-sidebar__nav">
          <div className="smap-sidebar__nav-item" onClick={() => navigate(ROUTES.HOME)}>
            <MapPin size={18} />
            <span>HOME</span>
          </div>
          <div className="smap-sidebar__nav-item" onClick={() => navigate(ROUTES.USER_MANAGEMENT)}>
            <User size={18} />
            <span>USERS</span>
          </div>
          <div className="smap-sidebar__nav-item" onClick={() => navigate(ROUTES.GROUP_MANAGEMENT)}>
            <Users size={18} />
            <span>GROUPS</span>
          </div>
          <div className="smap-sidebar__nav-item" onClick={() => navigate(ROUTES.CONTACT_REQUESTS)}>
            <UserCheck size={18} />
            <span>REQUESTS</span>
          </div>
          <div className="smap-sidebar__nav-item" onClick={() => navigate(ROUTES.NCC)}>
            <Server size={18} />
            <span>NCC</span>
          </div>
        </nav>

        <div className="smap-sidebar__user-profile">
          <div className="smap-sidebar__user-profile-top">
            <div className="smap-sidebar__user-avatar">
              {adminProfile.initials ? <span>{adminProfile.initials}</span> : <User size={16} color="#A1A1AA" />}
            </div>
            <div className="smap-sidebar__user-info">
              {adminProfile.name && <span className="smap-sidebar__user-name">{adminProfile.name}</span>}
              {adminProfile.role && <span className="smap-sidebar__user-role">{adminProfile.role}</span>}
            </div>
            <ChevronRight size={16} className="smap-sidebar__user-chevron" />
          </div>

          <div className="smap-sidebar__user-status">
            <span className="smap-sidebar__status-dot">●</span> SECURE SESSION · AUTH LVL 5
          </div>

          <button
            type="button"
            className="smap-sidebar__logout-btn"
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

      <main className="smap-main">
        <header className="smap-header">
          <button type="button" className="smap-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <h1 className="smap-header__title">
            {item ? `SHARED ${mapShareLabel(item).toUpperCase()}` : 'SHARED MAP DATA'}
            {state.sender ? ` · FROM ${state.sender.toUpperCase()}` : ''}
          </h1>
        </header>

        <section className="smap-content">
          {item ? (
            <SharedMapView item={item} />
          ) : (
            <div className="smap-empty-state">
              <MapPinOff size={32} />
              <span>No shared map data to display. Open it from a chat message.</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
