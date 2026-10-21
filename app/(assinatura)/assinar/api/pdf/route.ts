/**
 * Os bytes do PDF que a pessoa vai assinar, repassados em stream da Lara.
 *
 * `no-store`: o documento não pode ficar no cache do navegador (aparelho
 * compartilhado). O navegador pede de novo quando `document.pdf_version` muda
 * (depois das respostas do formulário).
 */

import { NextRequest } from 'next/server';
import { aplicarHeaders, chamar, responderRecusa } from '../../servidor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const resultado = await chamar(request, { caminho: 'pdf', method: 'GET', exigeSessao: true });
  if ('pronta' in resultado) return resultado.pronta;
  const { lara } = resultado;

  if (!lara.ok) return responderRecusa(lara, 'GET pdf');

  const tipo = lara.headers.get('content-type') ?? '';
  if (!tipo.toLowerCase().startsWith('application/pdf') || !lara.body) {
    // Corpo inesperado (JSON de erro com 200, página HTML): não repassa.
    await lara.body?.cancel();
    console.error(`[assinatura] GET pdf -> 200 com content-type inesperado.`);
    return responderRecusa(new Response('', { status: 502 }), 'GET pdf');
  }

  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  });
  const tamanho = lara.headers.get('content-length');
  if (tamanho) headers.set('Content-Length', tamanho);

  return aplicarHeaders(new Response(lara.body, { status: 200, headers }));
}
