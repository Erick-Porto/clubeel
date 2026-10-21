/**
 * Peças de servidor da área de assinatura remota (/assinar): cookies, IP de
 * quem assina, headers de não indexação e o repasse das chamadas à Lara.
 *
 * Nenhuma relação com a sessão de sócio: cookies próprios, com path próprio, e
 * nada aqui lê o cookie do NextAuth (que o navegador manda junto, por ter
 * path=/, mas que esta área simplesmente ignora).
 *
 * As rotas trabalham com `request.cookies`/`response.cookies` em vez de
 * `cookies()` de next/headers: o cookie é gravado ou apagado na PRÓPRIA resposta
 * que a rota devolve, e as rotas podem ser testadas sem o runtime do Next.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  chamarLara,
  ConfiguracaoAusenteError,
  FalhaDeRede,
  type ChamadaLara,
  type QuemAssina,
} from '../../../services/assinatura-api';
import { comBase } from '../../../utils/base-path';

/* -------------------------------------------------------------------------- */
/* Cookies                                                                    */
/* -------------------------------------------------------------------------- */

/** Token do link do e-mail (64 caracteres). */
export const COOKIE_LINK = 'assinatura_link';
/** Segredo da sessão aberta por `abrir`. */
export const COOKIE_SESSAO = 'assinatura_sessao';

/**
 * Path é o que o NAVEGADOR vê: na homologação a área fica em /homolog/assinar.
 * Por isso as rotas de servidor desta área moram em /assinar/api/*, e não em
 * /api/*: fora de /assinar o navegador não manda esses cookies.
 */
export const COOKIE_PATH = comBase('/assinar');

/** Validade do cookie do link. O prazo real do link é da Lara (`expires_at`). */
const TRES_DIAS_S = 3 * 24 * 60 * 60;

export const FORMATO_TOKEN = /^[A-Za-z0-9]{64}$/;

/**
 * `secure` só em produção (mesmo critério da aprovação): em http://localhost o
 * navegador descartaria o cookie e o fluxo nunca andaria no desenvolvimento.
 */
function opcoesCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: COOKIE_PATH,
  };
}

export function gravarLink(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_LINK, token, { ...opcoesCookie(), maxAge: TRES_DIAS_S });
}

/**
 * Sem validade: morre ao fechar o navegador. Quem manda no prazo é a Lara
 * (30 min, derrubada por outro `abrir`); o cookie só carrega o segredo.
 */
export function gravarSessao(res: NextResponse, segredo: string): void {
  res.cookies.set(COOKIE_SESSAO, segredo, opcoesCookie());
}

export function apagarSessao(res: NextResponse): void {
  res.cookies.set(COOKIE_SESSAO, '', { ...opcoesCookie(), maxAge: 0 });
}

export function apagarTudo(res: NextResponse): void {
  res.cookies.set(COOKIE_LINK, '', { ...opcoesCookie(), maxAge: 0 });
  apagarSessao(res);
}

export function lerLink(request: NextRequest): string | null {
  const valor = request.cookies.get(COOKIE_LINK)?.value ?? '';
  return FORMATO_TOKEN.test(valor) ? valor : null;
}

export function lerSessao(request: NextRequest): string | null {
  const valor = request.cookies.get(COOKIE_SESSAO)?.value ?? '';
  return valor ? valor : null;
}

/* -------------------------------------------------------------------------- */
/* Quem assina                                                                */
/* -------------------------------------------------------------------------- */

/**
 * IP de quem assina, para a evidência jurídica.
 *
 * O Next escuta só em 127.0.0.1, atrás do nginx: o IP da conexão é sempre o do
 * nginx, e o Next 15 nem o expõe mais (`request.ip` saiu). Sobram os headers
 * que o nginx põe:
 *
 *  1. `X-Real-IP` — se o nginx fizer `proxy_set_header X-Real-IP $remote_addr`,
 *     é o IP que conectou nele, e o navegador não consegue forjar.
 *  2. ÚLTIMO item do `X-Forwarded-For`. Com `$proxy_add_x_forwarded_for` o nginx
 *     ACRESCENTA o IP real ao fim do que o navegador mandou; o PRIMEIRO item é
 *     o que o próprio navegador escreveu e pode ser qualquer coisa.
 *
 * PENDENTE (TI): confirmar a configuração do nginx da produção e da
 * homologação, e se existe outro proxy na frente dele — nesse caso o último
 * item seria o IP desse proxy. Ver docs/resumo-modulos/15-assinatura-remota.md.
 */
export function ipDeQuemAssina(headers: Headers): string | null {
  const real = headers.get('x-real-ip')?.trim();
  if (real && ipValido(real)) return real;

  const encadeado = headers.get('x-forwarded-for');
  if (encadeado) {
    const itens = encadeado.split(',').map((item) => item.trim()).filter(Boolean);
    const ultimo = itens[itens.length - 1];
    if (ultimo && ipValido(ultimo)) return ultimo;
  }
  return null;
}

