/**
 * Helpers da integração eRede. Centraliza a autenticação (client_credentials)
 * e a consulta de transações, para que rotas possam VERIFICAR pagamentos no
 * servidor em vez de confiar em dados enviados pelo cliente.
 */

const REDE_CLIENT_ID = process.env.INTERNAL_EREDE_CLIENT_ID as string;
const REDE_CLIENT_SECRET = process.env.INTERNAL_EREDE_SECRET_ID as string;
const BASE_URL = process.env.INTERNAL_EREDE_API_URL as string;
const AUTH_URL = process.env.INTERNAL_EREDE_AUTH_URL as string;

export interface EredeTransaction {
  tid?: string;
  returnCode?: string;
  returnMessage?: string;
  amount?: number;
  dateTime?: string;
  authorizationCode?: string;
  nsu?: string;
  brandTid?: string;
  last4?: string;
  reference?: string;
  [key: string]: unknown;
}

export function eredeConfigured(): boolean {
  return Boolean(REDE_CLIENT_ID && REDE_CLIENT_SECRET && BASE_URL && AUTH_URL);
}

export function eredeBaseUrl(): string {
  return BASE_URL;
}

export async function eredeAuth(): Promise<string> {
  const credentials = Buffer.from(`${REDE_CLIENT_ID}:${REDE_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`eRede auth error: ${res.status}`);
  const { access_token } = await res.json();
  if (!access_token) throw new Error('eRede auth: access_token ausente');
  return access_token;
}

// Formato bruto de GET /transactions/{tid}: a eRede aninha os dados em
// "authorization" (dados da autorização) e "capture" (dados da captura) —
// diferente do formato usado na criação da transação (POST /transactions).
interface EredeRawTransaction {
  authorization?: {
    dateTime?: string;
    returnCode?: string;
    returnMessage?: string;
    reference?: string;
    tid?: string;
    nsu?: string;
    authorizationCode?: string;
    amount?: number;
    last4?: string;
  };
  capture?: {
    dateTime?: string;
    nsu?: string;
    amount?: number;
    brandTid?: string;
  };
}

/** Consulta o estado autoritativo de uma transação diretamente na eRede. */
export async function getEredeTransaction(tid: string, token: string): Promise<EredeTransaction> {
  const res = await fetch(`${BASE_URL}/transactions/${encodeURIComponent(tid)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error(`eRede consult error: ${res.status}`);
  const raw = (await res.json()) as EredeRawTransaction;
  const auth = raw.authorization;
  const capture = raw.capture;

  // Achata para o formato plano usado pelo resto do app. Prioriza os dados
  // de "capture" para valor/data/nsu (é o que efetivamente foi cobrado).
  return {
    tid: auth?.tid,
    returnCode: auth?.returnCode,
    returnMessage: auth?.returnMessage,
    amount: capture?.amount ?? auth?.amount,
    dateTime: capture?.dateTime ?? auth?.dateTime,
    authorizationCode: auth?.authorizationCode,
    nsu: capture?.nsu ?? auth?.nsu,
    brandTid: capture?.brandTid,
    last4: auth?.last4,
    reference: auth?.reference,
  };
}
