import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { gunService } from '@/services/gunService';
import { setAdminUser } from '@/utils/adminRegistry';
import './UserModal.css';

export interface AddUserData {
  userName: string;
  isAdmin: boolean;
}

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUser?: (data: AddUserData) => Promise<void> | void;
}

export function AddUserModal({ isOpen, onClose, onAddUser }: AddUserModalProps) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanUserName = userName.trim();

    if (!cleanUserName || !password) {
      setError('Username and Password are required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Create the real Gun.js account so this user can log in to dchat immediately.
      await gunService.registerUser(cleanUserName, password);

      setAdminUser(cleanUserName, isAdmin);

      await onAddUser?.({ userName: cleanUserName, isAdmin });

      setUserName('');
      setPassword('');
      setIsAdmin(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="user-modal-backdrop" onClick={isSubmitting ? undefined : onClose}>
      <div className="user-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="user-modal-header">
          <h2 className="user-modal-title">ADD USER</h2>
          <button
            type="button"
            className="user-modal-close-btn"
            aria-label="Close Add User Modal"
            onClick={onClose}
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
              margin: '0 24px 12px 24px',
              textAlign: 'center',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        <form className="user-modal-form" onSubmit={handleSubmit}>
          <div className="user-modal-field">
            <label htmlFor="add-username" className="user-modal-label">
              USER NAME
            </label>
            <input
              id="add-username"
              type="text"
              className="user-modal-input"
              placeholder="e.g. alpha-01"
              autoComplete="username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="user-modal-field">
            <label htmlFor="add-password" className="user-modal-label">
              PASSWORD
            </label>
            <input
              id="add-password"
              type="password"
              className="user-modal-input"
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <label className="user-modal-checkbox-field">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              disabled={isSubmitting}
            />
            <span>Grant Admin Access (can log into the Admin Console)</span>
          </label>

          <div className="user-modal-actions">
            <button
              type="button"
              className="user-modal-btn-discard"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Discard
            </button>
            <button type="submit" className="user-modal-btn-save" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