/** Só confere o formato: header é texto livre e vai parar num documento jurídico. */
function ipValido(valor: string): boolean {
  return /^[0-9A-Fa-f:.]{2,45}$/.test(valor);
}

export function quemAssina(request: NextRequest): QuemAssina {
  const ip = ipDeQuemAssina(request.headers);
  if (!ip) {
    console.warn('[assinatura] requisição sem X-Real-IP/X-Forwarded-For: confira o nginx.');
  }
  const userAgent = request.headers.get('user-agent')?.slice(0, 1000) ?? null;
  return { ip, userAgent };
}

/* -------------------------------------------------------------------------- */
/* Respostas                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Em TODA resposta da área (as páginas recebem os mesmos via next.config.ts).
 * Nada desta área pode ficar em cache — o aparelho pode ser compartilhado — nem
 * ir parar num buscador.
 */
export const HEADERS_DA_AREA: Record<string, string> = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

export function aplicarHeaders(res: Response): Response {
  for (const [nome, valor] of Object.entries(HEADERS_DA_AREA)) res.headers.set(nome, valor);
  return res;
}

export function json(status: number, corpo: unknown): NextResponse {
  const res = NextResponse.json(corpo, { status });
  aplicarHeaders(res);
  return res;
}

/**
 * Formato único de recusa que o navegador recebe: o da Lara
 * (`{ error, reason }`, mais o que ela mandar junto, como `attempts_left` ou
 * `errors`). Os textos abaixo só existem para quando a Lara não respondeu nada
 * legível — quando ela responde, a mensagem dela passa como veio.
 */
export const MENSAGENS = {
  semLink: 'Abra o link que você recebeu por e-mail.',
  sessaoEncerrada: 'Sua sessão terminou. Comece de novo pelo link do e-mail.',
  indisponivel: 'Não foi possível falar com o clube agora. Tente de novo em instantes.',
  configuracao: 'O site não conseguiu se comunicar com o clube. Avise o clube e tente mais tarde.',
  limite: 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.',
  servidor: 'O clube não conseguiu atender agora. Tente de novo em instantes.',
} as const;

/** Recusas que encerram o link: os cookies saem do aparelho junto com a resposta. */
const RECUSAS_FINAIS = new Set([
  'invalid_link',
  'link_expired',
  'link_superseded',
  'link_revoked',
  'link_used',
  'link_locked',
  'document_unavailable',
]);

type Corpo = Record<string, unknown>;

function lerCorpo(texto: string): Corpo | null {
  if (!texto) return null;
  try {
    const dado = JSON.parse(texto);
    return dado && typeof dado === 'object' && !Array.isArray(dado) ? (dado as Corpo) : null;
  } catch {
    return null;
  }
}

/** Primeira mensagem de um `errors` do Laravel (`{ campo: ["..."] }` ou `{ campo: "..." }`). */
function primeiroErro(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object') return null;
  for (const valor of Object.values(errors as Corpo)) {
    const lista = Array.isArray(valor) ? valor : [valor];
    const texto = lista.find((item) => typeof item === 'string' && item.trim());
    if (typeof texto === 'string') return texto.trim();
  }
  return null;
}

/**
 * Normaliza uma recusa da Lara. Não reescreve mensagem que veio: só preenche
 * `error`/`reason` quando faltam.
 */
