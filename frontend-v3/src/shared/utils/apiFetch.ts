'use client';

// Track 403'd URLs to suppress polling spam
const blocked403: Set<string> = new Set();

// Reset blocked URLs on role switch
if (typeof window !== 'undefined') {
  window.addEventListener('role-switch', () => blocked403.clear());
}

/**
 * Обёртка fetch — добавляет x-user-role заголовок из localStorage
 * + X-Emulate-Role для superadmin эмуляции
 * + 403 suppression (stops polling after first 403)
 */
export async function apiFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  // Suppress repeated 403 polling
  const method = (opts.method || 'GET').toUpperCase();
  if (method === 'GET' && blocked403.has(url)) {
    return new Response(JSON.stringify({ error: 'Нет доступа (кэш)' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let role = 'director';
  try {
    const stored = localStorage.getItem('user');
    if (stored) {
      const u = JSON.parse(stored);
      role = u.role || 'director';
    }
  } catch {}

  const headers = new Headers(opts.headers);
  headers.set('x-user-role', role);

  // Superadmin role emulation
  if (role === 'superadmin') {
    try {
      const emulated = localStorage.getItem('emulated_role');
      if (emulated && emulated !== 'superadmin') {
        headers.set('x-emulate-role', emulated);
      }
    } catch {}
  }

  if (!headers.has('Content-Type') && opts.body && typeof opts.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...opts, headers });

  // Block future GET polls to this URL on 403
  if (res.status === 403 && method === 'GET') {
    blocked403.add(url);
  }

  return res;
}


/**
 * Like apiFetch but throws on 403 — use in usePolling callbacks
 * so the hook can detect and stop polling.
 */
export async function apiFetchJson(url: string, opts: RequestInit = {}): Promise<any> {
  const res = await apiFetch(url, opts);
  if (res.status === 403) {
    const err: any = new Error("POLLING_STOP_403");
    err.status = 403;
    throw err;
  }
  return res.json();
}
