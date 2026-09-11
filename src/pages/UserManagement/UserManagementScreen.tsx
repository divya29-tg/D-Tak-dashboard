import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, XCircle, Ban, Lock, Search, Plus, User, Users, MapPin, ChevronRight, LogOut, Loader2, AlertCircle } from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import { userService } from '@/services/api/users';
import { userCache } from '@/cache/userCache';
import type { ApiUser } from '@/types/api';
import { AddUserModal } from './components/AddUserModal';
import { EditUserModal } from './components/EditUserModal';
import { EnableUserModal } from './components/EnableUserModal';
import { DisableUserModal } from './components/DisableUserModal';
import { DeactivateUserModal } from './components/DeactivateUserModal';
import { ActivateUserModal } from './components/ActivateUserModal';
import { getAdminProfile } from '@/utils/adminProfile';
import './UserManagementScreen.css';

export interface UserItem {
  id: string;
  username: string;
  fullName: string;
  name: string;
  email: string;
  position: string;
  role: string;
  assignedGroup: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'DISABLED' | 'PENDING';
  lastActive: string;
  isDisabled?: boolean;
  isDeactivated?: boolean;
}

function mapApiUserToUserItem(apiUser: ApiUser): UserItem {
  const statusLower = (apiUser.status || '').toLowerCase();
  const isUserDisabled = statusLower === 'disabled';
  const isUserInactive = statusLower === 'inactive' || statusLower === 'deactivated';
  const isUserActive = statusLower === 'active';

  let displayStatus: 'ACTIVE' | 'DISABLED' | 'INACTIVE' | 'SUSPENDED' | 'PENDING' = 'ACTIVE';
  if (isUserDisabled) {
    displayStatus = 'DISABLED';
  } else if (isUserInactive || !isUserActive) {
    displayStatus = 'INACTIVE';
  }

  const username = apiUser.username || apiUser.alias;
  const displayName = apiUser.name && apiUser.name !== 'N/A' ? apiUser.name : username;
  const displayEmail = apiUser.email && apiUser.email !== 'N/A' ? apiUser.email : `${username.toLowerCase()}@centcom.mil`;

  return {
    id: apiUser.alias,
    username: username,
    fullName: displayName,
    name: displayName,
    email: displayEmail,
    position: 'Operator',
    role: 'Operator',
    assignedGroup: apiUser.groupsCount ? `${apiUser.groupsCount} Group(s)` : 'Command Staff',
    status: displayStatus,
    lastActive: 'Active',
    isDisabled: isUserDisabled,
    isDeactivated: isUserInactive,
  };
}

