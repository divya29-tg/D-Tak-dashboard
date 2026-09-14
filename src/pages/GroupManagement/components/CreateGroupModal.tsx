import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { GroupItem } from '../types';
import type { CandidateMember } from '../constants';
import { gunService } from '@/services/gunService';
import { RemoveGroupMemberModal } from './RemoveGroupMemberModal';
import { Toast } from './Toast';
import './GroupModal.css';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (group: GroupItem) => void;
  users: CandidateMember[];
}

export function CreateGroupModal({ isOpen, onClose, onCreate, users }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [assignedAdmin, setAssignedAdmin] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [selectedMemberRowId, setSelectedMemberRowId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<CandidateMember | null>(null);
  const [isAddUserPickerOpen, setIsAddUserPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: '',
  });

  if (!isOpen) return null;

  const currentAdmin = assignedAdmin || users[0]?.id || '';

  const nonMembers = users.filter((m) => !memberIds.includes(m.id) && m.id !== currentAdmin);

  const currentMembers = memberIds
    .map((id) => users.find((m) => m.id === id))
    .filter((m): m is CandidateMember => Boolean(m));

  const handleAddMember = (candidateId: string) => {
    const candidate = users.find((m) => m.id === candidateId);
    setMemberIds((prev) => [...prev, candidateId]);
    setIsAddUserPickerOpen(false);

    if (candidate) {
      setToastInfo({
        isOpen: true,
        title: 'User Added',
        message: `${candidate.name} has been added to ${groupName || 'new group'}.`,
      });
    }
  };

  const handleConfirmRemoveMember = () => {
    if (!memberToRemove) return;
    setMemberIds((prev) => prev.filter((id) => id !== memberToRemove.id));
    if (selectedMemberRowId === memberToRemove.id) {
      setSelectedMemberRowId(null);
    }
    setMemberToRemove(null);
  };

  const resetForm = () => {
    setGroupName('');
    setAssignedAdmin('');
    setMemberIds([]);
    setSelectedMemberRowId(null);
    setIsAddUserPickerOpen(false);
    setError(null);
    setToastInfo({ isOpen: false, title: '', message: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !currentAdmin) {
      setError('Group name and admin are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Create the real group on the Gun.js dchat network with the chosen admin and members.
      const groupId = await gunService.createGroup(groupName.trim(), currentAdmin, memberIds);

      onCreate({
        id: groupId,
        groupName: groupName.trim(),
        assignedAdmin: currentAdmin,
        members: memberIds,
        membersCount: memberIds.length,
        status: 'ACTIVE',
        createdDate: new Date().toISOString().split('T')[0],
        isDisabled: false,
        isDeactivated: false,
      });

      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="group-modal-backdrop" onClick={isSubmitting ? undefined : onClose}>
        <div className="group-modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="group-modal-header">
            <h2 className="group-modal-title">CREATE NEW GROUP</h2>
            <button
              type="button"
              className="group-modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
              disabled={isSubmitting}
            >
              <X size={18} />
            </button>
          </div>

          {error && (
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
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="group-modal-form">
            <div className="form-group">
              <label className="form-label">GROUP NAME</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter our group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                required
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label">ASSIGN GROUP ADMIN</label>
              <select
                className="form-select"
                value={currentAdmin}
                onChange={(e) => setAssignedAdmin(e.target.value)}
                disabled={isSubmitting || users.length === 0}
              >
                {users.length === 0 ? (
                  <option value="">No users available</option>
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
                  disabled={isSubmitting}
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
                {currentMembers.length === 0 ? (
                  <div className="empty-members">No members added yet</div>
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
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Group'}
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
