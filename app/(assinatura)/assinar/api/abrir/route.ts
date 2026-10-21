/**
 * Começa: abre a sessão (30 min na Lara) e recebe o segredo dela SÓ nesta
 * resposta. O segredo vai para o cookie httpOnly e é tirado do corpo antes de
 * chegar ao navegador (ver `repassar`). Abrir de novo derruba a sessão anterior.
 */

import { NextRequest } from 'next/server';
import { gravarSessao, repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return repassar(request, {
    caminho: 'abrir',
    method: 'POST',
    exigeLink: true,
    corpo: ({ link }) => ({ token: link }),
    aoSucesso: (corpo, res) => {
      if (typeof corpo.session_token === 'string' && corpo.session_token) {
        gravarSessao(res, corpo.session_token);
      } else {
        console.error('[assinatura] POST abrir -> sem session_token na resposta.');
      }
    },
  });
}
