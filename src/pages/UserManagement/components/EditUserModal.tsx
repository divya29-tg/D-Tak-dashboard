import { useState, type FormEvent } from 'react';
import { X, ChevronDown } from 'lucide-react';
import type { UserItem } from '../UserManagementScreen';
import { isAdminUser, setAdminUser, renameAdminUser } from '@/utils/adminRegistry';
import './UserModal.css';

export interface EditUserData {
  fullName: string;
  userName: string;
  email: string;
  position: string;
  role: string;
  assignedGroup: string;
  isAdmin: boolean;
}

interface EditUserModalProps {
  isOpen: boolean;
  user: UserItem | null;
  onClose: () => void;
  onEditUser?: (data: EditUserData) => Promise<void> | void;
}

const ROLE_OPTIONS = [
  'Commander',
  'Field Operator',
  'Intelligent Analyst',
  'Logistics Officer',
  'Cyber Defence Lead',
  'Comms Specialist',
  'Squad Commander',
  'Mission Planning',
  'Cyber Defense',
  'Training & Readiness',
  'Emergency Response',
  'Medical Services',
  'Operations',
];

const GROUP_OPTIONS = [
  'Command Staff',
  'Operations',
  'Cyber Defense',
  'Logistics',
  'Intelligence',
  'Field Operations',
];

export function EditUserModal({ isOpen, user, onClose, onEditUser }: EditUserModalProps) {
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [userName, setUserName] = useState(user?.username || user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [position, setPosition] = useState(user?.position || '');
  const [role, setRole] = useState(user?.role || 'Commander');
  const [assignedGroup, setAssignedGroup] = useState(user?.assignedGroup || 'Command Staff');
  const [isAdmin, setIsAdmin] = useState(isAdminUser(user?.username || user?.name || ''));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!fullName.trim() || !userName.trim()) {
      setError('Full Name and Username are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const cleanUserName = userName.trim();
      const originalUserName = (user?.username || user?.name || '').trim();
      if (originalUserName && originalUserName !== cleanUserName) {
        renameAdminUser(originalUserName, cleanUserName);
      }
      setAdminUser(cleanUserName, isAdmin);

      await onEditUser?.({
        fullName: fullName.trim(),
        userName: cleanUserName,
        email: email.trim(),
        position: position.trim(),
        role: role.trim(),
        assignedGroup: assignedGroup.trim(),
        isAdmin,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="user-modal-backdrop" onClick={isSubmitting ? undefined : onClose}>
      <div className="user-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="user-modal-header">
          <h2 className="user-modal-title">EDIT USER</h2>
          <button
            type="button"
            className="user-modal-close-btn"
            aria-label="Close Edit User Modal"
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
            <label htmlFor="edit-fullname" className="user-modal-label">
              FULL NAME
            </label>
            <input
              id="edit-fullname"
              type="text"
              className="user-modal-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="user-modal-field">
            <label htmlFor="edit-username" className="user-modal-label">
              USER NAME
            </label>
            <input
              id="edit-username"
              type="text"
              className="user-modal-input"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div className="user-modal-field">
            <label htmlFor="edit-email" className="user-modal-label">
              EMAIL
            </label>
            <input
              id="edit-email"
              type="email"
              className="user-modal-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="user-modal-field">
            <label htmlFor="edit-position" className="user-modal-label">
              POSITION/TITLE
            </label>
            <input
              id="edit-position"
              type="text"
              className="user-modal-input"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>

          <div className="user-modal-field">
            <label htmlFor="edit-role" className="user-modal-label">
              ROLE
            </label>
            <div className="user-modal-select-wrapper">
              <select
                id="edit-role"
                className="user-modal-input user-modal-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="user-modal-select-icon" />
            </div>
          </div>

          <div className="user-modal-field">
            <label htmlFor="edit-group" className="user-modal-label">
              ASSIGNED GROUP
            </label>
            <div className="user-modal-select-wrapper">
              <select
                id="edit-group"
                className="user-modal-input user-modal-select"
                value={assignedGroup}
                onChange={(e) => setAssignedGroup(e.target.value)}
              >
                {GROUP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="user-modal-select-icon" />
            </div>
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
