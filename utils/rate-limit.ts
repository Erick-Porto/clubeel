import type { NextApiRequest } from 'next';

/**
 * Rate limiter simples em memória (janela fixa por chave).
 * Adequado para uma única instância (PM2 single process). Para escala
 * horizontal, migrar para um store compartilhado (Redis).
 */

interface Hit {
  count: number;
  resetAt: number;
}

const store = new Map<string, Hit>();

// Limpeza oportunista para evitar crescimento ilimitado do Map.
function prune(now: number) {
  if (store.size < 5000) return;
  for (const [key, hit] of store) {
    if (hit.resetAt <= now) store.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  prune(now);

  const hit = store.get(key);
  if (!hit || hit.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (hit.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }

  hit.count += 1;
  return { ok: true, retryAfter: 0 };
}

export function getClientIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length) return xff[0];
  return req.socket?.remoteAddress || 'unknown';
}
