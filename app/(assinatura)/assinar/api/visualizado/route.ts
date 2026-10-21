/** Registro da leitura: tempo com o documento na tela e se rolou até o fim. */

import { NextRequest } from 'next/server';
import { escolher, lerJson, repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const enviado = await lerJson(request);
  return repassar(request, {
    caminho: 'visualizado',
    method: 'POST',
    exigeSessao: true,
    corpo: () => escolher(enviado, ['read_seconds', 'scrolled_to_end']),
  });
}
