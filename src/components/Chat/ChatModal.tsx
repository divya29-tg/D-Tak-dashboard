import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, User, Users as UsersIcon } from 'lucide-react';
import { gunService, type GunMessage } from '@/services/gunService';
import { ChatFileMessage, ChatUnknownAttachment } from './ChatFileMessage';
import { ChatMapShareMessage } from './ChatMapShareMessage';
import { parseFileMessage, parseUnknownJson } from '@/utils/fileDecryption';
import { parseMapShare } from '@/utils/mapShareParsing';
import { ROUTES } from '@/app/router/routes';
import './ChatModal.css';

export interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'direct' | 'group';
  targetId: string;
  targetName: string;
}

export function ChatModal({ isOpen, onClose, mode, targetId, targetName }: ChatModalProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<GunMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentUser = gunService.getCurrentUser();
  const currentAlias: string | undefined = currentUser?.is?.alias;

  useEffect(() => {
    if (!isOpen || !targetId) return;

    setMessages([]);
    setError(null);
    setDraft('');

    if (mode === 'direct') {
      gunService.loadDirectMessages(targetId, setMessages);
    } else {
      gunService.loadGroupMessages(targetId, setMessages);
    }
    // Gun subscriptions are additive (no explicit teardown in gunService),
    // so a fresh subscription is only started when the target actually changes.
  }, [isOpen, mode, targetId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    try {
      setIsSending(true);
      setError(null);
      if (mode === 'direct') {
        await gunService.sendDirectMessage(targetId, text);
      } else {
        await gunService.sendGroupMessage(targetId, text);
      }
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chat-modal-backdrop" onClick={onClose}>
      <div className="chat-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <div className="chat-modal-header__info">
            <span className="chat-modal-header__icon">
              {mode === 'direct' ? <User size={16} /> : <UsersIcon size={16} />}
            </span>
            <div className="chat-modal-header__text">
              <span className="chat-modal-title">{targetName}</span>
              <span className="chat-modal-subtitle">
                {mode === 'direct' ? 'DIRECT MESSAGE' : 'GROUP CHAT'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="chat-modal-close-btn"
            onClick={onClose}
            aria-label="Close chat"
          >
            <X size={18} />
          </button>
        </div>

        <div className="chat-modal-messages">
          {messages.length === 0 ? (
            <div className="chat-modal-empty">No messages yet. Start the conversation.</div>
          ) : (
            messages.map((msg) => {
              const isOwn = Boolean(currentAlias) && msg.sender === currentAlias;
              const fileInfo = parseFileMessage(msg.content);
              const mapShare = !fileInfo ? parseMapShare(msg.content) : null;
              const unknownJson = !fileInfo && !mapShare ? parseUnknownJson(msg.content) : null;
              return (
                <div
                  key={msg.id}
                  className={`chat-bubble-row ${isOwn ? 'chat-bubble-row--own' : ''}`}
                >
                  <div className={`chat-bubble ${isOwn ? 'chat-bubble--own' : ''}`}>
                    {!isOwn && mode === 'group' && (
                      <span className="chat-bubble__sender">{msg.sender}</span>
                    )}
                    {fileInfo ? (
                      <ChatFileMessage fileInfo={fileInfo} />
                    ) : mapShare ? (
                      <ChatMapShareMessage
                        item={mapShare}
                        onView={() => {
                          onClose();
                          navigate(ROUTES.HOME, { state: { focusItem: mapShare, focusSender: msg.sender } });
                        }}
                      />
                    ) : unknownJson ? (
                      <ChatUnknownAttachment data={unknownJson} />
                    ) : (
                      <span className="chat-bubble__text">{msg.content}</span>
                    )}
                    <span className="chat-bubble__time">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="chat-modal-error" role="alert">
            {error}
          </div>
        )}

        <form className="chat-modal-input-row" onSubmit={handleSend}>
          <input
            type="text"
            className="chat-modal-input"
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isSending}
          />
          <button
            type="submit"
            className="chat-modal-send-btn"
            disabled={isSending || !draft.trim()}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
