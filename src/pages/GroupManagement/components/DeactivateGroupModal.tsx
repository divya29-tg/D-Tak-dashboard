import type { GroupItem } from '../types';
import '../../UserManagement/components/ConfirmModal.css';

interface DeactivateGroupModalProps {
  isOpen: boolean;
  group: GroupItem | null;
  onClose: () => void;
  onConfirm?: () => void;
}

export function DeactivateGroupModal({ isOpen, group, onClose, onConfirm }: DeactivateGroupModalProps) {
  if (!isOpen || !group) return null;

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title">Deactivate {group.groupName}?</h2>
        <p className="confirm-description">
          Are you sure you want to deactivate this group.
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
              onConfirm?.();
              onClose();
            }}
          >
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}
