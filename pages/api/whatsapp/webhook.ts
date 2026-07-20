import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import API_CONSUME from '../../../services/api-consume';
import { rateLimit, getClientIp } from '../../../utils/rate-limit';
import { guardRequest } from '../../../utils/sanitize';

/**
 * Webhook de entrada da ferramenta de WhatsApp (Poli Digital).
 * Toda mensagem recebida no WhatsApp é enviada pelo Poli para esta rota,
 * que valida a origem e repassa para a API interna (Lara).
 *
 * Autenticação: Poli Digital é configurado para enviar um header fixo
 * (WHATSAPP_WEBHOOK_HEADER, default "x-webhook-secret") com um segredo
 * definido em WHATSAPP_WEBHOOK_SECRET. A comparação é feita via hash +
 * timingSafeEqual para não vazar o segredo por timing attack.
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

const WEBHOOK_HEADER = (process.env.WHATSAPP_WEBHOOK_HEADER || 'x-webhook-secret').toLowerCase();
const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET;
const INTERNAL_ENDPOINT = 'webhooks/whatsapp';

function hash(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function isValidSecret(received: unknown): boolean {
  if (!WEBHOOK_SECRET || typeof received !== 'string' || received.length === 0) {
    return false;
  }
  // Hash antes de comparar: normaliza o tamanho dos buffers e evita
  // vazar o comprimento do segredo por timing.
  return crypto.timingSafeEqual(hash(received), hash(WEBHOOK_SECRET));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!WEBHOOK_SECRET) {
    console.error('[whatsapp/webhook] WHATSAPP_WEBHOOK_SECRET não configurado.');
    return res.status(503).json({ error: 'Webhook não configurado.' });
  }

  // Limite por IP: contém tentativas de força bruta contra o segredo antes
  // mesmo de validá-lo.
  const ip = getClientIp(req);
  const rl = rateLimit(`whatsapp-webhook:${ip}`, 60, 60_000);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Muitas requisições.' });
  }

  const receivedSecret = req.headers[WEBHOOK_HEADER];
  if (!isValidSecret(receivedSecret)) {
    console.warn(`[whatsapp/webhook] Tentativa não autorizada de ${ip}.`);
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  if (!guardRequest(req, res)) return;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Payload inválido.' });
  }

  try {
    const response = await API_CONSUME('POST', INTERNAL_ENDPOINT, {}, req.body);

    if (!response.ok) {
      console.error(`[whatsapp/webhook] API interna retornou ${response.status}: ${response.message || ''}`);
      return res.status(502).json({ error: 'Falha ao repassar mensagem para a API interna.' });
    }

    return res.status(200).json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[whatsapp/webhook] Erro ao repassar mensagem:', message);
    return res.status(502).json({ error: 'Falha ao repassar mensagem para a API interna.' });
  }
}
