/**
 * Cliente da API de assinatura remota de documentos (Lara).
 *
 * Única porta de saída para a Lara na área /assinar, e roda SÓ no servidor: a
 * Lara não é publicada na internet, e o navegador de quem assina fala apenas
 * com as rotas do Next em /assinar/api/*. Mesmo desenho da aprovação de compras
 * (services/aprovacao-api.ts); não usa `api-consume` nem o proxy
 * `pages/api/backend`, que carregam o token e a sessão do SÓCIO.
 *
 * Credencial própria: `LARA_SIGNATURE_API_TOKEN` (o mesmo valor de
 * `SIGNATURE_REMOTE_API_TOKEN` no Lara). NÃO é o `INTERNAL_LARA_API_TOKEN` das
 * reservas nem o JWT da aprovação — misturar daria a esta área os poderes das
 * outras. A URL é a mesma `INTERNAL_LARA_API_URL` do resto do site.
 *
 * Toda chamada leva o IP e o navegador de quem assina (`X-Signer-Ip`,
 * `X-Signer-User-Agent`): eles vão para a evidência jurídica e para o manifesto
 * do PDF. Sem eles, a Lara registraria o IP deste servidor como se fosse o da
 * pessoa.
 *
 * Logs: só método, caminho e status. Nunca token do link, segredo da sessão,
 * CPF, respostas, anexos, foto ou assinatura.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'services/assinatura-api só pode ser importado no servidor (Route Handler ou Server Component).'
  );
}

/** Erro de configuração de ambiente. Falha alto de propósito. */
export class ConfiguracaoAusenteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfiguracaoAusenteError';
  }
}

function baseUrl(): string {
  const raw = process.env.INTERNAL_LARA_API_URL;
  if (!raw || !raw.trim()) {
    throw new ConfiguracaoAusenteError('INTERNAL_LARA_API_URL não está definida.');
  }
  return raw.trim().replace(/\/+$/, '');
}

function tokenDaApi(): string {
  const raw = process.env.LARA_SIGNATURE_API_TOKEN;
  if (!raw || !raw.trim()) {
    throw new ConfiguracaoAusenteError('LARA_SIGNATURE_API_TOKEN não está definida.');
  }
  return raw.trim();
}

/** Quem está assinando, do ponto de vista da rede. */
export interface QuemAssina {
  ip: string | null;
  userAgent: string | null;
}

export interface ChamadaLara {
  method: 'GET' | 'POST' | 'DELETE';
  quem: QuemAssina;
  /** Segredo da sessão (`X-Signature-Session`), nas rotas que pedem. */
  sessao?: string;
  /** Corpo JSON. */
  json?: unknown;
  /** Corpo bruto em stream (multipart dos anexos), com o content-type original. */
  stream?: { corpo: ReadableStream<Uint8Array>; contentType: string; tamanho?: string | null };
}

/**
 * Faz a chamada e devolve a `Response` crua da Lara — quem chama decide se lê
 * JSON ou repassa bytes (o PDF). Falha de rede vira exceção `FalhaDeRede`.
 */
export class FalhaDeRede extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FalhaDeRede';
  }
}

export async function chamarLara(caminho: string, chamada: ChamadaLara): Promise<Response> {
  // Fora do try: ausência de configuração deve estourar, não virar "sem rede".
  const url = `${baseUrl()}/api/assinatura/remota/${caminho}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${tokenDaApi()}`,
  };
  if (chamada.quem.ip) headers['X-Signer-Ip'] = chamada.quem.ip;
  if (chamada.quem.userAgent) headers['X-Signer-User-Agent'] = chamada.quem.userAgent;
  if (chamada.sessao) headers['X-Signature-Session'] = chamada.sessao;

  const init: RequestInit & { duplex?: 'half' } = {
    method: chamada.method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  };

  if (chamada.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(chamada.json);
  } else if (chamada.stream) {
    // O multipart passa em stream, sem ser lido nem gravado em disco aqui. O
    // content-type leva o boundary; sem ele a Lara não consegue separar as partes.
    headers['Content-Type'] = chamada.stream.contentType;
    if (chamada.stream.tamanho) headers['Content-Length'] = chamada.stream.tamanho;
    init.body = chamada.stream.corpo;
    init.duplex = 'half';
  }

  try {
    return await fetch(url, init);
  } catch (erro) {
    console.error(
      `[assinatura-api] falha de rede em ${chamada.method} ${caminho}:`,
      erro instanceof Error ? erro.message : 'erro desconhecido'
    );
    throw new FalhaDeRede('Lara inalcançável.');
  }
}
