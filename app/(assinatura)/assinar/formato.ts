/**
 * Formatação da área de assinatura. Só apresentação: nada aqui decide prazo,
 * validade ou tentativa — esses números vêm prontos da Lara.
 *
 * Datas sempre no fuso de São Paulo, a partir do instante que a API mandou;
 * o relógio do aparelho não entra em nenhuma conta mostrada na tela.
 */

const FUSO = 'America/Sao_Paulo';

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return iso;
  const data = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: 'numeric', month: 'long', year: 'numeric' }).format(instante);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(instante);
  return `${data}, às ${hora}`;
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(instante);
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** "mm:ss" para o aviso de fim de sessão. */
export function minutosSegundos(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/* ------------------------------------------------------------------ Máscaras */
/* Opcionais: a Lara normaliza. Só ajudam a pessoa a conferir o que digitou.   */

function digitos(valor: string, maximo: number): string {
  return valor.replace(/\D/g, '').slice(0, maximo);
}

function aplicar(d: string, partes: [number, string][]): string {
  let saida = '';
  let i = 0;
  for (const [tamanho, separador] of partes) {
    if (i >= d.length) break;
    if (i > 0) saida += separador;
    saida += d.slice(i, i + tamanho);
    i += tamanho;
  }
  return saida;
}

export function mascaraCpf(valor: string): string {
  return aplicar(digitos(valor, 11), [[3, ''], [3, '.'], [3, '.'], [2, '-']]);
}

export function mascaraCnpj(valor: string): string {
  return aplicar(digitos(valor, 14), [[2, ''], [3, '.'], [3, '.'], [4, '/'], [2, '-']]);
}

export function mascaraCep(valor: string): string {
  return aplicar(digitos(valor, 8), [[5, ''], [3, '-']]);
}

export function mascaraTelefone(valor: string): string {
  const d = digitos(valor, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  const ddd = `(${d.slice(0, 2)}) `;
  const resto = d.slice(2);
  if (resto.length <= 4) return ddd + resto;
  const corte = resto.length > 8 ? 5 : 4;
  return `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
