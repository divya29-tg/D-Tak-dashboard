import { useState } from 'react';
import type { GroupItem } from '../types';
import '../../UserManagement/components/ConfirmModal.css';

interface ActivateGroupModalProps {
  isOpen: boolean;
  group: GroupItem | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ActivateGroupModal({ isOpen, group, onClose, onConfirm }: ActivateGroupModalProps) {
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
      setError(err instanceof Error ? err.message : 'Failed to activate group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="confirm-backdrop" onClick={isSubmitting ? undefined : onClose}>
      <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title">Activate {group.groupName}?</h2>
        <p className="confirm-description">
          Your Activating {group.groupName} group. Please check before activating group
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
            className="confirm-btn-enable"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Activating...' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  );
}
