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
  return (await res.json()) as EredeTransaction;
}
