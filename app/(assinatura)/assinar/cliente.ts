/**
 * Chamadas do navegador para as rotas do servidor da área (/assinar/api/*).
 *
 * O navegador nunca fala com a Lara: só com estas rotas, que levam os cookies
 * httpOnly (link e sessão) sozinhos, por estarem sob /assinar. Nada aqui lê ou
 * guarda token: o JavaScript da página nem tem acesso a eles.
 *
 * `cache: 'no-store'` em tudo: nada desta área pode ficar no cache do navegador.
 */

import { comBase } from '../../../utils/base-path';
import type { Recusa } from './tipos';

export type Resposta<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; recusa: Recusa };

/** Sem resposta nenhuma (sem internet, servidor fora). `status: 0` identifica. */
export const SEM_CONEXAO: Recusa = {
  error: 'Sem conexão com a internet. Confira a sua conexão e tente de novo.',
  reason: 'network',
};

function urlDa(caminho: string): string {
  return comBase(`/assinar/api/${caminho}`);
}

function comoRecusa(corpo: unknown, status: number): Recusa {
  const obj = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  return {
    ...(obj as object),
    error:
      typeof obj.error === 'string' && obj.error
        ? obj.error
        : 'Algo deu errado. Tente de novo em instantes.',
    reason: typeof obj.reason === 'string' ? obj.reason : status === 0 ? 'network' : 'unknown',
  } as Recusa;
}

export async function api<T>(
  caminho: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; json?: unknown; form?: FormData } = {}
): Promise<Resposta<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  } else if (init.form) {
    body = init.form; // o navegador põe o content-type com o boundary
  }

  let resposta: Response;
  try {
    resposta = await fetch(urlDa(caminho), {
      method: init.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, status: 0, recusa: SEM_CONEXAO };
  }

  let corpo: unknown = null;
  try {
    corpo = await resposta.json();
  } catch {
    // corpo vazio ou não-JSON
  }

  if (!resposta.ok) return { ok: false, status: resposta.status, recusa: comoRecusa(corpo, resposta.status) };
  return { ok: true, status: resposta.status, data: (corpo ?? {}) as T };
}

/** Bytes do PDF (para o PDF.js). Ficam só na memória da aba. */
export async function baixarPdf(): Promise<Resposta<ArrayBuffer>> {
  let resposta: Response;
  try {
    resposta = await fetch(urlDa('pdf'), { cache: 'no-store', credentials: 'same-origin' });
  } catch {
    return { ok: false, status: 0, recusa: SEM_CONEXAO };
  }
  if (!resposta.ok) {
    let corpo: unknown = null;
    try {
      corpo = await resposta.json();
    } catch {
      // sem corpo
    }
    return { ok: false, status: resposta.status, recusa: comoRecusa(corpo, resposta.status) };
  }
  try {
    return { ok: true, status: resposta.status, data: await resposta.arrayBuffer() };
  } catch {
    return { ok: false, status: 0, recusa: SEM_CONEXAO };
  }
}

/** `errors` da Lara em `{ key: "mensagem" }`, aceitando também o formato de lista do Laravel. */
export function errosPorCampo(recusa: Recusa): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(recusa.errors ?? {})) {
    const texto = Array.isArray(valor) ? valor.find((v) => typeof v === 'string') : valor;
    if (typeof texto === 'string' && texto) saida[chave.replace(/^answers\./, '')] = texto;
  }
  return saida;
}
