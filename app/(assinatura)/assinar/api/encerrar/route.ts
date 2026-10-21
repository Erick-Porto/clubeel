/**
 * Sair sem assinar: encerra a sessão na Lara e apaga o cookie dela. O link
 * continua valendo (o cookie do link fica, para a pessoa poder voltar).
 */

import { NextRequest } from 'next/server';
import { apagarSessao, json, repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const res = await repassar(request, {
    caminho: 'encerrar',
    method: 'POST',
    exigeSessao: true,
    aoSucesso: (_corpo, resposta) => apagarSessao(resposta),
  });
  // Mesmo se a sessão já tinha caído, sair é sair: o cookie vai embora. Recusa
  // que encerra o link (link vencido etc.) já veio com os cookies apagados.
  if (!res.ok && res.status !== 410 && res.status !== 409 && res.status !== 423) {
    const sair = json(200, { ok: true });
    apagarSessao(sair);
    return sair;
  }
  return res;
}
