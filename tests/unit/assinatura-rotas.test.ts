/**
 * Rotas de servidor da assinatura remota (/assinar/api/*), com a Lara mockada
 * (fetch global substituído). Conferem: credencial própria, IP e navegador de
 * quem assina repassados, cookies httpOnly em /assinar, segredo da sessão fora
 * do corpo, recusas da tabela do contrato repassadas como vieram, limpeza dos
 * cookies e headers de não indexação/não cache.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET as entrarPeloLink } from '../../app/(assinatura)/assinar/[token]/route';
import { POST as link } from '../../app/(assinatura)/assinar/api/link/route';
import { POST as abrir } from '../../app/(assinatura)/assinar/api/abrir/route';
import { GET as sessao } from '../../app/(assinatura)/assinar/api/sessao/route';
import { POST as identidade } from '../../app/(assinatura)/assinar/api/identidade/route';
import { GET as listarAnexos, POST as enviarAnexo } from '../../app/(assinatura)/assinar/api/anexos/route';
import { DELETE as apagarAnexo } from '../../app/(assinatura)/assinar/api/anexos/[id]/route';
import { GET as pdf } from '../../app/(assinatura)/assinar/api/pdf/route';
import { POST as assinar } from '../../app/(assinatura)/assinar/api/assinar/route';
import { POST as recusar } from '../../app/(assinatura)/assinar/api/recusar/route';
import { POST as encerrar } from '../../app/(assinatura)/assinar/api/encerrar/route';
import { ipDeQuemAssina } from '../../app/(assinatura)/assinar/servidor';

const TOKEN = 'Ab3'.repeat(21) + 'Z'; // 64 caracteres
const SEGREDO = 'S'.repeat(64);
const UA = 'Mozilla/5.0 (Linux; Android 14) Teste';

let chamadas: { url: string; init: RequestInit & { duplex?: string } }[] = [];
let respostaLara: () => Response | Promise<Response>;

function jsonLara(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  vi.stubEnv('INTERNAL_LARA_API_URL', 'http://lara.interna/');
  vi.stubEnv('LARA_SIGNATURE_API_TOKEN', 'token-da-assinatura');
  vi.stubEnv('INTERNAL_LARA_API_TOKEN', 'token-das-reservas');
  chamadas = [];
  respostaLara = () => jsonLara(200, { ok: true });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return respostaLara();
    })
  );
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function pedido(
  caminho: string,
  opcoes: {
    method?: string;
    link?: boolean;
    sessao?: boolean;
    json?: unknown;
    body?: BodyInit;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const cookies: string[] = [];
  if (opcoes.link !== false) cookies.push(`assinatura_link=${TOKEN}`);
  if (opcoes.sessao) cookies.push(`assinatura_sessao=${SEGREDO}`);
  // Um cookie de sócio no mesmo navegador: a área precisa ignorá-lo.
  cookies.push('next-auth.session-token=jwt-do-socio');
  const headers: Record<string, string> = {
    cookie: cookies.join('; '),
    'user-agent': UA,
    'x-real-ip': '203.0.113.7',
    ...opcoes.headers,
  };
  let body = opcoes.body;
  if (opcoes.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opcoes.json);
  }
  return new NextRequest(`http://localhost:3000/assinar/api/${caminho}`, {
    method: opcoes.method ?? 'POST',
    headers,
    body,
    duplex: 'half', // exigido pelo undici para corpo em stream
  });
}

function cabecalhos(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>;
}

function setCookies(res: Response): string[] {
  return res.headers.getSetCookie();
}

function cookieGravado(res: Response, nome: string): string | undefined {
  return setCookies(res).find((c) => c.startsWith(`${nome}=`));
}

function apagado(res: Response, nome: string): boolean {
  const c = cookieGravado(res, nome);
  return Boolean(c && /Max-Age=0/i.test(c) && /Path=\/assinar/i.test(c));
}

function semIndexacao(res: Response) {
  expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  expect(res.headers.get('cache-control')).toContain('no-store');
  expect(res.headers.get('referrer-policy')).toBe('no-referrer');
}

/* -------------------------------------------------------------------------- */

