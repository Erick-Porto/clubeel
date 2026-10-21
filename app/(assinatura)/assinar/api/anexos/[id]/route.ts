/**
 * Apaga um anexo. Só os enviados pela própria pessoa, e só até assinar — quem
 * confere é a Lara (`can_remove` na lista é só para a tela). Trocar um anexo é
 * apagar e enviar outro.
 */

import { NextRequest } from 'next/server';
import { json, repassar } from '../../../servidor';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!/^\d{1,12}$/.test(id ?? '')) {
    return json(404, { error: 'Anexo não encontrado.', reason: 'attachment_refused' });
  }
  return repassar(request, { caminho: `anexos/${id}`, method: 'DELETE', exigeSessao: true });
}
