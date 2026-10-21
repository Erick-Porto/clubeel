/** Respostas do formulário do documento. Devolve o objeto da sessão (o PDF muda junto). */

import { NextRequest } from 'next/server';
import { escolher, lerJson, repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const enviado = await lerJson(request);
  return repassar(request, {
    caminho: 'respostas',
    method: 'POST',
    exigeSessao: true,
    corpo: () => escolher(enviado, ['answers']),
  });
}
