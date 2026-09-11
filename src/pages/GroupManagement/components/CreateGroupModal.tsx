import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { GroupItem } from '../types';
import { CANDIDATE_MEMBERS, ADMIN_OPTIONS, type CandidateMember } from '../constants';
import { RemoveGroupMemberModal } from './RemoveGroupMemberModal';
import { Toast } from './Toast';
import './GroupModal.css';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (group: Omit<GroupItem, 'id'>) => void;
}

export function CreateGroupModal({ isOpen, onClose, onCreate }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [assignedAdmin, setAssignedAdmin] = useState(ADMIN_OPTIONS[0]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [selectedMemberRowId, setSelectedMemberRowId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<CandidateMember | null>(null);
  const [isAddUserPickerOpen, setIsAddUserPickerOpen] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ isOpen: boolean; title: string; message: string }>({
    isOpen: false,
    title: '',
    message: '',
  });

  if (!isOpen) return null;

  const nonMembers = CANDIDATE_MEMBERS.filter((m) => !memberIds.includes(m.id));

  const currentMembers = memberIds
    .map((id) => CANDIDATE_MEMBERS.find((m) => m.id === id))
    .filter((m): m is CandidateMember => Boolean(m));

  const handleAddMember = (candidateId: string) => {
    const candidate = CANDIDATE_MEMBERS.find((m) => m.id === candidateId);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    onCreate({
      groupName: groupName.trim(),
      assignedAdmin,
      members: memberIds,
      membersCount: memberIds.length,
      status: 'ACTIVE',
      createdDate: new Date().toISOString().split('T')[0],
      isDisabled: false,
      isDeactivated: false,
    });

    setGroupName('');
    setAssignedAdmin(ADMIN_OPTIONS[0]);
    setMemberIds([]);
    setSelectedMemberRowId(null);
    setIsAddUserPickerOpen(false);
    setToastInfo({ isOpen: false, title: '', message: '' });
    onClose();
  };

  return (
    <>
      <div className="group-modal-backdrop" onClick={onClose}>
        <div className="group-modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="group-modal-header">
            <h2 className="group-modal-title">CREATE NEW GROUP</h2>
            <button
              type="button"
              className="group-modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

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
              />
            </div>

            <div className="form-group">
              <label className="form-label">ASSIGN GROUP ADMIN</label>
              <select
                className="form-select"
                value={assignedAdmin}
                onChange={(e) => setAssignedAdmin(e.target.value)}
              >
                {ADMIN_OPTIONS.map((admin) => (
                  <option key={admin} value={admin}>
                    {admin}
                  </option>
                ))}
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
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
              >
                Create Group
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
