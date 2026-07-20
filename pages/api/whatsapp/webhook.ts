import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import API_CONSUME from '../../../services/api-consume';
import { rateLimit, getClientIp } from '../../../utils/rate-limit';
import { assertNoInjection, InjectionError } from '../../../utils/sanitize';

/**
 * Webhook de entrada da ferramenta de WhatsApp (Poli Digital).
 * Toda mensagem recebida no WhatsApp é enviada pelo Poli para esta rota,
 * que valida a origem e repassa para a API interna (Lara).
 *
 * Camadas de autenticação (com base num payload real capturado do Poli):
 *
 * 1) x-webhook-verify-token: token estático enviado em todo request,
 *    comparado contra WHATSAPP_WEBHOOK_VERIFY_TOKEN (hash + timingSafeEqual).
 *    Esta é a validação OBRIGATÓRIA e confirmada — sem ela, 401.
 *
 * 2) x-webhook-signature (formato "t=<timestamp>,v1=<hmac-sha256-hex>"):
 *    camada extra, só é exigida se WHATSAPP_WEBHOOK_SIGNING_SECRET estiver
 *    configurado. IMPORTANTE: não há documentação pública do Poli Digital
 *    confirmando a string exata assinada; a implementação abaixo segue a
 *    convenção mais comum (usada por Stripe e outros que adotam o mesmo
 *    formato de header "t=,v1="): HMAC-SHA256("<timestamp>.<corpo bruto>").
 *    Confirme com o suporte/painel do Poli antes de habilitar esta camada
 *    em produção — enquanto não confirmado, deixe
 *    WHATSAPP_WEBHOOK_SIGNING_SECRET vazio para não bloquear webhooks
 *    legítimos por um algoritmo não verificado.
 */

// bodyParser desligado: precisamos dos bytes brutos do corpo para calcular
// o HMAC corretamente (reserializar o JSON quebraria a assinatura).
export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BODY_BYTES = 1_000_000; // 1MB
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60; // janela contra replay

const VERIFY_TOKEN_HEADER = 'x-webhook-verify-token';
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

const SIGNATURE_HEADER = 'x-webhook-signature';
const SIGNING_SECRET = process.env.WHATSAPP_WEBHOOK_SIGNING_SECRET;

const INTERNAL_ENDPOINT = 'webhooks/whatsapp';

function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function timingSafeStringEqual(a: string, b: string): boolean {
  // Hash antes de comparar: normaliza o tamanho dos buffers e evita vazar
  // o comprimento do valor esperado por timing.
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

function readRawBody(req: NextApiRequest, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Payload excede o tamanho máximo.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isValidVerifyToken(received: unknown): boolean {
  if (!VERIFY_TOKEN || typeof received !== 'string' || received.length === 0) {
    return false;
  }
  return timingSafeStringEqual(received, VERIFY_TOKEN);
}

/**
 * Retorna true se a assinatura for válida, false se inválida. Retorna
 * "skip" se a verificação estiver desabilitada (sem SIGNING_SECRET
 * configurado) — nesse caso o chamador segue sem essa camada extra.
 */
function verifySignature(header: unknown, rawBody: Buffer): 'ok' | 'invalid' | 'skip' {
  if (!SIGNING_SECRET) return 'skip';
  if (typeof header !== 'string' || header.length === 0) return 'invalid';

  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k?.trim(), v?.trim()];
    })
  );

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature || !/^\d+$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) {
    return 'invalid';
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) {
    return 'invalid';
  }

  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody]);
  const expected = crypto.createHmac('sha256', SIGNING_SECRET).update(signedPayload).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature.toLowerCase(), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return 'invalid';
  }
  return 'ok';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!VERIFY_TOKEN) {
    console.error('[whatsapp/webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado.');
    return res.status(503).json({ error: 'Webhook não configurado.' });
  }

  // Limite por IP: contém tentativas de força bruta contra o token antes
  // mesmo de validá-lo.
  const ip = getClientIp(req);
  const rl = rateLimit(`whatsapp-webhook:${ip}`, 60, 60_000);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Muitas requisições.' });
  }

  if (!isValidVerifyToken(req.headers[VERIFY_TOKEN_HEADER])) {
    console.warn(`[whatsapp/webhook] Tentativa não autorizada de ${ip}.`);
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req, MAX_BODY_BYTES);
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode ?? 400;
    return res.status(statusCode).json({ error: 'Falha ao ler o corpo da requisição.' });
  }

  const signatureResult = verifySignature(req.headers[SIGNATURE_HEADER], rawBody);
  if (signatureResult === 'invalid') {
    console.warn(`[whatsapp/webhook] Assinatura inválida de ${ip} (delivery-id: ${req.headers['x-webhook-delivery-id'] ?? 'n/a'}).`);
    return res.status(401).json({ error: 'Assinatura inválida.' });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'JSON inválido.' });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ error: 'Payload inválido.' });
  }

  try {
    assertNoInjection(payload);
  } catch (error) {
    if (error instanceof InjectionError) {
      return res.status(400).json({ error: 'Entrada inválida.' });
    }
    throw error;
  }

  console.info(
    `[whatsapp/webhook] evento=${req.headers['x-webhook-event'] ?? 'n/a'} delivery-id=${req.headers['x-webhook-delivery-id'] ?? 'n/a'} attempt=${req.headers['x-webhook-attempt'] ?? 'n/a'}`
  );

  try {
    const response = await API_CONSUME('POST', INTERNAL_ENDPOINT, {}, payload);

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