export function normalizarRecusa(
  status: number,
  corpo: Corpo | null,
  rotulo: string
): { status: number; corpo: Corpo } {
  const reason = typeof corpo?.reason === 'string' ? corpo.reason : null;
  const error = typeof corpo?.error === 'string' && corpo.error.trim() ? corpo.error.trim() : null;

  // Token da API errado, ou este servidor fora da lista de IPs da Lara. É
  // configuração: log para a TI, mensagem genérica para quem assina. 403 COM
  // reason é outra coisa (ex.: attachment_refused) e passa como veio.
  if (reason === 'unauthorized' || status === 401 || (status === 403 && !reason)) {
    console.error(`[assinatura] ${rotulo} -> ${status}: a Lara recusou o site (token ou IP).`);
    return { status: 502, corpo: { error: MENSAGENS.configuracao, reason: 'unauthorized' } };
  }

  if (status === 429 && !reason) {
    return { status, corpo: { error: error ?? MENSAGENS.limite, reason: 'rate_limited' } };
  }

  if (!corpo) {
    console.error(`[assinatura] ${rotulo} -> ${status} sem corpo JSON.`);
    return { status: status >= 500 ? status : 502, corpo: { error: MENSAGENS.servidor, reason: 'server_error' } };
  }

  // 422 do Laravel: { message, errors }. A mensagem útil está nos campos.
  const mensagem =
    error ??
    primeiroErro(corpo.errors) ??
    (typeof corpo.message === 'string' && corpo.message.trim() ? corpo.message.trim() : null);

  if (status >= 500) console.error(`[assinatura] ${rotulo} -> ${status}`);

  return {
    status,
    corpo: {
      ...corpo,
      error: mensagem ?? MENSAGENS.servidor,
      reason: reason ?? (status === 422 ? 'invalid' : status >= 500 ? 'server_error' : 'unknown'),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Repasse                                                                    */
/* -------------------------------------------------------------------------- */

interface Contexto {
  link: string | null;
  sessao: string | null;
}

interface Repasse {
  caminho: string;
  method: ChamadaLara['method'];
  /** Precisa do cookie do link (link, abrir). */
  exigeLink?: boolean;
  /** Precisa do cookie da sessão (todo o resto). */
  exigeSessao?: boolean;
  /** Monta o corpo JSON a partir dos cookies e do que o navegador mandou. */
  corpo?: (ctx: Contexto) => unknown | Promise<unknown>;
  stream?: ChamadaLara['stream'];
  /** Ajusta a resposta de sucesso (gravar/apagar cookie, tirar segredo do corpo). */
  aoSucesso?: (corpo: Corpo, res: NextResponse) => void;
}

/** Rótulo para log: método e caminho, nada mais. */
function rotuloDe(r: Pick<Repasse, 'method' | 'caminho'>): string {
  return `${r.method} ${r.caminho.replace(/\/\d+$/, '/{id}')}`;
}

/**
 * Valida os cookies exigidos e chama a Lara. Devolve a resposta crua dela, ou
 * uma resposta pronta para o navegador quando nem deu para chamar.
 */
export async function chamar(
  request: NextRequest,
  r: Omit<Repasse, 'aoSucesso'>
): Promise<{ lara: Response } | { pronta: NextResponse }> {
  const ctx: Contexto = { link: lerLink(request), sessao: lerSessao(request) };

  if (r.exigeLink && !ctx.link) {
    return { pronta: json(400, { error: MENSAGENS.semLink, reason: 'no_link' }) };
  }
  if (r.exigeSessao && !ctx.sessao) {
    return { pronta: json(419, { error: MENSAGENS.sessaoEncerrada, reason: 'session_ended' }) };
  }

  try {
    const lara = await chamarLara(r.caminho, {
      method: r.method,
      quem: quemAssina(request),
      sessao: r.exigeSessao ? ctx.sessao ?? undefined : undefined,
      json: r.corpo ? await r.corpo(ctx) : undefined,
      stream: r.stream,
    });
    return { lara };
  } catch (erro) {
    if (erro instanceof ConfiguracaoAusenteError) {
      console.error(`[assinatura] ${rotuloDe(r)}: ${erro.message}`);
      return { pronta: json(500, { error: MENSAGENS.configuracao, reason: 'unauthorized' }) };
    }
    if (erro instanceof FalhaDeRede) {
      // A requisição pode ter chegado à Lara e só a resposta se perdido: o
      // navegador trata `unavailable` no `assinar` como "talvez tenha entrado".
      return { pronta: json(503, { error: MENSAGENS.indisponivel, reason: 'unavailable' }) };
    }
    throw erro;
  }
}

/** Converte uma resposta de erro da Lara na resposta ao navegador (com limpeza de cookies). */
export async function responderRecusa(lara: Response, rotulo: string): Promise<NextResponse> {
  const { status, corpo } = normalizarRecusa(lara.status, lerCorpo(await lara.text()), rotulo);
  const res = json(status, corpo);
  if (RECUSAS_FINAIS.has(String(corpo.reason))) apagarTudo(res);
  else if (corpo.reason === 'session_ended') apagarSessao(res);
  return res;
}

/** Repasse JSON completo: o caso de quase todas as rotas da área. */
export async function repassar(request: NextRequest, r: Repasse): Promise<NextResponse> {
  const resultado = await chamar(request, r);
  if ('pronta' in resultado) return resultado.pronta;
  const { lara } = resultado;

  if (!lara.ok) return responderRecusa(lara, rotuloDe(r));

  const corpo = lerCorpo(await lara.text()) ?? {};
  // O segredo da sessão nunca chega ao navegador, venha de onde vier.
  const segredo = corpo.session_token;
  delete corpo.session_token;

  const res = json(lara.status, corpo);
  if (r.aoSucesso) r.aoSucesso({ ...corpo, session_token: segredo }, res);
  return res;
}

/* -------------------------------------------------------------------------- */
/* Corpo vindo do navegador                                                   */
/* -------------------------------------------------------------------------- */

/** JSON do navegador, ou `{}` se vier vazio/quebrado (a Lara responde a validação). */
export async function lerJson(request: NextRequest): Promise<Corpo> {
  try {
    const dado = await request.json();
    return dado && typeof dado === 'object' && !Array.isArray(dado) ? (dado as Corpo) : {};
  } catch {
    return {};
  }
}

/** Só os campos que a rota da Lara conhece seguem adiante. */
export function escolher(origem: Corpo, campos: readonly string[]): Corpo {
  const destino: Corpo = {};
  for (const campo of campos) {
    if (campo in origem) destino[campo] = origem[campo];
  }
  return destino;
}
