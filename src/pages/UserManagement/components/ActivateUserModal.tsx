import { useState } from 'react';
import type { UserItem } from '../UserManagementScreen';
import './ConfirmModal.css';

interface ActivateUserModalProps {
  isOpen: boolean;
  user: UserItem | null;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

function formatDisplayName(name: string): string {
  if (!name) return 'User';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function ActivateUserModal({
  isOpen,
  user,
  onClose,
  onConfirm,
}: ActivateUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const displayName = formatDisplayName(user.name);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="confirm-backdrop" onClick={isSubmitting ? undefined : onClose}>
      <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
        <h2 className="confirm-title">Activate {displayName}?</h2>
        <p className="confirm-description">
          Are you sure you want to activate this user.
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
