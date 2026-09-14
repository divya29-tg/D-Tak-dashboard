import { useEffect, useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import type { GroupItem } from '../types';
import type { CandidateMember } from '../constants';
import { gunService } from '@/services/gunService';
import { RemoveGroupMemberModal } from './RemoveGroupMemberModal';
import { Toast } from './Toast';
import './GroupModal.css';

interface EditGroupModalProps {
  isOpen: boolean;
  group: GroupItem | null;
  onClose: () => void;
  onSave: (updatedGroup: GroupItem) => void;
  users: CandidateMember[];
}

export function EditGroupModal({ isOpen, group, onClose, onSave, users }: EditGroupModalProps) {
  const [prevGroup, setPrevGroup] = useState<GroupItem | null>(null);
  const [groupName, setGroupName] = useState('');
  const [assignedAdmin, setAssignedAdmin] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [selectedMemberRowId, setSelectedMemberRowId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<CandidateMember | null>(null);
  const [isAddUserPickerOpen, setIsAddUserPickerOpen] = useState(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: '',
  });

  if (group !== prevGroup) {
    setPrevGroup(group);
    if (group) {
      setGroupName(group.groupName);
      setAssignedAdmin(group.assignedAdmin);
      // The group list only carries a member *count* (the REST list
      // endpoint doesn't return member ids), so group.members is always
      // empty here -- fetch the real roster from Gun instead.
      setMemberIds([]);
      setIsLoadingMembers(true);
      setSelectedMemberRowId(null);
      setIsAddUserPickerOpen(false);
      setMemberActionError(null);
      setToastInfo({ isOpen: false, title: '', message: '' });
    }
  }

  useEffect(() => {
    if (!group) return;
    let cancelled = false;
    setIsLoadingMembers(true);
    gunService.getGroupMembers(group.id).then((members) => {
      if (!cancelled) {
        setMemberIds(members);
        setIsLoadingMembers(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [group]);

  if (!isOpen || !group) return null;

  // Filter available roster users who are NOT yet in the group
  const nonMembers = users.filter((m) => !memberIds.includes(m.id));

  // Current group members resolved from the real user roster. A member id
  // Gun has but the REST user roster doesn't still gets shown (as its raw
  // id) rather than silently disappearing.
  const currentMembers = memberIds.map(
    (id): CandidateMember => users.find((m) => m.id === id) || { id, name: id, callsign: id }
  );

  const handleAddMember = async (candidateId: string) => {
    const candidate = users.find((m) => m.id === candidateId);
    setIsAddUserPickerOpen(false);
    setMemberActionError(null);

    try {
      // Add the member on the real Gun.js group graph, not just the local list.
      await gunService.addMemberToGroup(group.id, candidateId);
      setMemberIds((prev) => [...prev, candidateId]);

      if (candidate) {
        setToastInfo({
          isOpen: true,
          title: 'User Added',
          message: `${candidate.name} has been added to ${groupName || group.groupName}.`,
        });
      }
    } catch (err) {
      setMemberActionError(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setMemberActionError(null);

    try {
      // Remove the member from the real Gun.js group graph so they actually lose access.
      await gunService.removeMemberFromGroup(group.id, memberToRemove.id);
      setMemberIds((prev) => prev.filter((id) => id !== memberToRemove.id));
      if (selectedMemberRowId === memberToRemove.id) {
        setSelectedMemberRowId(null);
      }
    } catch (err) {
      setMemberActionError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setMemberToRemove(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    onSave({
      ...group,
      groupName: groupName.trim(),
      assignedAdmin,
      members: memberIds,
      membersCount: memberIds.length,
    });
    onClose();
  };

  return (
    <>
      <div className="group-modal-backdrop" onClick={onClose}>
        <div className="group-modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="group-modal-header">
            <h2 className="group-modal-title">EDIT GROUP</h2>
            <button
              type="button"
              className="group-modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {memberActionError && (
            <div
              style={{
                fontSize: '12px',
                color: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '8px 12px',
                textAlign: 'center',
              }}
              role="alert"
            >
              {memberActionError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="group-modal-form">
            <div className="form-group">
              <label className="form-label">GROUP NAME</label>
              <input
                type="text"
                className="form-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">ASSIGN GROUP ADMIN</label>
              <select
                className="form-select"
                value={assignedAdmin}
                onChange={(e) => setAssignedAdmin(e.target.value)}
                disabled={users.length === 0}
              >
                {users.length === 0 ? (
                  <option value={assignedAdmin}>{assignedAdmin || 'No users available'}</option>
                ) : (
                  users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.id})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <div className="members-section-header">
                <label className="form-label">GROUP MEMBERS</label>
                <button
                  type="button"
                  className="btn-add-user-trigger"
                  onClick={() => setIsAddUserPickerOpen((prev) => !prev)}
                >
                  <Plus size={14} />
                  <span>Add User</span>
                </button>

                {/* Compact Add User Popover Dropdown */}
                {isAddUserPickerOpen && (
                  <div className="add-user-popover">
                    <div className="add-user-popover-header">
                      SELECT USER TO ADD
                    </div>
                    <div className="add-user-popover-list">
                      {nonMembers.length === 0 ? (
                        <div className="add-user-popover-empty">
                          All users are already in this group
                        </div>
                      ) : (
                        nonMembers.map((candidate) => (
                          <div
                            key={candidate.id}
                            className="add-user-popover-item"
                            onClick={() => handleAddMember(candidate.id)}
                          >
                            <span className="add-user-popover-name">
                              {candidate.name}
                            </span>
                            <span className="add-user-popover-meta">
                              {candidate.callsign} / {candidate.id}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Scrollable Members List */}
              <div className="members-list-container">
                {isLoadingMembers ? (
                  <div className="empty-members">
                    <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} />
                    Loading members...
                  </div>
                ) : currentMembers.length === 0 ? (
                  <div className="empty-members">No members in this group</div>
                ) : (
                  currentMembers.map((member) => {
                    const isSelectedRow = selectedMemberRowId === member.id;
                    return (
                      <div
                        key={member.id}
                        className={`member-row ${isSelectedRow ? 'member-row--selected' : ''}`}
                        onClick={() => setSelectedMemberRowId(member.id)}
                      >
                        <div className="member-row-info">
                          <span className="member-row-name">{member.name}</span>
                          <span className="member-row-meta">
                            {member.callsign} / {member.id}
                          </span>
                        </div>

                        {isSelectedRow && (
                          <button
                            type="button"
                            className="btn-remove-user"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMemberToRemove(member);
                            }}
                          >
                            REMOVE USER
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="group-modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      <RemoveGroupMemberModal
        isOpen={!!memberToRemove}
        member={memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleConfirmRemoveMember}
      />

      <Toast
        isOpen={toastInfo.isOpen}
        title={toastInfo.title}
        message={toastInfo.message}
        onClose={() => setToastInfo((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
