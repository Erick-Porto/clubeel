/**
 * Anexos do documento: lista (GET) e envio de UM arquivo por vez (POST
 * multipart com `file` + `key`).
 *
 * O multipart passa em stream para a Lara, sem ser lido, interpretado nem
 * gravado em disco aqui. Quem confere tipo (pelo conteúdo), item e tamanho é a
 * Lara; esta rota só barra o que nem deveria chegar até ela: corpo que não é
 * multipart, sem tamanho declarado ou maior que o teto abaixo.
 *
 * O `Content-Length` vai junto em vez de `Transfer-Encoding: chunked`: nem todo
 * servidor PHP aceita upload em chunked (o `artisan serve`, por exemplo, não
 * aceita), e os navegadores sempre declaram o tamanho de um FormData.
 *
 * Limite de corpo: Route Handler do App Router não tem limite próprio, mas o
 * nginx tem (`client_max_body_size`, 1 MB por padrão). A TI precisa liberar
 * esta rota — e só ela — no nginx; ver docs/resumo-modulos/15-assinatura-remota.md.
 */

import { NextRequest } from 'next/server';
import { json, repassar } from '../../servidor';

export const dynamic = 'force-dynamic';

/**
 * Teto do que o Next aceita repassar. Não é a regra do anexo (essa é o
 * `max_kb` da Lara, 10 MB por padrão): é uma folga acima dela, para um corpo
 * absurdo não ocupar a conexão com a Lara à toa.
 */
const TETO_BYTES = 25 * 1024 * 1024;

export async function GET(request: NextRequest) {
  return repassar(request, { caminho: 'anexos', method: 'GET', exigeSessao: true });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data') || !request.body) {
    return json(422, { error: 'Envie um arquivo por vez.', reason: 'invalid' });
  }

  const tamanho = request.headers.get('content-length');
  const bytes = tamanho ? Number(tamanho) : Number.NaN;
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return json(411, { error: 'Não foi possível ler o arquivo. Tente de novo.', reason: 'invalid' });
  }
  if (bytes > TETO_BYTES) {
    return json(413, { error: 'Arquivo grande demais.', reason: 'attachment_refused' });
  }

  return repassar(request, {
    caminho: 'anexos',
    method: 'POST',
    exigeSessao: true,
    stream: { corpo: request.body, contentType, tamanho },
  });
}
