/**
 * Entrada pelo link enviado pelo atendimento (e-mail, WhatsApp...): /assinar/<token>.
 *
 * Guarda o token num cookie httpOnly e redireciona para /assinar SEM o token,
 * para ele sair da barra de endereço e do histórico. Daqui em diante o token só
 * existe no cookie e no servidor.
 *
 * Abrir um link novo troca o cookie e derruba a sessão local do
 * link anterior — o segredo dela pertence ao outro documento.
 *
 * Token fora do formato não grava nada: a tela de /assinar mostra "abra o link
 * que você recebeu". Quem decide se um token bem formado vale é a
 * Lara, na chamada `link`.
 *
 * O `Location` é relativo de propósito: atrás do nginx o `request.url` pode
 * trazer o host interno (127.0.0.1:porta), e um redirect absoluto para ele
 * mandaria a pessoa para um endereço que ela não alcança.
 */

import { NextRequest, NextResponse } from 'next/server';
import { comBase } from '../../../../utils/base-path';
import { aplicarHeaders, apagarSessao, FORMATO_TOKEN, gravarLink } from '../servidor';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await context.params;

  const res = new NextResponse(null, { status: 303, headers: { Location: comBase('/assinar') } });
  aplicarHeaders(res);

  if (FORMATO_TOKEN.test(token ?? '')) {
    gravarLink(res, token);
    apagarSessao(res);
  }
  return res;
}
