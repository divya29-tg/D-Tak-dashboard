import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import './Toast.css';

export interface ToastProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({
  isOpen,
  title,
  message,
  onClose,
  duration = 2500,
}: ToastProps) {
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="toast-container">
      <div className="toast">
        <CheckCircle2 size={18} className="toast__icon" />
        <div className="toast__content">
          <span className="toast__title">{title}</span>
          <span className="toast__message">{message}</span>
        </div>
      </div>
    </div>
  );
}
