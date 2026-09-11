import { useState, type FormEvent } from 'react';
import { X, ChevronDown } from 'lucide-react';
import './UserModal.css';

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

export interface AddUserData {
  fullName: string;
  userName: string;
  email: string;
  position: string;
  role: string;
  assignedGroup: string;
}

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUser?: (data: AddUserData) => Promise<void> | void;
}

export function AddUserModal({ isOpen, onClose, onAddUser }: AddUserModalProps) {
  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState('');
  const [assignedGroup, setAssignedGroup] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!fullName.trim() || !userName.trim()) {
      setError('Full Name and Username are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onAddUser?.({
        fullName: fullName.trim(),
        userName: userName.trim(),
        email: email.trim(),
        position: position.trim(),
        role: role.trim(),
        assignedGroup: assignedGroup.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
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
            <label htmlFor="add-fullname" className="user-modal-label">
              FULL NAME
            </label>
            <input
              id="add-fullname"
              type="text"
              className="user-modal-input"
              placeholder="e.g. John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="user-modal-field">
            <label htmlFor="add-username" className="user-modal-label">
              USER NAME
            </label>
            <input
              id="add-username"
              type="text"
              className="user-modal-input"
              placeholder="e.g. alpha-01"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div className="user-modal-field">
            <label htmlFor="add-email" className="user-modal-label">
              EMAIL
            </label>
            <input
              id="add-email"
              type="email"
              className="user-modal-input"
              placeholder="e.g. alpha@centcom.mil"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="user-modal-field">
            <label htmlFor="add-position" className="user-modal-label">
              POSITION/TITLE
            </label>
            <input
              id="add-position"
              type="text"
              className="user-modal-input"
              placeholder="e.g. Field Commander"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>

          <div className="user-modal-field">
            <label htmlFor="add-role" className="user-modal-label">
              ROLE
            </label>
            <div className="user-modal-select-wrapper">
              <select
                id="add-role"
                className="user-modal-input user-modal-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="" disabled hidden>
                  Select Role
                </option>
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
            <label htmlFor="add-group" className="user-modal-label">
              ASSIGNED GROUP
            </label>
            <div className="user-modal-select-wrapper">
              <select
                id="add-group"
                className="user-modal-input user-modal-select"
                value={assignedGroup}
                onChange={(e) => setAssignedGroup(e.target.value)}
              >
                <option value="" disabled hidden>
                  Select Group
                </option>
                {GROUP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="user-modal-select-icon" />
            </div>
          </div>

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
