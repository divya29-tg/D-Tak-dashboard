import type { GroupItem } from '../types';
import '../../UserManagement/components/ConfirmModal.css';

interface EnableGroupModalProps {
  isOpen: boolean;
  group: GroupItem | null;
  onClose: () => void;
  onConfirm?: () => void;
}

export function EnableGroupModal({ isOpen, group, onClose, onConfirm }: EnableGroupModalProps) {
  if (!isOpen || !group) return null;

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title">Enable {group.groupName}?</h2>
        <p className="confirm-description">
          Your Enabling {group.groupName} group. Please check before enabling group
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
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}
