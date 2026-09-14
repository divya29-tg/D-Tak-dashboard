import { useState } from 'react';
import type { GroupItem } from '../types';
import '../../UserManagement/components/ConfirmModal.css';

interface DeactivateGroupModalProps {
  isOpen: boolean;
  group: GroupItem | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function DeactivateGroupModal({ isOpen, group, onClose, onConfirm }: DeactivateGroupModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !group) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="confirm-backdrop" onClick={isSubmitting ? undefined : onClose}>
      <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title">Deactivate {group.groupName}?</h2>
        <p className="confirm-description">
          Are you sure you want to deactivate this group.
        </p>

        {error && <div className="confirm-error" role="alert">{error}</div>}

        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-btn-disable"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Deactivating...' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}
