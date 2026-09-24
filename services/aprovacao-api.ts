/**
 * Cliente da API de aprovação de ordens de compra (Lara).
 *
 * Este módulo é a ÚNICA porta de saída para a Lara nesta área, e roda
 * exclusivamente no servidor: a Lara não é publicada na internet, só é
 * alcançável de dentro da DMZ onde o Next roda. Um fetch para ela nascendo no
 * navegador não funcionaria de fora da DMZ e, se funcionasse, exigiria publicar
 * a Lara — que é justamente o que esta arquitetura evita.
 *
 * Não usa `services/api-consume` nem o proxy `pages/api/backend`: as semânticas
 * de header são incompatíveis. O proxy manda `Authorization: Bearer <appToken>`
 * mais `Session: <token do sócio>`; aqui o `Authorization` carrega o JWT do
 * próprio aprovador, e não existe token de aplicação nenhum no meio.
 *
 * Nota: o pacote `server-only` não está disponível neste projeto (o Next 15 não
 * o traz como dependência), então o guard abaixo faz o papel dele — se este
 * módulo algum dia for arrastado para um bundle de cliente, quebra alto em vez
 * de quebrar silencioso. A garantia de verdade continua sendo
 * `INTERNAL_LARA_API_URL` não ter prefixo `NEXT_PUBLIC_`: no cliente ela é
 * `undefined`.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'services/aprovacao-api só pode ser importado no servidor (Server Component, Server Action ou Route Handler).'
  );
}

/** Erro de configuração de ambiente. Falha alto de propósito. */
export class ConfiguracaoAusenteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfiguracaoAusenteError';
  }
}

/**
 * Mesma chave do agendamento: é o mesmo serviço, e foi decisão de manter uma
 * variável só. Obrigatória — na ausência, falha alto em vez de tentar adivinhar
 * um endereço.
 */
function baseUrl(): string {
  const raw = process.env.INTERNAL_LARA_API_URL;
  if (!raw || !raw.trim()) {
    throw new ConfiguracaoAusenteError(
      'INTERNAL_LARA_API_URL não está definida. A área de aprovação de compras não funciona sem ela.'
    );
  }
  return raw.trim().replace(/\/+$/, '');
}

/* -------------------------------------------------------------------------- */
/* Contratos                                                                  */
/* -------------------------------------------------------------------------- */

export interface AprovacaoUsuario {
  id: number;
  nome: string;
  matricula: string;
}

export interface LoginResposta {
  token: string;
  expira_em: string;
  usuario: AprovacaoUsuario;
}

/**
 * O detalhe da ordem devolve `fornecedor` como objeto; a fila passou a devolver
 * o fornecedor também, e o formato pode ser a string do nome ou o mesmo objeto.
 * Aceitamos os dois e normalizamos em `nomeFornecedor` — é mais barato do que
 * chutar errado e quebrar a fila inteira por causa de um campo de exibição.
 */
export type Fornecedor =
  | string
  | {
      razao_social?: string | null;
      fantasia?: string | null;
      cnpj?: string | null;
    }
  | null;

export interface OrdemNaFila {
  cd_ordem_compra: number;
  processo_id: number;
  vl_total: number;
  nr_itens: number;
  centros_custo: number[];
  sem_centro_custo: boolean;
  /**
   * Desde quando a ordem está NESTE nível — não desde que foi criada.
   * Por isso a interface rotula "aguardando você desde".
   */
  aguardando_desde: string;
  /** "centro de custo" ou "gerente". */
  escolhido_por: string;
  /** Os três abaixo vêm null quando o ERP não responde; a fila vem mesmo assim. */
  fornecedor?: Fornecedor;
  departamento?: string | null;
  solicitante?: string | null;
}

interface FilaResposta {
  ordens: OrdemNaFila[];
}

export interface ItemOrdem {
  item: number;
  material: string | null;
  unidade: string | null;
  quantidade: number | null;
  vl_unitario: number | null;
  vl_total: number | null;
  /** O ERP devolve como string ("75"), não número. */
  centro_custo: number | string | null;
}

export interface PassoAprovacao {
  nivel: number;
  responsavel: string | null;
  /** "approved", "rejected" ou "pending" — e null por segurança. */
  decisao: string | null;
  decidido_por: string | null;
  decidido_em: string | null;
  observacao: string | null;
}

export interface Aprovacao {
  id: number;
  /** "open", "approved" ou "rejected". */
  status: string;
  nivel_atual: number;
  nivel_atual_rotulo: string | null;
  aguardando: number | null;
  passos: PassoAprovacao[];
}

export interface OrdemDetalhe {
  cd_ordem_compra: number;
  processo_id: number;
  filial: number | string | null;
  fornecedor?: Fornecedor;
  departamento?: string | null;
  solicitante?: string | null;
  referente?: string | null;
  vl_total: number;
  nr_itens: number;
  /** Vem do ERP como "2022-08-17 11:43:54.280": sem fuso, é hora de parede. */
  dt_cadastro?: string | null;
  itens: ItemOrdem[];
  aprovacao: Aprovacao;
}

