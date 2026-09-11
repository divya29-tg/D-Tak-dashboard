import type { CandidateMember } from '../constants';
import '../../UserManagement/components/ConfirmModal.css';

interface RemoveGroupMemberModalProps {
  isOpen: boolean;
  member: CandidateMember | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveGroupMemberModal({
  isOpen,
  member,
  onClose,
  onConfirm,
}: RemoveGroupMemberModalProps) {
  if (!isOpen || !member) return null;

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title">Remove {member.name}?</h2>
        <p className="confirm-description">
          Are you sure you want to remove this user from the group?
        </p>

        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-btn-disable"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Remove User
          </button>
        </div>
      </div>
    </div>
  );
}
