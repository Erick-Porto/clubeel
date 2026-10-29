/**
 * Página de entrada: o que é o documento, para quem, até quando e o que vai ser
 * pedido. Não abre sessão. O token vai no CORPO, nunca na URL.
 *
 * Também é a forma de saber se um `assinar` que perdeu a resposta entrou:
 * `link_used` quer dizer que entrou.
 */

import { NextRequest } from 'next/server';
import { repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return repassar(request, {
    caminho: 'link',
    method: 'POST',
    exigeLink: true,
    corpo: ({ link }) => ({ token: link }),
  });
}
