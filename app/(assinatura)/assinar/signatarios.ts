/**
 * Signatários do documento (`signers` da sessão), só para exibir. Puro: sem
 * React, para poder ser testado no Vitest.
 *
 * Nada aqui decide quem pode assinar nem em que ordem: a lista, a ordem, o
 * `status` e a data vêm prontos da Lara. O front só confere o formato (o campo
 * é novo e pode não vir, ou vir de uma Lara ainda sem a mudança) e formata.
 */

import type { Signatario } from './tipos';

const FUSO = 'America/Sao_Paulo';

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

/**
 * `signers` como veio da sessão → lista utilizável. Campo ausente, nulo ou fora
 * do formato vira lista vazia (o bloco some e a tela segue). Item sem nome é
 * descartado: não há o que mostrar dele.
 */
export function lerSignatarios(valor: unknown): Signatario[] {
  if (!Array.isArray(valor)) return [];
  const lista: Signatario[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const name = texto(obj.name);
    if (!name) continue;
    lista.push({
      name,
      role: texto(obj.role),
      me: obj.me === true,
      signed: obj.signed === true,
      signed_at: texto(obj.signed_at),
      status: texto(obj.status) ?? '',
    });
  }
  return lista;
}

/** O bloco só aparece com mais de um signatário. */
export function mostrarSignatarios(lista: Signatario[]): boolean {
  return lista.length > 1;
}

/** "N de M já assinaram". */
export function resumoSignatarios(lista: Signatario[]): string {
  const assinaram = lista.filter((s) => s.signed).length;
  return `${assinaram} de ${lista.length} já assinaram`;
}

/** "dd/mm às hh:mm" no fuso de São Paulo; `null` se a data não vier ou não for válida. */
export function diaEHora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('day')}/${parte('month')} às ${parte('hour')}:${parte('minute')}`;
}

/** "assinou em 09/11 às 10:12" (ou só "assinou", se a Lara não mandar a data). */
export function textoAssinou(s: Signatario): string {
  const quando = diaEHora(s.signed_at);
  return quando ? `assinou em ${quando}` : 'assinou';
}
