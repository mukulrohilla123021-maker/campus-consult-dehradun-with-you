const TOKEN_STORAGE_KEY = 'cc_auth_token';
let inMemorySessionToken: string | null = null;

export function getStoredSessionToken(): string | null {
  if (inMemorySessionToken) return inMemorySessionToken;
  try {
    const val = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (val) {
      inMemorySessionToken = val;
      return val;
    }
  } catch {
    // Storage unavailable in restricted sandbox
  }
  return null;
}

export function setStoredSessionToken(token: string | null): void {
  inMemorySessionToken = token;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable in restricted sandbox
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new Error('Network error: unable to reach Campus Consult server. Please check your connection and try again.');
  }

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}

export async function downloadAuthenticatedFile(url: string, fallbackFilename: string): Promise<void> {
  const token = getStoredSessionToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    credentials: 'include',
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Download failed (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) msg = parsed.error;
    } catch {
      // Keep default message
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || fallbackFilename;
  const objUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objUrl);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (cell: string | number) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
  const csvContent = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