export interface DecisaoResposta {
  /** Estado do PROCESSO depois da decisão, não da sua decisão isolada. */
  resultado: string;
  gravado_no_questor: boolean;
  aprovacao: Aprovacao;
}

/** Extrai o nome do fornecedor aceitando string ou objeto. */
export function nomeFornecedor(fornecedor: Fornecedor | undefined): string | null {
  if (!fornecedor) return null;
  if (typeof fornecedor === 'string') return fornecedor.trim() || null;
  const nome = (fornecedor.fantasia ?? '').trim() || (fornecedor.razao_social ?? '').trim();
  return nome || null;
}

/* -------------------------------------------------------------------------- */
/* Transporte                                                                 */
/* -------------------------------------------------------------------------- */

export type ApiResultado<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; mensagem: string | null; corpo: unknown };

/**
 * Mensagens de recusa desta API são escritas em português, para o usuário
 * final. O front NÃO reescreve nem interpreta: repassa o que veio. Esta função
 * só localiza o campo onde a mensagem está.
 */
function extrairMensagem(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const obj = corpo as Record<string, unknown>;

  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim();
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim();

  // 422 do Laravel: { message, errors: { matricula: ["..."], senha: ["..."] } }
  if (obj.errors && typeof obj.errors === 'object') {
    const primeira = Object.values(obj.errors as Record<string, unknown>)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .find((v) => typeof v === 'string' && v.trim());
    if (typeof primeira === 'string') return primeira.trim();
  }

  return null;
}

async function pedir<T>(
  caminho: string,
  init: { method: string; token?: string; body?: unknown }
): Promise<ApiResultado<T>> {
  // Fora do try: ausência de configuração deve estourar, não virar 503.
  const url = `${baseUrl()}/api/aprovacao/${caminho}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
  } catch (erro) {
    // Lara fora do ar / rede da DMZ com problema. Tratamos como temporário,
    // nunca como sessão inválida.
    console.error(
      `[aprovacao-api] falha de rede em ${init.method} ${caminho}:`,
      erro instanceof Error ? erro.message : erro
    );
    return { ok: false, status: 503, mensagem: null, corpo: null };
  }

  const texto = await resposta.text();
  let corpo: unknown = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    // Resposta não-JSON (página de erro do servidor, por exemplo).
  }

  if (!resposta.ok) {
    // Só o status vai para o log — nunca token, senha ou corpo da requisição.
    console.error(`[aprovacao-api] ${init.method} ${caminho} -> ${resposta.status}`);
    return {
      ok: false,
      status: resposta.status,
      mensagem: extrairMensagem(corpo),
      corpo,
    };
  }

  return { ok: true, status: resposta.status, data: corpo as T };
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Autentica o aprovador. Senha em TEXTO PURO: a Lara faz `Hash::check` com
 * bcrypt. O login de sócio hasheia em SHA256 no cliente porque a chamada nasce
 * no navegador; esta nasce no servidor, dentro da DMZ, sobre a rede interna.
 *
 * Throttle da API: 5 tentativas por minuto POR MATRÍCULA (não por IP — todas as
 * chamadas saem do mesmo IP da DMZ, então por IP o erro de digitação de um
 * diretor trancaria os outros). Excedido, responde 429 com mensagem pronta.
 */
export function login(matricula: string, senha: string): Promise<ApiResultado<LoginResposta>> {
  return pedir<LoginResposta>('login', {
    method: 'POST',
    body: { matricula, senha },
  });
}

/** Fila do próprio aprovador: só as ordens em que ele tem decisão pendente. */
export function listarOrdens(token: string): Promise<ApiResultado<FilaResposta>> {
  return pedir<FilaResposta>('ordens', { method: 'GET', token });
}

/**
 * Detalhe com itens e andamento.
 *
 * 404 significa que a ordem não está na fila DAQUELE aprovador — é "não
 * encontrada", não erro de sistema. 503 é a Lara sem conseguir falar com o ERP:
 * temporário, e não invalida a sessão.
 */
export function obterOrdem(
  token: string,
  cdOrdemCompra: number
): Promise<ApiResultado<OrdemDetalhe>> {
  return pedir<OrdemDetalhe>(`ordens/${encodeURIComponent(String(cdOrdemCompra))}`, {
    method: 'GET',
    token,
  });
}

/**
 * Registra a decisão do aprovador.
 *
 * Quem decide se é a vez dele, se já decidiu e se o processo pode andar é a
 * Lara. Recusas de negócio vêm como 422 com `{ error }` — não é a sua vez, já
 * decidiu, a ordem mudou no ERP durante o trâmite — e a mensagem é exibida como
 * veio.
 */
export function decidirOrdem(
  token: string,
  cdOrdemCompra: number,
  decisao: 'aprovar' | 'reprovar',
  observacao?: string
): Promise<ApiResultado<DecisaoResposta>> {
  const body: { decisao: string; observacao?: string } = { decisao };
  if (observacao) body.observacao = observacao;

  return pedir<DecisaoResposta>(
    `ordens/${encodeURIComponent(String(cdOrdemCompra))}/decidir`,
    { method: 'POST', token, body }
  );
}
