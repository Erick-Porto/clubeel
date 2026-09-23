/**
 * Formatação de exibição da área de aprovação. Só apresentação — nenhuma regra
 * de negócio mora aqui.
 */

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Fuso fixado: o servidor pode rodar em UTC e as datas da API vêm com offset
 * -03:00. Sem fixar, a mesma ordem apareceria com horas diferentes.
 */
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export function moeda(valor: number | null | undefined): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  return MOEDA.format(valor);
}

/**
 * Para valor unitário, que o ERP manda com até 4 decimais (0.9979). Arredondar
 * para 2 mostraria "R$ 1,00" ao lado de 120 unidades e um total de R$ 119,75 —
 * a conta pareceria errada na tela sem estar errada.
 */
const MOEDA_PRECISA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function moedaPrecisa(valor: number | null | undefined): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  return MOEDA_PRECISA.format(valor);
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const instante = Date.parse(iso);
  if (Number.isNaN(instante)) return '—';
  return DATA_HORA.format(new Date(instante));
}

/**
 * Tempo decorrido em texto curto. Retorna null quando não há data, para o
 * chamador decidir se some com o trecho ou mostra "—".
 */
export function tempoDecorrido(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const instante = Date.parse(iso);
  if (Number.isNaN(instante)) return null;

  const ms = Date.now() - instante;
  if (ms < 60_000) return 'agora';

  const minutos = Math.floor(ms / 60_000);
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return horas === 1 ? 'há 1 hora' : `há ${horas} horas`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/**
 * Campos que dependem do ERP (fornecedor, departamento, solicitante) vêm null
 * quando ele não responde — e a fila é devolvida do mesmo jeito. Isso é ausência
 * de dado, não erro.
 */
export function ouTraco(valor: string | null | undefined): string {
  if (typeof valor !== 'string') return '—';
  return valor.trim() || '—';
}

export function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}

/**
 * `dt_cadastro` vem do ERP como "2022-08-17 11:43:54.280": sem fuso e sem "T".
 * É hora de parede — passar por Date aqui deslocaria o horário conforme o fuso
 * do servidor (que pode ser UTC), então os pedaços são apenas reordenados.
 */
export function dataHoraSimples(bruto: string | null | undefined): string {
  if (!bruto) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(bruto.trim());
  if (!m) return dataHora(bruto);
  const [, ano, mes, dia, hora, minuto] = m;
  return `${dia}/${mes}/${ano}, ${hora}:${minuto}`;
}

export function numero(valor: number | null | undefined): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(valor);
}

/** Formata só quando tem 14 dígitos; qualquer outra coisa passa como veio. */
export function cnpj(bruto: string | null | undefined): string {
  if (!bruto) return '—';
  const digitos = bruto.replace(/\D/g, '');
  if (digitos.length !== 14) return bruto.trim() || '—';
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Rótulo do passo. Valores desconhecidos passam adiante em vez de serem
 * mapeados para algo errado — inventar "aprovou" para um status novo seria o
 * pior erro possível nesta tela.
 */
export function rotuloDecisao(decisao: string | null | undefined): string {
  if (!decisao) return 'Aguardando decisão';
  switch (decisao) {
    case 'approved':
      return 'Aprovou';
    case 'rejected':
      return 'Reprovou';
    // A API manda "pending" no passo ainda não decidido; sem este caso, a tela
    // exibiria a palavra "pending" em inglês para o diretor.
    case 'pending':
      return 'Aguardando decisão';
    default:
      return decisao;
  }
}

/**
 * Situação do processo. Mesmo motivo do rótulo do passo: sem isto, o diretor lê
 * "open" na tela. Valor desconhecido passa adiante em vez de virar rótulo errado.
 */
export function rotuloStatus(status: string | null | undefined): string {
  if (!status) return '—';
  switch (status) {
    case 'open':
      return 'Em aberto';
    case 'approved':
      return 'Aprovado';
    case 'rejected':
      return 'Reprovado';
    default:
      return status;
  }
}
