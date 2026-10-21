/**
 * Assina: tudo numa requisição só (a Lara grava tudo ou nada). Sucesso apaga os
 * cookies do link e da sessão na própria resposta — o documento acabou para
 * esta pessoa, e o aparelho pode ser compartilhado.
 *
 * Sem limite de corpo aqui: Route Handler do App Router não tem (o limite de
 * 4 MB é do bodyParser das rotas de `pages/api`). A foto é um JPEG 600×600 e as
 * imagens dos traços são pequenas; o conjunto fica bem abaixo de 1 MB, o padrão
 * do nginx.
 */

import { NextRequest } from 'next/server';
import { apagarTudo, escolher, lerJson, repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

const CAMPOS = [
  'signature',
  'strokes',
  'initials',
  'initials_strokes',
  'photo',
  'photo_consent',
  'accepted',
  'wants_copy',
  'read_seconds',
  'scrolled_to_end',
  'viewport',
] as const;

export async function POST(request: NextRequest) {
  const enviado = await lerJson(request);
  return repassar(request, {
    caminho: 'assinar',
    method: 'POST',
    exigeSessao: true,
    corpo: () => escolher(enviado, CAMPOS),
    aoSucesso: (_corpo, res) => apagarTudo(res),
  });
}
