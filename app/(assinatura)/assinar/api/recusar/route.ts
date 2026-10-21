/** Recusa o documento (encerra para todos). Sucesso apaga os cookies da área. */

import { NextRequest } from 'next/server';
import { apagarTudo, escolher, lerJson, repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const enviado = await lerJson(request);
  return repassar(request, {
    caminho: 'recusar',
    method: 'POST',
    exigeSessao: true,
    corpo: () => escolher(enviado, ['reason']),
    aoSucesso: (_corpo, res) => apagarTudo(res),
  });
}
