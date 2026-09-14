import { useState } from 'react';
import { FileText, Image as ImageIcon, Video, File as FileIcon, Download, Loader2, AlertCircle, MapPin } from 'lucide-react';
import {
  decryptSharedFile,
  isFileExpired,
  resolveFileCategory,
  type EncryptedFileInfo,
} from '@/utils/fileDecryption';
import './ChatFileMessage.css';

const CATEGORY_ICON = { image: ImageIcon, video: Video, document: FileText, other: FileIcon };

export function ChatFileMessage({ fileInfo }: { fileInfo: EncryptedFileInfo }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const expired = isFileExpired(fileInfo);
  const category = resolveFileCategory(fileInfo.fileType);
  const Icon = CATEGORY_ICON[category];

  const handleOpen = async () => {
    if (status === 'loading') return;
    try {
      setStatus('loading');
      setErrorMsg(null);
      const blob = await decryptSharedFile(fileInfo);
      const url = URL.createObjectURL(blob);

      if (category === 'image' || category === 'video') {
        setPreviewUrl(url);
        setStatus('ready');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setStatus('idle');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load file');
    }
  };

  if (expired) {
    return (
      <div className="chat-file-card chat-file-card--expired">
        <AlertCircle size={16} />
        <span>{fileInfo.fileName} — file has expired</span>
      </div>
    );
  }

  if (previewUrl && category === 'image') {
    return (
      <div className="chat-file-card chat-file-card--media">
        <img src={previewUrl} alt={fileInfo.fileName} className="chat-file-preview-img" />
        <span className="chat-file-name">{fileInfo.fileName}</span>
      </div>
    );
  }

  if (previewUrl && category === 'video') {
    return (
      <div className="chat-file-card chat-file-card--media">
        <video src={previewUrl} controls className="chat-file-preview-video" />
        <span className="chat-file-name">{fileInfo.fileName}</span>
      </div>
    );
  }

  return (
    <button type="button" className="chat-file-card" onClick={handleOpen} disabled={status === 'loading'}>
      {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
      <span className="chat-file-name">{fileInfo.fileName}</span>
      {status !== 'loading' && <Download size={14} className="chat-file-download-icon" />}
      {status === 'error' && <span className="chat-file-error">{errorMsg}</span>}
    </button>
  );
}

/**
 * Fallback for JSON-shaped content that isn't a recognized file payload
 * (e.g. a map-marker share this dashboard doesn't have a rendering spec
 * for yet) -- shown as a labeled, readable block instead of a raw one-line
 * JSON dump.
 */
export function ChatUnknownAttachment({ data }: { data: Record<string, unknown> }) {
  const looksLikeLocation =
    typeof data.lat === 'number' ||
    typeof data.latitude === 'number' ||
    typeof data.lng === 'number' ||
    typeof data.longitude === 'number';

  return (
    <div className="chat-file-card chat-file-card--json">
      {looksLikeLocation ? <MapPin size={16} /> : <FileText size={16} />}
      <div className="chat-json-block">
        <span className="chat-json-label">
          {looksLikeLocation ? 'Shared location (unsupported preview)' : 'Attachment (unsupported preview)'}
        </span>
        <pre className="chat-json-pre">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
