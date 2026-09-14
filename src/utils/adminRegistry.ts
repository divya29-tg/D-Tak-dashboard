/**
 * Local registry of which usernames are authorized to log into the Admin Console.
 * Backed by localStorage (not sessionStorage) so it survives the forced
 * re-login-on-reload behavior in AppRouter and is available before any
 * user data has been fetched from the API/Gun.
 */
const STORAGE_KEY = 'dtak_admin_usernames';

function readSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map((u: string) => u.toLowerCase()) : []);
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
}

export function isAdminUser(username: string): boolean {
  if (!username) return false;
  return readSet().has(username.trim().toLowerCase());
}

export function setAdminUser(username: string, isAdmin: boolean): void {
  const clean = username.trim().toLowerCase();
  if (!clean) return;
  const set = readSet();
  if (isAdmin) {
    set.add(clean);
  } else {
    set.delete(clean);
  }
  writeSet(set);
}

export function renameAdminUser(oldUsername: string, newUsername: string): void {
  const oldClean = oldUsername.trim().toLowerCase();
  const newClean = newUsername.trim().toLowerCase();
  if (!oldClean || !newClean || oldClean === newClean) return;
  const set = readSet();
  if (set.has(oldClean)) {
    set.delete(oldClean);
    set.add(newClean);
    writeSet(set);
  }
}

export function getAdminUsernames(): string[] {
  return Array.from(readSet());
}