export function UserManagementScreen() {
  const navigate = useNavigate();
  const adminProfile = getAdminProfile();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [apiCounts, setApiCounts] = useState<{ totalCount: number; activeCount: number; disabledCount: number }>({
    totalCount: 0,
    activeCount: 0,
    disabledCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isOperationLoading, setIsOperationLoading] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [enablingUser, setEnablingUser] = useState<UserItem | null>(null);
  const [disablingUser, setDisablingUser] = useState<UserItem | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<UserItem | null>(null);
  const [activatingUser, setActivatingUser] = useState<UserItem | null>(null);

  const fetchUsers = async () => {
    const cached = userService.getCachedUsers();

    if (cached) {
      setApiCounts({
        totalCount: cached.totalCount ?? cached.users.length,
        activeCount: cached.activeCount ?? cached.users.filter((u) => u.status === 'active').length,
        disabledCount: cached.disabledCount ?? cached.users.filter((u) => u.status === 'disabled').length,
      });
      setUsers(cached.users.map(mapApiUserToUserItem));
      setIsLoading(false);

      try {
        const res = await userService.getUsers();
        setApiCounts({
          totalCount: res.totalCount ?? res.users.length,
          activeCount: res.activeCount ?? res.users.filter((u) => u.status === 'active').length,
          disabledCount: res.disabledCount ?? res.users.filter((u) => u.status === 'disabled').length,
        });
        setUsers(res.users.map(mapApiUserToUserItem));
        setApiError(null);
      } catch {
        // Keep showing cached data if background refresh fails
      }
    } else {
      try {
        setIsLoading(true);
        setApiError(null);
        const res = await userService.getUsers();
        setApiCounts({
          totalCount: res.totalCount ?? res.users.length,
          activeCount: res.activeCount ?? res.users.filter((u) => u.status === 'active').length,
          disabledCount: res.disabledCount ?? res.users.filter((u) => u.status === 'disabled').length,
        });
        setUsers(res.users.map(mapApiUserToUserItem));
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Failed to fetch users from server');
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const activeCount = apiCounts.activeCount || users.filter((u) => u.status === 'ACTIVE').length;
  const inactiveCount = apiCounts.disabledCount || users.filter((u) => u.status === 'DISABLED' || u.status === 'INACTIVE').length;
  const suspendedCount = users.filter((u) => u.status === 'SUSPENDED').length;
  const pendingCount = users.filter((u) => u.status === 'PENDING').length;

  const handleConfirmDisable = async () => {
    if (!disablingUser) return;
    const targetUsername = disablingUser.username || disablingUser.id;
    if (!targetUsername || !targetUsername.trim()) {
      throw new Error('Username is missing for selected user');
    }
    try {
      setIsOperationLoading(true);
      await userService.disableUser(targetUsername);
      const target = targetUsername.trim().toLowerCase();
      setUsers((prev) =>
        prev.map((u) => {
          const uName = (u.username || '').trim().toLowerCase();
          const uId = (u.id || '').trim().toLowerCase();
          if (uName === target || uId === target) {
            return { ...u, status: 'DISABLED', isDisabled: true };
          }
          return u;
        })
      );
      setApiCounts((prev) => ({
        ...prev,
        activeCount: Math.max(0, prev.activeCount - 1),
        disabledCount: prev.disabledCount + 1,
      }));
      void fetchUsers();
    } finally {
      setIsOperationLoading(false);
      setDisablingUser(null);
    }
  };

  const handleConfirmEnable = async () => {
    if (!enablingUser) return;
    const targetUsername = enablingUser.username || enablingUser.id;
    if (!targetUsername || !targetUsername.trim()) {
      throw new Error('Username is missing for selected user');
    }
    try {
      setIsOperationLoading(true);
      await userService.enableUser(targetUsername);
      const target = targetUsername.trim().toLowerCase();
      setUsers((prev) =>
        prev.map((u) => {
          const uName = (u.username || '').trim().toLowerCase();
          const uId = (u.id || '').trim().toLowerCase();
          if (uName === target || uId === target) {
            return { ...u, status: 'ACTIVE', isDisabled: false };
          }
          return u;
        })
      );
      setApiCounts((prev) => ({
        ...prev,
        activeCount: prev.activeCount + 1,
        disabledCount: Math.max(0, prev.disabledCount - 1),
      }));
      void fetchUsers();
    } finally {
      setIsOperationLoading(false);
      setEnablingUser(null);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingUser) return;
    const targetUsername = deactivatingUser.username || deactivatingUser.id;
    if (!targetUsername || !targetUsername.trim()) {
      throw new Error('Username is missing for selected user');
    }
    try {
      setIsOperationLoading(true);
      await userService.deleteUser(targetUsername);
      const target = targetUsername.trim().toLowerCase();
      setUsers((prev) =>
        prev.map((u) => {
          const uName = (u.username || '').trim().toLowerCase();
          const uId = (u.id || '').trim().toLowerCase();
          if (uName === target || uId === target) {
            return { ...u, status: 'INACTIVE', isDeactivated: true };
          }
          return u;
        })
      );
      setApiCounts((prev) => ({
        ...prev,
        activeCount: Math.max(0, prev.activeCount - 1),
        disabledCount: prev.disabledCount + 1,
      }));
    } finally {
      setIsOperationLoading(false);
      setDeactivatingUser(null);
    }
  };

  const handleConfirmActivate = async () => {
    if (!activatingUser) return;
    const targetUsername = activatingUser.username || activatingUser.id;
    if (!targetUsername || !targetUsername.trim()) {
      throw new Error('Username is missing for selected user');
    }
    try {
      setIsOperationLoading(true);
      await userService.activateUser(targetUsername);
      const target = targetUsername.trim().toLowerCase();
      setUsers((prev) =>
        prev.map((u) => {
          const uName = (u.username || '').trim().toLowerCase();
          const uId = (u.id || '').trim().toLowerCase();
          if (uName === target || uId === target) {
            return { ...u, status: 'ACTIVE', isDisabled: false, isDeactivated: false };
          }
          return u;
        })
      );
      setApiCounts((prev) => ({
        ...prev,
        activeCount: prev.activeCount + 1,
        disabledCount: Math.max(0, prev.disabledCount - 1),
      }));
    } finally {
      setIsOperationLoading(false);
      setActivatingUser(null);
    }
  };

  const handleAddUser = (data: {
    fullName: string;
    userName: string;
    email: string;
    position: string;
    role: string;
    assignedGroup: string;
  }) => {
    const username = data.userName.trim();
    const newUserItem: UserItem = {
      id: username,
      username: username,
      fullName: data.fullName.trim(),
      name: data.fullName.trim(),
      email: data.email.trim() || `${username.toLowerCase()}@centcom.mil`,
      position: data.position || 'Operator',
      role: data.role || 'Operator',
      assignedGroup: data.assignedGroup || 'Command Staff',
      status: 'ACTIVE',
      lastActive: 'Active',
      isDisabled: false,
      isDeactivated: false,
    };
    userCache.addUser({
      alias: username,
      username: username,
      name: data.fullName.trim(),
      email: data.email.trim(),
      status: 'active',
      deviceCount: 0,
      groupsCount: 1,
      verified: true,
    });
    setUsers((prev) => [newUserItem, ...prev]);
    setApiCounts((prev) => ({
      ...prev,
      totalCount: prev.totalCount + 1,
      activeCount: prev.activeCount + 1,
    }));
  };

  const handleEditUser = async (data: {
    fullName: string;
    userName: string;
    email: string;
    position: string;
    role: string;
    assignedGroup: string;
  }) => {
    if (!editingUser) return;
    const targetUsername = editingUser.username || editingUser.id;
    if (!targetUsername || !targetUsername.trim()) {
      throw new Error('Username is missing for selected user');
    }

    try {
      setIsOperationLoading(true);
      await userService.updateUser(targetUsername, data);

      const oldTarget = targetUsername.trim().toLowerCase();
      const newUsername = data.userName.trim();
      const newName = data.fullName.trim();
      const newEmail = data.email.trim();

      setUsers((prev) =>
        prev.map((u) => {
          const uName = (u.username || '').trim().toLowerCase();
          const uId = (u.id || '').trim().toLowerCase();
          if (uName === oldTarget || uId === oldTarget) {
            return {
              ...u,
              id: newUsername || u.id,
              username: newUsername || u.username,
              fullName: newName || u.fullName,
              name: newName || u.name,
              email: newEmail || u.email,
              position: data.position || u.position,
              role: data.role || u.role,
              assignedGroup: data.assignedGroup || u.assignedGroup,
            };
          }
          return u;
        })
      );
    } finally {
      setIsOperationLoading(false);
      setEditingUser(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      user.id.toLowerCase().includes(q) ||
      user.name.toLowerCase().includes(q) ||
      user.fullName.toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q) ||
      user.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-layout">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__brand-logo">
            <img src={dtakLogo} alt="DTAK Logo" className="sidebar__logo-img" width="48" height="48" />
            <div className="sidebar__brand-text">
              <span className="sidebar__brand-title">DTAK</span>
              <span className="sidebar__brand-subtitle">ADMIN CONSOLE</span>
            </div>
          </div>
        </div>

        <nav className="sidebar__nav">
          <div
            className="sidebar__nav-item"
            onClick={() => navigate(ROUTES.HOME)}
          >
            <MapPin size={18} className="sidebar__nav-icon" />
            <span>HOME</span>
          </div>

          <div
            className="sidebar__nav-item sidebar__nav-item--active"
            onClick={() => navigate(ROUTES.USER_MANAGEMENT)}
          >
            <div className="sidebar__active-indicator" />
            <User size={18} className="sidebar__nav-icon" />
            <span>USERS</span>
          </div>

          <div
            className="sidebar__nav-item"
            onClick={() => navigate(ROUTES.GROUP_MANAGEMENT)}
          >
            <Users size={18} className="sidebar__nav-icon" />
            <span>GROUPS</span>
          </div>
        </nav>

        <div className="sidebar__user-profile">
          <div className="sidebar__user-profile-top">
            <div className="sidebar__user-avatar">
              {adminProfile.initials ? (
                <span>{adminProfile.initials}</span>
              ) : (
                <User size={16} color="#A1A1AA" />
              )}
            </div>
            <div className="sidebar__user-info">
              {adminProfile.name && <span className="sidebar__user-name">{adminProfile.name}</span>}
              {adminProfile.role && <span className="sidebar__user-role">{adminProfile.role}</span>}
            </div>
            <ChevronRight size={16} className="sidebar__user-chevron" />
          </div>

          <div className="sidebar__user-status">
            <span className="sidebar__status-dot">●</span> SECURE SESSION · AUTH LVL 5
          </div>

          <button
            type="button"
            className="sidebar__logout-btn"
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
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1 className="dashboard-title">USER MANAGEMENT</h1>
          <div className="dashboard-header__tags">
            <span className="tag tag--net">● NET SECURE</span>
            <span className="tag tag--node">NODE: CENTCOM-ADMIN-01</span>
          </div>
        </header>

        {/* Stats Row */}
        <section className="stats-row">
          <div className="stat-card">
            <span className="stat-card__number">{activeCount}</span>
            <span className="stat-card__label stat-card__label--active">● ACTIVE</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__number">{inactiveCount}</span>
            <span className="stat-card__label stat-card__label--inactive">● INACTIVE</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__number">{suspendedCount}</span>
            <span className="stat-card__label stat-card__label--suspended">● SUSPENDED</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__number">{pendingCount}</span>
            <span className="stat-card__label stat-card__label--pending">● PENDING</span>
          </div>
        </section>

        {/* Controls Row */}
        <section className="controls-row">
          <div className="search-bar">
            <Search size={16} className="search-bar__icon" />
            <input
              type="text"
              className="search-bar__input"
              placeholder="Search name, position, group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="add-user-btn"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} />
            <span>ADD USER</span>
          </button>
        </section>

        {/* Users Table */}
        <section className="table-container">
          <div className="table-scroll-area">
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: '#8FBF3F', gap: '10px' }}>
                <Loader2 className="animate-spin" size={20} />
                <span>Loading users from server...</span>
              </div>
            ) : apiError ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', color: '#EF4444', gap: '12px' }}>
                <AlertCircle size={28} />
                <span>{apiError}</span>
                <button
                  type="button"
                  style={{ backgroundColor: '#8FBF3F', color: '#0A0A0A', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  onClick={fetchUsers}
                >
                  Retry API Request
                </button>
              </div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>NAME</th>
                    <th>ROLE</th>
                    <th>DUTY STATUS</th>
                    <th>LAST ACTIVE</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-table-cell">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="cell-id">{user.id}</td>
                        <td className="cell-name">{user.fullName}</td>
                        <td className="cell-role">{user.role}</td>
                        <td className="cell-status">
                          <span className={`status-badge status-badge--${user.status.toLowerCase()}`}>
                            ● {user.status}
                          </span>
                        </td>
                        <td className="cell-last-active">{user.lastActive}</td>
                        <td className="cell-actions">
                          <button
                            type="button"
                            className="action-btn action-btn--edit"
                            aria-label="Edit user"
                            onClick={() => setEditingUser(user)}
                            disabled={isOperationLoading}
                          >
                            <PenLine size={14} />
                          </button>

                          {user.isDisabled ? (
                            <button
                              type="button"
                              className="action-btn action-btn--blue"
                              aria-label="Enable user"
                              onClick={() => setEnablingUser(user)}
                              disabled={isOperationLoading}
                            >
                              <Lock size={20} color="#2058FF" style={{ color: '#2058FF' }} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="action-btn action-btn--warn"
                              aria-label="Disable user"
                              onClick={() => setDisablingUser(user)}
                              disabled={isOperationLoading}
                            >
                              <XCircle size={14} />
                            </button>
                          )}

                          {user.isDeactivated ? (
                            <button
                              type="button"
                              className="action-btn action-btn--blue"
                              aria-label="Activate user"
                              onClick={() => setActivatingUser(user)}
                              disabled={isOperationLoading}
                            >
                              <Lock size={20} color="#2058FF" style={{ color: '#2058FF' }} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="action-btn action-btn--disable"
                              aria-label="Deactivate user"
                              onClick={() => setDeactivatingUser(user)}
                              disabled={isOperationLoading}
                            >
                              <Ban size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          <footer className="table-footer">
            <span>SHOWING {filteredUsers.length} OF {users.length} USERS</span>
          </footer>
        </section>
      </main>

      {/* Separate Modal Components */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddUser={handleAddUser}
      />

      <EditUserModal
        key={`edit-${editingUser?.id}`}
        isOpen={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onEditUser={handleEditUser}
      />

      <EnableUserModal
        key={`enable-${enablingUser?.id}`}
        isOpen={!!enablingUser}
        user={enablingUser}
        onClose={() => setEnablingUser(null)}
        onConfirm={handleConfirmEnable}
      />

      <DisableUserModal
        key={`disable-${disablingUser?.id}`}
        isOpen={!!disablingUser}
        user={disablingUser}
        onClose={() => setDisablingUser(null)}
        onConfirm={handleConfirmDisable}
      />

      <DeactivateUserModal
        key={`deactivate-${deactivatingUser?.id}`}
        isOpen={!!deactivatingUser}
        user={deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        onConfirm={handleConfirmDeactivate}
      />

      <ActivateUserModal
        key={`activate-${activatingUser?.id}`}
        isOpen={!!activatingUser}
        user={activatingUser}
        onClose={() => setActivatingUser(null)}
        onConfirm={handleConfirmActivate}
      />
    </div>
  );
}





