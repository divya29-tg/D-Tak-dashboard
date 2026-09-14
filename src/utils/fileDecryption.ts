/**
 * Fetch + decrypt files shared over chat, matching the exact AES-GCM scheme
 * the dchat clients (app.js's encryptAndUploadFile / receiveAndDecryptFile)
 * use to share files via the IPFS pinning backend: a random AES-256-GCM key
 * encrypts the file, the raw key is base64-encoded alongside the IV into the
 * chat message JSON, and the ciphertext itself is pinned to IPFS by cid.
 */
const IPFS_BACKEND_URL = 'https://dcomm-ipfs-pinata.trustgrid.com';

export interface EncryptedFileInfo {
  cid: string;
  encryptedSymKey: string;
  iv: string;
  fileName: string;
  fileType?: string;
  expiryTime?: number;
}

/**
 * Parse a chat message's `content` as a shared-file payload. Returns null
 * for plain text messages or any other JSON shape (e.g. a future map-marker
 * payload) this doesn't recognize.
 */
export function parseFileMessage(content: string): EncryptedFileInfo | null {
  if (!content || content[0] !== '{') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof (parsed as Record<string, unknown>).cid === 'string' &&
    typeof (parsed as Record<string, unknown>).encryptedSymKey === 'string' &&
    typeof (parsed as Record<string, unknown>).iv === 'string' &&
    typeof (parsed as Record<string, unknown>).fileName === 'string'
  ) {
    return parsed as EncryptedFileInfo;
  }
  return null;
}

/** True JSON content that isn't a recognized shape (e.g. a map-marker payload). */
export function parseUnknownJson(content: string): Record<string, unknown> | null {
  if (!content || content[0] !== '{') return null;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function isFileExpired(fileInfo: EncryptedFileInfo): boolean {
  return Boolean(fileInfo.expiryTime) && fileInfo.expiryTime! < Date.now();
}

export type FileCategory = 'image' | 'video' | 'document' | 'other';

/**
 * app.js's mobile/web senders don't agree on what goes in `fileType` --
 * sometimes a broad category ('image'/'video'/'document'), sometimes a full
 * MIME string ('image/png') -- so this accepts either.
 */
export function resolveFileCategory(fileType: string | undefined): FileCategory {
  if (!fileType) return 'other';
  if (fileType === 'image' || fileType.startsWith('image/')) return 'image';
  if (fileType === 'video' || fileType.startsWith('video/')) return 'video';
  if (fileType === 'document' || fileType.startsWith('application/') || fileType.startsWith('text/')) return 'document';
  return 'other';
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Resolve the cid to a fetchable URL, download the ciphertext, and decrypt
 * it with AES-GCM using the key/iv carried in the message -- same algorithm
 * and parameters as app.js's receiveAndDecryptFile.
 */
export async function decryptSharedFile(fileInfo: EncryptedFileInfo): Promise<Blob> {
  const metaRes = await fetch(`${IPFS_BACKEND_URL}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid: fileInfo.cid }),
  });
  if (!metaRes.ok) {
    throw new Error(`Failed to resolve file: ${metaRes.statusText}`);
  }
  const { result: fileUrl } = await metaRes.json();

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to download file: ${fileRes.statusText}`);
  }
  const encryptedBuffer = await fileRes.arrayBuffer();

  const symKey = await crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(fileInfo.encryptedSymKey),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArrayBuffer(fileInfo.iv) },
    symKey,
    encryptedBuffer
  );

  const mimeType = fileInfo.fileType && fileInfo.fileType.includes('/') ? fileInfo.fileType : undefined;
  return new Blob([decrypted], mimeType ? { type: mimeType } : undefined);
}
