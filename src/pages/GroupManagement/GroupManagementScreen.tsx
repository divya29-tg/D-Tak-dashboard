import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, Ban, Lock, Search, User, Users, MapPin, UserCheck, Network, Server, ChevronRight, LogOut, Loader2, MessageSquare } from 'lucide-react';
import { ROUTES } from '@/app/router/routes';
import dtakLogo from '@/assets/dtak-logo.png';
import { groupService } from '@/services/api/groups';
import { userService } from '@/services/api/users';
import type { ApiGroup, ApiUser } from '@/types/api';
import { ChatModal } from '@/components/Chat/ChatModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { EditGroupModal } from './components/EditGroupModal';
import { DeactivateGroupModal } from './components/DeactivateGroupModal';
import { ActivateGroupModal } from './components/ActivateGroupModal';
import { getAdminProfile } from '@/utils/adminProfile';
import type { GroupItem } from './types';
import type { CandidateMember } from './constants';
import './GroupManagementScreen.css';

function mapApiUserToCandidate(apiUser: ApiUser): CandidateMember {
  const username = apiUser.username || apiUser.alias;
  const displayName = apiUser.name && apiUser.name !== 'N/A' ? apiUser.name : username;
  return { id: username, name: displayName, callsign: username };
}

export type { GroupItem };

function mapApiGroupToGroupItem(apiGroup: ApiGroup): GroupItem {
  return {
    id: apiGroup.groupId,
    groupName: apiGroup.name,
    membersCount: apiGroup.memberCount || 0,
    members: [],
    status: 'ACTIVE',
    assignedAdmin: apiGroup.owner || 'N/A',
    isDisabled: false,
    isDeactivated: false,
  };
}

