/** Estado da sessão (o mesmo objeto do `abrir`, sem o segredo). Chamado a cada ~15 s. */

import { NextRequest } from 'next/server';
import { repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return repassar(request, { caminho: 'sessao', method: 'GET', exigeSessao: true });
}
