/** Confere o CPF. Errado: 422 `identity_failed` + `attempts_left`; esgotado: 423 `link_locked`. */

import { NextRequest } from 'next/server';
import { escolher, lerJson, repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const enviado = await lerJson(request);
  return repassar(request, {
    caminho: 'identidade',
    method: 'POST',
    exigeSessao: true,
    corpo: () => escolher(enviado, ['cpf']),
  });
}
