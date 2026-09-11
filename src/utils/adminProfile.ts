export interface AdminProfile {
  name: string;
  role: string;
  initials: string;
}

export function getAdminInitials(name: string): string {
  if (!name || !name.trim()) return '';
  const cleanName = name.replace(/^(gen\.|col\.|maj\.|capt\.|lt\.|sgt\.|cpt\.|dr\.)\s+/i, '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAdminProfile(): AdminProfile {
  if (typeof window === 'undefined') {
    return { name: '', role: '', initials: '' };
  }

  const storedAdminName = sessionStorage.getItem('dtak_admin_name');
  const storedAdminId = sessionStorage.getItem('dtak_admin_id');
  const storedAdminRole = sessionStorage.getItem('dtak_admin_role');

  const name = storedAdminName || storedAdminId || '';
  const role = storedAdminRole || '';
  const initials = getAdminInitials(name);

  return {
    name,
    role,
    initials,
  };
}