describe('entrada pelo link (/assinar/<token>)', () => {
  it('guarda o token em cookie httpOnly de 3 dias em /assinar e redireciona sem o token', async () => {
    const res = await entrarPeloLink(new NextRequest(`http://localhost/assinar/${TOKEN}`), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/assinar');
    semIndexacao(res);

    const cookie = cookieGravado(res, 'assinatura_link')!;
    expect(cookie).toContain(TOKEN);
    expect(cookie).toMatch(/Path=\/assinar/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=259200/i);
    // Link novo derruba a sessão local do link anterior.
    expect(apagado(res, 'assinatura_sessao')).toBe(true);
  });

  it('cookie é secure em produção', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await entrarPeloLink(new NextRequest(`http://localhost/assinar/${TOKEN}`), {
      params: Promise.resolve({ token: TOKEN }),
    });
    expect(cookieGravado(res, 'assinatura_link')).toMatch(/Secure/i);
  });

  it('token fora do formato não grava nada', async () => {
    const res = await entrarPeloLink(new NextRequest('http://localhost/assinar/curto'), {
      params: Promise.resolve({ token: 'curto' }),
    });
    expect(res.status).toBe(303);
    expect(cookieGravado(res, 'assinatura_link')).toBeUndefined();
  });
});

describe('IP de quem assina', () => {
  it('prefere X-Real-IP', () => {
    expect(ipDeQuemAssina(new Headers({ 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '1.1.1.1' }))).toBe(
      '198.51.100.1'
    );
  });

  it('sem X-Real-IP, usa o ÚLTIMO item do X-Forwarded-For (o primeiro pode ser forjado)', () => {
    expect(ipDeQuemAssina(new Headers({ 'x-forwarded-for': '6.6.6.6, 198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('ignora valor que não parece IP', () => {
    expect(ipDeQuemAssina(new Headers({ 'x-real-ip': '<script>' }))).toBeNull();
  });
});

describe('repasse para a Lara', () => {
  it('link: token no corpo, credencial própria, IP e navegador de quem assina', async () => {
    respostaLara = () => jsonLara(200, { document: { title: 'Contrato' } });
    const res = await link(pedido('link'));
    expect(res.status).toBe(200);
    semIndexacao(res);

    expect(chamadas).toHaveLength(1);
    const { url, init } = chamadas[0];
    expect(url).toBe('http://lara.interna/api/assinatura/remota/link');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ token: TOKEN });
    const h = cabecalhos(init);
    expect(h.Authorization).toBe('Bearer token-da-assinatura');
    expect(h.Accept).toBe('application/json');
    expect(h['X-Signer-Ip']).toBe('203.0.113.7');
    expect(h['X-Signer-User-Agent']).toBe(UA);
    expect(h['X-Signature-Session']).toBeUndefined();
    // Nada do sócio vai para a Lara por aqui.
    expect(JSON.stringify(h)).not.toContain('jwt-do-socio');
    expect(JSON.stringify(h)).not.toContain('token-das-reservas');
  });

  it('link sem cookie não chama a Lara', async () => {
    const res = await link(pedido('link', { link: false }));
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('no_link');
    expect(chamadas).toHaveLength(0);
  });

  it('abrir: grava o segredo em cookie httpOnly e o tira do corpo', async () => {
    respostaLara = () => jsonLara(200, { session_token: SEGREDO, document: { id: 1 } });
    const res = await abrir(pedido('abrir'));
    const corpo = await res.json();
    expect(corpo.session_token).toBeUndefined();
    expect(corpo.document.id).toBe(1);
    const cookie = cookieGravado(res, 'assinatura_sessao')!;
    expect(cookie).toContain(SEGREDO);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/assinar/i);
  });

  it('rotas com sessão exigem o cookie e mandam X-Signature-Session', async () => {
    const sem = await sessao(pedido('sessao', { method: 'GET' }));
    expect(sem.status).toBe(419);
    expect((await sem.json()).reason).toBe('session_ended');
    expect(chamadas).toHaveLength(0);

    await sessao(pedido('sessao', { method: 'GET', sessao: true }));
    expect(cabecalhos(chamadas[0].init)['X-Signature-Session']).toBe(SEGREDO);
  });

  it('sessao nunca devolve session_token ao navegador', async () => {
    respostaLara = () => jsonLara(200, { session_token: 'vazou', rules: {} });
    const res = await sessao(pedido('sessao', { method: 'GET', sessao: true }));
    expect(await res.text()).not.toContain('vazou');
  });

  it('identidade: só o CPF segue adiante', async () => {
    await identidade(pedido('identidade', { sessao: true, json: { cpf: '529.982.247-25', extra: 'x' } }));
    expect(JSON.parse(String(chamadas[0].init.body))).toEqual({ cpf: '529.982.247-25' });
  });
});

describe('recusas da Lara', () => {
  const casos: [string, number, boolean][] = [
    // reason, status, encerra o link (apaga os dois cookies)
    ['invalid_link', 404, true],
    ['link_expired', 410, true],
    ['link_superseded', 410, true],
    ['link_revoked', 410, true],
    ['link_used', 409, true],
    ['link_locked', 423, true],
    ['document_unavailable', 409, true],
    ['identity_required', 409, false],
    ['identity_failed', 422, false],
    ['attachments_missing', 409, false],
    ['attachment_refused', 403, false],
    ['invalid', 422, false],
    ['conflict', 409, false],
    ['too_many_attempts', 429, false],
  ];

  for (const [reason, status, encerra] of casos) {
    it(`${reason} (${status}) passa como veio`, async () => {
      const error = `Mensagem pronta da Lara para ${reason}.`;
      respostaLara = () => jsonLara(status, { error, reason, attempts_left: 3 });
      const res = await identidade(pedido('identidade', { sessao: true, json: { cpf: '1' } }));
      expect(res.status).toBe(status);
      const corpo = await res.json();
      expect(corpo.error).toBe(error);
      expect(corpo.reason).toBe(reason);
      expect(corpo.attempts_left).toBe(3);
      semIndexacao(res);
      expect(apagado(res, 'assinatura_link')).toBe(encerra);
      expect(apagado(res, 'assinatura_sessao')).toBe(encerra);
    });
  }

  it('session_ended apaga só o cookie da sessão', async () => {
    respostaLara = () => jsonLara(419, { error: 'Sessão encerrada.', reason: 'session_ended' });
    const res = await sessao(pedido('sessao', { method: 'GET', sessao: true }));
    expect(res.status).toBe(419);
    expect(apagado(res, 'assinatura_sessao')).toBe(true);
    expect(cookieGravado(res, 'assinatura_link')).toBeUndefined();
  });

  it('unauthorized (token/IP do site): log no servidor e mensagem genérica, sem segredo no log', async () => {
    respostaLara = () => jsonLara(401, { error: 'Token inválido: token-da-assinatura', reason: 'unauthorized' });
    const res = await link(pedido('link'));
    expect(res.status).toBe(502);
    const corpo = await res.json();
    expect(corpo.reason).toBe('unauthorized');
    expect(corpo.error).not.toContain('Token inválido');
    const logs = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logs).toContain('POST link');
    expect(logs).not.toContain('token-da-assinatura');
    expect(logs).not.toContain(TOKEN);
  });

  it('403 com reason (anexo recusado) não é tratado como configuração', async () => {
    respostaLara = () => jsonLara(403, { error: 'Este anexo não é seu.', reason: 'attachment_refused' });
    const res = await apagarAnexo(pedido('anexos/9', { method: 'DELETE', sessao: true }), {
      params: Promise.resolve({ id: '9' }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Este anexo não é seu.');
  });

  it('429 sem reason é o limite de chamadas', async () => {
    respostaLara = () => jsonLara(429, { message: 'Too Many Attempts.' });
    const res = await link(pedido('link'));
    expect(res.status).toBe(429);
    const corpo = await res.json();
    expect(corpo.reason).toBe('rate_limited');
  });

  it('422 de validação do Laravel: primeira mensagem de campo vira o error, errors seguem junto', async () => {
    respostaLara = () =>
      jsonLara(422, { message: 'The given data was invalid.', errors: { cpf: ['Informe o CPF.'] } });
    const res = await identidade(pedido('identidade', { sessao: true, json: {} }));
    const corpo = await res.json();
    expect(corpo.error).toBe('Informe o CPF.');
    expect(corpo.reason).toBe('invalid');
    expect(corpo.errors).toEqual({ cpf: ['Informe o CPF.'] });
  });

  it('Lara fora do ar vira 503 unavailable', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'));
    const res = await assinar(pedido('assinar', { sessao: true, json: {} }));
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toBe('unavailable');
  });

  it('resposta não-JSON vira erro genérico', async () => {
    respostaLara = () => new Response('<html>erro</html>', { status: 500 });
    const res = await link(pedido('link'));
    expect(res.status).toBe(500);
    expect((await res.json()).reason).toBe('server_error');
  });
});

describe('fim do fluxo', () => {
  it('assinar com sucesso apaga os cookies do link e da sessão', async () => {
    respostaLara = () => jsonLara(200, { ok: true, signed_at: '2026-10-21T15:20:00-03:00', validation_code: 'K7M2Q9XA' });
    const res = await assinar(
      pedido('assinar', { sessao: true, json: { signature: 'data:image/png;base64,xx', accepted: true, intruso: 1 } })
    );
    expect(res.status).toBe(200);
    expect(apagado(res, 'assinatura_link')).toBe(true);
    expect(apagado(res, 'assinatura_sessao')).toBe(true);
    // Campos fora do contrato não seguem.
    expect(JSON.parse(String(chamadas[0].init.body))).toEqual({ signature: 'data:image/png;base64,xx', accepted: true });
  });

  it('assinar recusado mantém os cookies', async () => {
    respostaLara = () => jsonLara(422, { error: 'Falta a foto.', reason: 'invalid' });
    const res = await assinar(pedido('assinar', { sessao: true, json: {} }));
    expect(cookieGravado(res, 'assinatura_link')).toBeUndefined();
    expect(cookieGravado(res, 'assinatura_sessao')).toBeUndefined();
  });

  it('recusar com sucesso apaga os cookies', async () => {
    const res = await recusar(pedido('recusar', { sessao: true, json: { reason: 'Não concordo.' } }));
    expect(apagado(res, 'assinatura_link')).toBe(true);
    expect(JSON.parse(String(chamadas[0].init.body))).toEqual({ reason: 'Não concordo.' });
  });

  it('encerrar apaga só a sessão (o link continua valendo)', async () => {
    const res = await encerrar(pedido('encerrar', { sessao: true }));
    expect(apagado(res, 'assinatura_sessao')).toBe(true);
    expect(cookieGravado(res, 'assinatura_link')).toBeUndefined();
  });
});

describe('anexos e PDF', () => {
  it('anexo vai em stream, com o content-type (boundary) e o tamanho originais', async () => {
    const form = new FormData();
    form.append('key', 'doc_identidade');
    form.append('file', new Blob(['%PDF-1.4 conteudo'], { type: 'application/pdf' }), 'rg.pdf');
    const corpo = new Response(form);
    const bytes = new Uint8Array(await corpo.clone().arrayBuffer());
    const contentType = corpo.headers.get('content-type')!;

    respostaLara = () => jsonLara(201, { items: [], missing_required: [] });
    const res = await enviarAnexo(
      pedido('anexos', {
        sessao: true,
        body: bytes,
        headers: { 'content-type': contentType, 'content-length': String(bytes.length) },
      })
    );
    expect(res.status).toBe(201);
    const { init } = chamadas[0];
    expect(init.method).toBe('POST');
    expect(init.duplex).toBe('half');
    expect(init.body).toBeInstanceOf(ReadableStream);
    const h = cabecalhos(init);
    expect(h['Content-Type']).toBe(contentType);
    expect(h['Content-Length']).toBe(String(bytes.length));
    expect(h['X-Signature-Session']).toBe(SEGREDO);
  });

  it('corpo que não é multipart nem chega à Lara', async () => {
    const res = await enviarAnexo(pedido('anexos', { sessao: true, json: { file: 'x' } }));
    expect(res.status).toBe(422);
    expect(chamadas).toHaveLength(0);
  });

  it('lista de anexos', async () => {
    respostaLara = () => jsonLara(200, { items: [{ key: 'a' }], missing_required: ['Identidade'] });
    const res = await listarAnexos(pedido('anexos', { method: 'GET', sessao: true }));
    expect((await res.json()).missing_required).toEqual(['Identidade']);
    expect(chamadas[0].init.method).toBe('GET');
  });

  it('apagar anexo: id só numérico', async () => {
    const ruim = await apagarAnexo(pedido('anexos/x', { method: 'DELETE', sessao: true }), {
      params: Promise.resolve({ id: '../pdf' }),
    });
    expect(ruim.status).toBe(404);
    expect(chamadas).toHaveLength(0);

    await apagarAnexo(pedido('anexos/55', { method: 'DELETE', sessao: true }), {
      params: Promise.resolve({ id: '55' }),
    });
    expect(chamadas[0].url).toBe('http://lara.interna/api/assinatura/remota/anexos/55');
    expect(chamadas[0].init.method).toBe('DELETE');
  });

  it('PDF passa em bytes, sem cache', async () => {
    respostaLara = () =>
      new Response('%PDF-1.4 bytes', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    const res = await pdf(pedido('pdf', { method: 'GET', sessao: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    semIndexacao(res);
    expect(await res.text()).toBe('%PDF-1.4 bytes');
  });

  it('PDF antes do CPF: identity_required repassado', async () => {
    respostaLara = () => jsonLara(409, { error: 'Confirme o CPF.', reason: 'identity_required' });
    const res = await pdf(pedido('pdf', { method: 'GET', sessao: true }));
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('identity_required');
  });
});
