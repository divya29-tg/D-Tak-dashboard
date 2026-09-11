import type { GroupItem } from '../types';
import '../../UserManagement/components/ConfirmModal.css';

interface ActivateGroupModalProps {
  isOpen: boolean;
  group: GroupItem | null;
  onClose: () => void;
  onConfirm?: () => void;
}

export function ActivateGroupModal({ isOpen, group, onClose, onConfirm }: ActivateGroupModalProps) {
  if (!isOpen || !group) return null;

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title">Activate {group.groupName}?</h2>
        <p className="confirm-description">
          Your Activating {group.groupName} group. Please check before activating group
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
            className="confirm-btn-enable"
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            Activate
          </button>
        </div>
      </div>
    </div>
  );
}