export function GroupManagementScreen() {
  const navigate = useNavigate();
  const adminProfile = getAdminProfile();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [rosterUsers, setRosterUsers] = useState<CandidateMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [deactivatingGroup, setDeactivatingGroup] = useState<GroupItem | null>(null);
  const [activatingGroup, setActivatingGroup] = useState<GroupItem | null>(null);
  const [chattingGroup, setChattingGroup] = useState<GroupItem | null>(null);

  const fetchRosterUsers = async () => {
    const cached = userService.getCachedUsers();
    if (cached) {
      setRosterUsers(cached.users.map(mapApiUserToCandidate));
    }
    try {
      const res = await userService.getUsers();
      setRosterUsers(res.users.map(mapApiUserToCandidate));
    } catch {
      // Keep showing cached roster if the background refresh fails
    }
  };

  const fetchGroups = async () => {
    const cached = groupService.getCachedGroups();

    if (cached && cached.groups && cached.groups.length > 0) {
      setGroups(cached.groups.map(mapApiGroupToGroupItem));
      setIsLoading(false);

      try {
        const res = await groupService.getGroups();
        if (res.groups && res.groups.length > 0) {
          setGroups(res.groups.map(mapApiGroupToGroupItem));
        }
      } catch {
        // Keep showing cached groups if background refresh fails
      }
    } else {
      try {
        setIsLoading(true);
        const res = await groupService.getGroups();
        if (res.groups && res.groups.length > 0) {
          setGroups(res.groups.map(mapApiGroupToGroupItem));
        }
      } catch {
        // Fallback silently if API fails
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchGroups();
    void fetchRosterUsers();
  }, []);

  const handleCreateGroup = (newGroup: GroupItem) => {
    setGroups((prev) => [...prev, newGroup]);
  };

  const handleSaveEditGroup = (updatedGroup: GroupItem) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === updatedGroup.id
          ? {
              ...updatedGroup,
              membersCount: updatedGroup.members ? updatedGroup.members.length : updatedGroup.membersCount,
            }
          : g
      )
    );
  };

  const handleConfirmDeactivate = () => {
    if (!deactivatingGroup) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === deactivatingGroup.id ? { ...g, isDeactivated: true, status: 'RESTRICTED' } : g
      )
    );
    setDeactivatingGroup(null);
  };

  const handleConfirmActivate = () => {
    if (!activatingGroup) return;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === activatingGroup.id
          ? { ...g, isDeactivated: false, status: 'ACTIVE' }
          : g
      )
    );
    setActivatingGroup(null);
  };

  const filteredGroups = groups.filter((group) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      group.id.toLowerCase().includes(q) ||
      group.groupName.toLowerCase().includes(q) ||
      group.assignedAdmin.toLowerCase().includes(q) ||
      group.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="grp-layout">
      {/* Left Sidebar (240px wide) */}
      <aside className="grp-sidebar">
        <div className="grp-sidebar__brand">
          <div className="grp-sidebar__brand-logo">
            <img src={dtakLogo} alt="DTAK Logo" className="grp-sidebar__logo-img" width="48" height="48" />
            <div className="grp-sidebar__brand-text">
              <span className="grp-sidebar__brand-title">DTAK</span>
              <span className="grp-sidebar__brand-subtitle">ADMIN CONSOLE</span>
            </div>
          </div>
        </div>

        <nav className="grp-sidebar__nav">
          <div
            className="grp-sidebar__nav-item"
            onClick={() => navigate(ROUTES.HOME)}
          >
            <MapPin size={18} className="grp-sidebar__nav-icon" />
            <span>HOME</span>
          </div>

          <div
            className="grp-sidebar__nav-item"
            onClick={() => navigate(ROUTES.USER_MANAGEMENT)}
          >
            <User size={18} className="grp-sidebar__nav-icon" />
            <span>USERS</span>
          </div>

          <div
            className="grp-sidebar__nav-item grp-sidebar__nav-item--active"
            onClick={() => navigate(ROUTES.GROUP_MANAGEMENT)}
          >
            <div className="grp-sidebar__active-indicator" />
            <Users size={18} className="grp-sidebar__nav-icon" />
            <span>GROUPS</span>
          </div>

          <div
            className="grp-sidebar__nav-item"
            onClick={() => navigate(ROUTES.CONTACT_REQUESTS)}
          >
            <UserCheck size={18} className="grp-sidebar__nav-icon" />
            <span>REQUESTS</span>
          </div>

          <div
            className="grp-sidebar__nav-item"
            onClick={() => navigate(ROUTES.EDGE_NODES)}
          >
            <Network size={18} className="grp-sidebar__nav-icon" />
            <span>EDGE NODE</span>
          </div>

          <div
            className="grp-sidebar__nav-item"
            onClick={() => navigate(ROUTES.NCC)}
          >
            <Server size={18} className="grp-sidebar__nav-icon" />
            <span>NCC</span>
          </div>
        </nav>

        <div className="grp-sidebar__user-profile">
          <div className="grp-sidebar__user-profile-top">
            <div className="grp-sidebar__user-avatar">
              {adminProfile.initials ? (
                <span>{adminProfile.initials}</span>
              ) : (
                <User size={16} color="#A1A1AA" />
              )}
            </div>
            <div className="grp-sidebar__user-info">
              {adminProfile.name && <span className="grp-sidebar__user-name">{adminProfile.name}</span>}
              {adminProfile.role && <span className="grp-sidebar__user-role">{adminProfile.role}</span>}
            </div>
            <ChevronRight size={16} className="grp-sidebar__user-chevron" />
          </div>

          <div className="grp-sidebar__user-status">
            <span className="grp-sidebar__status-dot">●</span> SECURE SESSION · AUTH LVL 5
          </div>

          <button
            type="button"
            className="grp-sidebar__logout-btn"
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
      <main className="grp-main">
        {/* Header (Height: 48px) */}
        <header className="grp-header">
          <h1 className="grp-header__title">GROUP MANAGEMENT</h1>
          <div className="grp-header__tags">
            <span className="grp-tag grp-tag--net">● NET SECURE</span>
            <span className="grp-tag grp-tag--node">NODE: CENTCOM-ADMIN-01</span>
          </div>
        </header>

        {/* Toolbar (Height: 42px) */}
        <section className="grp-toolbar">
          <div className="grp-search-bar">
            <Search size={11} className="grp-search-bar__icon" />
            <input
              type="text"
              className="grp-search-bar__input"
              placeholder="Search group name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="grp-new-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + New Group
          </button>
        </section>

        {/* Table Container */}
        <section className="grp-table-container">
          <div className="grp-table-scroll">
            <table className="grp-table">
              <thead>
                <tr className="grp-table__header-row">
                  <th className="grp-col-id">ID</th>
                  <th className="grp-col-name">NAME</th>
                  <th className="grp-col-members">MEMBERS</th>
                  <th className="grp-col-status">STATUS</th>
                  <th className="grp-col-owner">OWNER/ADMIN</th>
                  <th className="grp-col-actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="grp-empty-cell">
                      <Loader2 size={16} className="grp-spinner animate-spin" /> Loading groups...
                    </td>
                  </tr>
                ) : filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="grp-empty-cell">
                      No groups found
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((group) => (
                    <tr key={group.id} className="grp-table__data-row">
                      <td className="grp-cell-id">{group.id}</td>
                      <td className="grp-cell-name">{group.groupName}</td>
                      <td className="grp-cell-members">
                        {group.members && group.members.length > 0 ? group.members.length : group.membersCount}
                      </td>
                      <td className="grp-cell-status">
                        <span className={`grp-status grp-status--${group.status.toLowerCase()}`}>
                          <span className="grp-status__dot">●</span> {group.status}
                        </span>
                      </td>
                      <td className="grp-cell-owner">{group.assignedAdmin}</td>
                      <td className="grp-cell-actions">
                        <div className="grp-actions-group">
                          <button
                            type="button"
                            className="grp-action-btn grp-action-btn--chat"
                            title="Open group chat"
                            onClick={() => setChattingGroup(group)}
                          >
                            <MessageSquare size={13} />
                          </button>

                          <button
                            type="button"
                            className="grp-action-btn grp-action-btn--edit"
                            title="Edit group"
                            onClick={() => setEditingGroup(group)}
                          >
                            <PenLine size={13} />
                          </button>

                          {group.isDeactivated ? (
                            <button
                              type="button"
                              className="grp-action-btn grp-action-btn--blue"
                              title="Activate group"
                              onClick={() => setActivatingGroup(group)}
                            >
                              <Lock size={20} color="#2058FF" style={{ color: '#2058FF' }} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="grp-action-btn grp-action-btn--danger"
                              title="Deactivate group"
                              onClick={() => setDeactivatingGroup(group)}
                            >
                              <Ban size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="grp-table-footer">
            <span>SHOWING {filteredGroups.length} OF {groups.length} GROUPS</span>
          </div>
        </section>
      </main>

      {/* Group Modals */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateGroup}
        users={rosterUsers}
      />

      <EditGroupModal
        key={`edit-${editingGroup?.id}`}
        isOpen={!!editingGroup}
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onSave={handleSaveEditGroup}
        users={rosterUsers}
      />

      <DeactivateGroupModal
        key={`deactivate-${deactivatingGroup?.id}`}
        isOpen={!!deactivatingGroup}
        group={deactivatingGroup}
        onClose={() => setDeactivatingGroup(null)}
        onConfirm={handleConfirmDeactivate}
      />

      <ActivateGroupModal
        key={`activate-${activatingGroup?.id}`}
        isOpen={!!activatingGroup}
        group={activatingGroup}
        onClose={() => setActivatingGroup(null)}
        onConfirm={handleConfirmActivate}
      />

      <ChatModal
        isOpen={!!chattingGroup}
        onClose={() => setChattingGroup(null)}
        mode="group"
        targetId={chattingGroup?.id || ''}
        targetName={chattingGroup?.groupName || ''}
      />
    </div>
  );
}

