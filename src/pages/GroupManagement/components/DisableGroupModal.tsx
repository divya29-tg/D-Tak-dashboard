import type { GroupItem } from '../types';
import '../../UserManagement/components/ConfirmModal.css';

interface DisableGroupModalProps {
  isOpen: boolean;
  group: GroupItem | null;
  onClose: () => void;
  onConfirm?: () => void;
}

export function DisableGroupModal({ isOpen, group, onClose, onConfirm }: DisableGroupModalProps) {
  if (!isOpen || !group) return null;

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title">Disable {group.groupName}?</h2>
        <p className="confirm-description">
          Are you sure you want to disable this group? Group members will lose access until re-enabled.
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
            Disable
          </button>
        </div>
      </div>
    </div>
  );
}
