/**
 * Ponta a ponta da assinatura remota contra a Lara falsa (lara-falsa.mjs).
 *
 * Cobre: ordem das etapas, recusas da tabela do contrato, bloqueio sem câmera,
 * anexos (enviar, trocar, obrigatório travando), sessão caída e aviso de fim,
 * falha de rede no `assinar`, recusa do documento, headers de não indexação,
 * isolamento da sessão de sócio e limpeza dos cookies no fim.
 */

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const LARA = 'http://127.0.0.1:4010';
const TOKEN = 'Tk' + 'a1B2c3D4'.repeat(7) + 'zz0099';
const CPF_CERTO = '529.982.247-25';

interface Registro {
  metodo: string;
  rota: string;
  autorizacao?: string;
  ip: string | null;
  navegador: boolean;
  temSessao: boolean;
  resumo?: Record<string, unknown>;
}

async function cenario(request: APIRequestContext, opcoes: Record<string, unknown> = {}) {
  const res = await request.post(`${LARA}/__cenario`, { data: opcoes });
  expect(res.ok()).toBe(true);
}

async function registro(request: APIRequestContext): Promise<Registro[]> {
  return (await request.get(`${LARA}/__registro`)).json();
}

async function abrirLink(page: Page) {
  await page.goto(`/assinar/${TOKEN}`);
  await expect(page).toHaveURL(/\/assinar$/);
}

async function comecar(page: Page) {
  await abrirLink(page);
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.getByRole('heading', { name: 'Confirme seu CPF' })).toBeVisible();
}

async function confirmarCpf(page: Page) {
  await page.locator('#cpf').fill(CPF_CERTO);
  await page.getByRole('button', { name: 'Confirmar CPF' }).click();
}

async function lerAteOFim(page: Page) {
  await expect(page.getByRole('heading', { name: 'Leia o documento' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Página 3 de 3' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByTestId('fim-leitura')).toContainText('Você chegou ao fim do documento');
  await page.waitForTimeout(1200); // pelo menos 1 s de leitura
  await page.getByRole('button', { name: 'Li o documento, continuar' }).click();
}

async function desenhar(page: Page, passos: number) {
  const caixa = (await page.getByTestId('quadro').boundingBox())!;
  await page.mouse.move(caixa.x + 20, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width - 20, caixa.y + caixa.height / 3, { steps: passos });
  await page.mouse.up();
}

async function aceitar(page: Page) {
  await page.getByText('Li e aceito os termos do documento.').click();
  await page.getByText(/Autorizo a captura da minha imagem/).click();
}

async function tirarFoto(page: Page) {
  await expect(page.getByRole('heading', { name: 'Sua foto' })).toBeVisible();
  const botao = page.getByRole('button', { name: 'Tirar foto' });
  await expect(botao).toBeEnabled();
  await botao.click();
  await expect(page.getByRole('img', { name: 'Sua foto' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Usar esta foto e assinar' }).click();
}

/** Do CPF até a foto, num documento sem perguntas e sem anexos. */
async function assinarDocumentoSimples(page: Page) {
  await comecar(page);
  await confirmarCpf(page);
  await lerAteOFim(page);
  await aceitar(page);
  await page.getByRole('button', { name: 'Continuar para a assinatura' }).click();
  await desenhar(page, 40);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await tirarFoto(page);
}

async function cookiesDaArea(page: Page) {
  return (await page.context().cookies()).filter((c) => c.name.startsWith('assinatura_'));
}

/* -------------------------------------------------------------------------- */

test.describe('endereço e não indexação', () => {
  test('raiz sem link mostra só a orientação e não chama a API', async ({ page }) => {
    const chamadas: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/assinar/api/')) chamadas.push(r.url());
    });
    await page.goto('/assinar');
    await expect(page.getByRole('heading', { name: 'Abra o link que você recebeu por e-mail' })).toBeVisible();
    expect(chamadas).toEqual([]);
  });

  test('o token vira cookie httpOnly em /assinar e sai da URL', async ({ page, request }) => {
    await cenario(request);
    await abrirLink(page);
    const [cookie] = await cookiesDaArea(page);
    expect(cookie.name).toBe('assinatura_link');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe('/assinar');
    expect(cookie.sameSite).toBe('Lax');
    expect(page.url()).not.toContain(TOKEN);
    const historico = await page.evaluate(() => window.location.href);
    expect(historico).not.toContain(TOKEN);
  });

  test('headers: noindex, no-store e no-referrer em páginas e rotas', async ({ request }) => {
    for (const caminho of ['/assinar', `/assinar/${TOKEN}`, '/assinar/api/sessao']) {
      const res = await request.get(caminho, { maxRedirects: 0 });
      const h = res.headers();
      expect(h['x-robots-tag'], caminho).toBe('noindex, nofollow');
      expect(h['cache-control'], caminho).toContain('no-store');
      expect(h['referrer-policy'], caminho).toBe('no-referrer');
    }
    const redirecionamento = await request.get(`/assinar/${TOKEN}`, { maxRedirects: 0 });
    expect(redirecionamento.status()).toBe(303);
    expect(redirecionamento.headers()['location']).toBe('/assinar');

    const html = await (await request.get('/assinar')).text();
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow/);
  });

  test('robots.txt bloqueia /assinar', async ({ request }) => {
    const texto = await (await request.get('/robots.txt')).text();
    expect(texto).toContain('Disallow: /assinar');
  });
});

test.describe('fluxo completo', () => {
  test('etapas na ordem da Lara, anexos, visto, foto e cookies limpos no fim', async ({ page, request }) => {
    await cenario(request, { comVisto: true });

    const deSocio: string[] = [];
    const vazamentos: string[] = [];
    page.on('request', (r) => {
      if (/\/api\/(auth|backend)\//.test(r.url())) deSocio.push(r.url());
    });
    page.on('response', async (r) => {
      if (!r.url().includes('/assinar/api/') || r.url().endsWith('/pdf')) return;
      const texto = await r.text().catch(() => '');
      if (texto.includes('session_token')) vazamentos.push(r.url());
    });

    // 1. Entrada
    await abrirLink(page);
    await expect(page.getByRole('heading', { name: 'Contrato de locação — Salão Nobre' })).toBeVisible();
    await expect(page.getByText('Maria de Souza — Contratante')).toBeVisible();
    await expect(page.getByText(/Ana \(atendimento\)/)).toBeVisible();
    await expect(page.getByText(/24 de outubro de 2026/)).toBeVisible();
    await expect(page.getByText(/Seu CPF completo/)).toBeVisible();
    await expect(page.getByText(/2 documentos para anexar \(1 obrigatório\)/)).toBeVisible();
    await expect(page.getByText(/Seu visto \(rubrica\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Começar' }).click();

    // 2. CPF (uma tentativa errada: a contagem vem da Lara)
    await expect(page.getByTestId('progresso')).toHaveText('Etapa 1 de 8');
    await page.locator('#cpf').fill('11111111111');
    await expect(page.locator('#cpf')).toHaveValue('111.111.111-11');
    await page.getByRole('button', { name: 'Confirmar CPF' }).click();
    await expect(page.getByText('O CPF não confere com o cadastro.')).toBeVisible();
    await expect(page.getByTestId('tentativas')).toHaveText('Restam 4 tentativas.');
    await page.locator('#cpf').fill(CPF_CERTO);
    await page.getByRole('button', { name: 'Confirmar CPF' }).click();

    // 3. Perguntas (erro por campo, depois certo)
    await expect(page.getByRole('heading', { name: 'Complete o documento' })).toBeVisible();
    await expect(page.getByTestId('progresso')).toHaveText('Etapa 2 de 8');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Informe um telefone com DDD.')).toBeVisible();
    await expect(page.getByText('Responda sim ou não.')).toBeVisible();
    await page.locator('#campo-telefone').fill('24999998888');
    await expect(page.locator('#campo-telefone')).toHaveValue('(24) 99999-8888');
    await page.getByLabel('Sim').check();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // 4. Anexos: obrigatório trava; enviar; trocar
    await expect(page.getByRole('heading', { name: 'Anexe os documentos' })).toBeVisible();
    await expect(page.getByTestId('progresso')).toHaveText('Etapa 3 de 8');
    const continuarAnexos = page.getByRole('button', { name: 'Continuar' });
    await expect(continuarAnexos).toBeDisabled();
    await expect(page.getByTestId('anexos-faltando')).toContainText('Identidade');
    const comprovante = page.getByTestId('anexo-doc_comprovante');
    await expect(comprovante).toContainText('Já recebido pelo clube');
    await expect(comprovante.getByRole('button', { name: /Remover/ })).toHaveCount(0);

    const identidade = page.getByTestId('anexo-doc_identidade');
    await page.getByTestId('arquivo-doc_identidade').setInputFiles({
      name: 'rg.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% identidade\n'),
    });
    await expect(identidade).toContainText('PDF,');
    await expect(continuarAnexos).toBeEnabled();

    await page.getByTestId('arquivo-doc_identidade').setInputFiles({
      name: 'rg.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
    });
    await expect(identidade).toContainText('Imagem,');
    await expect(identidade).not.toContainText('PDF,');
    await expect(identidade.getByRole('button', { name: /Remover/ })).toHaveCount(1);
    await continuarAnexos.click();

    // 5. Leitura
    await expect(page.getByTestId('progresso')).toHaveText('Etapa 4 de 8');
    await lerAteOFim(page);

    // 6. Aceite
    await expect(page.getByTestId('progresso')).toHaveText('Etapa 5 de 8');
    const seguirAceite = page.getByRole('button', { name: 'Continuar para a assinatura' });
    await expect(seguirAceite).toBeDisabled();
    await expect(page.getByText('A imagem será usada só como evidência desta assinatura.', { exact: false })).toBeVisible();
    await aceitar(page);
    await page.getByText('Quero receber a via assinada por e-mail.').click();
    await seguirAceite.click();

    // 7. Assinatura: traço curto não habilita; limpar; traço completo
    await expect(page.getByTestId('progresso')).toHaveText('Etapa 6 de 8');
    const continuarQuadro = page.getByRole('button', { name: 'Continuar', exact: true });
    await desenhar(page, 4);
    await expect(continuarQuadro).toBeDisabled();
    await page.getByRole('button', { name: 'Limpar' }).click();
    await desenhar(page, 40);
    await expect(continuarQuadro).toBeEnabled();
    await continuarQuadro.click();

    // 8. Visto
    await expect(page.getByRole('heading', { name: 'Seu visto' })).toBeVisible();
    await expect(page.getByTestId('progresso')).toHaveText('Etapa 7 de 8');
    await desenhar(page, 12);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    // 9. Foto → 10. Envio
    await expect(page.getByTestId('progresso')).toHaveText('Etapa 8 de 8');
    await tirarFoto(page);

    await expect(page.getByRole('heading', { name: /Assinatura registrada em 21 de outubro de 2026/ })).toBeVisible();
    await expect(page.getByTestId('codigo-validacao')).toHaveText('K7M2Q9XA');
    await expect(page.getByText('A via assinada chega por e-mail quando o documento for finalizado.')).toBeVisible();

    // Fim: cookies apagados, nada guardado no navegador, nada do sócio.
    expect(await cookiesDaArea(page)).toEqual([]);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    expect(deSocio).toEqual([]);
    expect(vazamentos).toEqual([]);

    // O que a Lara recebeu
    const chamadas = (await registro(request)).filter((c) => c.rota !== 'sessao');
    for (const c of chamadas) {
      expect(c.autorizacao).toBe('Bearer token-teste');
      expect(c.ip).toBe('203.0.113.7');
      expect(c.navegador).toBe(true);
    }
    const ordem = (rota: string, metodo = 'POST') => chamadas.findIndex((c) => c.rota === rota && c.metodo === metodo);
    expect(ordem('link')).toBe(0);
    expect(ordem('abrir')).toBeGreaterThan(ordem('link'));
    expect(ordem('identidade')).toBeGreaterThan(ordem('abrir'));
    expect(ordem('respostas')).toBeGreaterThan(ordem('identidade'));
    expect(ordem('anexos')).toBeGreaterThan(ordem('respostas'));
    expect(ordem('anexos/{id}', 'DELETE')).toBeGreaterThan(ordem('anexos'));
    expect(ordem('pdf', 'GET')).toBeGreaterThan(ordem('anexos/{id}', 'DELETE'));
    expect(ordem('visualizado')).toBeGreaterThan(ordem('pdf', 'GET'));
    expect(ordem('assinar')).toBeGreaterThan(ordem('visualizado'));

    const envio = chamadas.find((c) => c.rota === 'assinar')!.resumo!;
    expect(envio.pontos as number).toBeGreaterThanOrEqual(30);
    expect(envio.pontosVisto as number).toBeGreaterThanOrEqual(8);
    expect(envio.assinaturaPng).toBe(true);
    expect(envio.fotoJpeg).toBe(true);
    expect(envio.accepted).toBe(true);
    expect(envio.photo_consent).toBe(true);
    expect(envio.wants_copy).toBe(true);
    expect(envio.scrolled_to_end).toBe(true);
    expect(envio.read_seconds as number).toBeGreaterThanOrEqual(1);
    expect(envio.viewport).toEqual({ w: 360, h: 740, orientation: 'portrait' });
  });

  test('modelo vinculado: 12 perguntas, anexos dos dois e PDF de 12 páginas', async ({ page, request }) => {
    await cenario(request, { vinculado: true });
    await comecar(page);
    await confirmarCpf(page);

    // Perguntas dos dois modelos no mesmo formulário, rolando com a página.
    await expect(page.getByRole('heading', { name: 'Complete o documento' })).toBeVisible();
    await expect(page.locator('[id^="campo-"]')).toHaveCount(12);
    await page.locator('#campo-telefone').fill('24999998888');
    await page.getByLabel('Sim').check();
    await page.locator('#campo-reg_8').fill('Resposta do regulamento');
    await expect(page.locator('#campo-reg_8')).toBeInViewport();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Anexos dos dois modelos na mesma lista.
    await expect(page.getByRole('heading', { name: 'Anexe os documentos' })).toBeVisible();
    await expect(page.getByTestId('anexo-reg_autorizacao')).toBeVisible();
    await page.getByTestId('arquivo-doc_identidade').setInputFiles({
      name: 'rg.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% identidade\n'),
    });
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Leitura: um PDF só, longo; o fim só conta depois da última página.
    await expect(page.getByRole('heading', { name: 'Leia o documento' })).toBeVisible();
    await expect(page.getByText('12 páginas')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Página 12 de 12' })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('fim-leitura')).toContainText('Role até o fim');
    for (const _ of [1, 2]) await page.getByRole('button', { name: 'Aumentar' }).click();
    await expect(page.getByRole('button', { name: 'Aumentar' })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expect(async () => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.getByTestId('fim-leitura')).toContainText('Você chegou ao fim do documento', { timeout: 500 });
    }).toPass();
    await page.getByRole('button', { name: 'Li o documento, continuar' }).click();
    await expect(page.getByRole('button', { name: 'Continuar para a assinatura' })).toBeVisible();

    const visto = (await registro(request)).find((c) => c.rota === 'visualizado')!.resumo!;
    expect(visto.scrolled_to_end).toBe(true);
  });

  test('recarregar a página retoma a sessão aberta', async ({ page, request }) => {
    await cenario(request, { semAnexos: true });
    await comecar(page);
    await confirmarCpf(page);
    await expect(page.getByRole('heading', { name: 'Complete o documento' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Complete o documento' })).toBeVisible();
    const aberturas = (await registro(request)).filter((c) => c.rota === 'abrir');
    expect(aberturas).toHaveLength(1);
  });
});

test.describe('câmera', () => {
  test('sem câmera, avisa na entrada e não deixa começar', async ({ page, request }) => {
    await cenario(request);
    await page.addInitScript(() => {
      navigator.mediaDevices.enumerateDevices = async () =>
        [{ kind: 'audioinput', deviceId: 'a', groupId: 'g', label: '', toJSON: () => ({}) }] as MediaDeviceInfo[];
    });
    await abrirLink(page);
    await expect(page.getByTestId('sem-camera')).toContainText('não tem câmera');
    await expect(page.getByRole('button', { name: 'Começar' })).toBeDisabled();
    expect((await registro(request)).some((c) => c.rota === 'abrir')).toBe(false);
  });
});

test.describe('recusas do link', () => {
  const casos = [
    { reason: 'invalid_link', status: 404, titulo: 'Link inválido' },
    { reason: 'link_expired', status: 410, titulo: 'Link vencido' },
    { reason: 'link_superseded', status: 410, titulo: 'Existe um link mais recente' },
    { reason: 'link_revoked', status: 410, titulo: 'Link cancelado pelo clube' },
    { reason: 'link_used', status: 409, titulo: 'Você já respondeu a este documento' },
    { reason: 'link_locked', status: 423, titulo: 'O CPF não conferiu' },
    { reason: 'document_unavailable', status: 409, titulo: 'Documento indisponível' },
  ];

  for (const caso of casos) {
    test(`${caso.reason}: tela final com a mensagem da Lara e cookies apagados`, async ({ page, request }) => {
      const error = `Mensagem da Lara: ${caso.reason}.`;
      await cenario(request, { linkErro: { status: caso.status, reason: caso.reason, error } });
      await abrirLink(page);
      const final = page.getByTestId('tela-final');
      await expect(final.getByRole('heading', { name: caso.titulo })).toBeVisible();
      await expect(final).toContainText(error);
      expect(await cookiesDaArea(page)).toEqual([]);
    });
  }

  test('CPF errado até travar: link_locked', async ({ page, request }) => {
    await cenario(request, { tentativas: 1 });
    await comecar(page);
    await page.locator('#cpf').fill('111.111.111-11');
    await page.getByRole('button', { name: 'Confirmar CPF' }).click();
    await expect(page.getByRole('heading', { name: 'O CPF não conferiu' })).toBeVisible();
    await expect(page.getByText('Peça um novo link ao clube.', { exact: false })).toBeVisible();
    expect(await cookiesDaArea(page)).toEqual([]);
  });

  test('site sem autorização na Lara: mensagem genérica', async ({ page, request }) => {
    await cenario(request, { naoAutorizado: true });
    await abrirLink(page);
    await expect(page.getByText('O site não conseguiu se comunicar com o clube', { exact: false })).toBeVisible();
    await expect(page.getByText('Credencial inválida')).toHaveCount(0);
  });
});

test.describe('sessão', () => {
  test('sessão caída volta à entrada com o aviso da Lara', async ({ page, request }) => {
    await cenario(request, { semFormulario: true, semAnexos: true });
    await comecar(page);
    await confirmarCpf(page);
    // Derruba só depois do PDF na tela: antes disso, quem recebe o 419 é o `pdf`.
    await expect(page.getByRole('img', { name: 'Página 3 de 3' })).toBeVisible();
    await request.post(`${LARA}/__derrubar-sessao`);
    await page.getByRole('button', { name: 'Li o documento, continuar' }).click();
    await expect(page.getByText('Sua sessão terminou. Abra o link de novo para continuar.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Começar' })).toBeVisible();
    const nomes = (await cookiesDaArea(page)).map((c) => c.name);
    expect(nomes).toEqual(['assinatura_link']);
  });

  test('aviso quando falta pouco para a sessão terminar', async ({ page, request }) => {
    await cenario(request, { restante: 30 });
    await comecar(page);
    await expect(page.getByTestId('aviso-sessao')).toContainText('Sua sessão termina em');
  });

  test('sair sem assinar mantém o link', async ({ page, request }) => {
    await cenario(request);
    await comecar(page);
    await page.getByRole('button', { name: 'Sair sem assinar' }).click();
    await expect(page.getByText(/O link continua valendo/)).toBeVisible();
    expect((await cookiesDaArea(page)).map((c) => c.name)).toEqual(['assinatura_link']);
  });
});

test.describe('envio', () => {
  test('resposta perdida no assinar: confere pelo link e mostra o sucesso', async ({ page, request }) => {
    await cenario(request, { semFormulario: true, semAnexos: true, assinarPerdeResposta: true });
    await assinarDocumentoSimples(page);
    await expect(page.getByRole('heading', { name: 'Assinatura registrada' })).toBeVisible();
    const rotas = (await registro(request)).filter((c) => c.rota !== 'sessao').map((c) => c.rota);
    expect(rotas.slice(-2)).toEqual(['assinar', 'link']);
    expect(await cookiesDaArea(page)).toEqual([]);
  });

  test('recusar o documento, com confirmação', async ({ page, request }) => {
    await cenario(request, { semFormulario: true, semAnexos: true });
    await comecar(page);
    await confirmarCpf(page);
    await expect(page.getByRole('heading', { name: 'Leia o documento' })).toBeVisible();
    await page.getByRole('button', { name: 'Recusar documento' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('encerra este documento para todos');
    await dialogo.locator('textarea').fill('Valor diferente do combinado.');
    await dialogo.getByRole('button', { name: 'Recusar documento' }).click();
    await expect(page.getByRole('heading', { name: 'Documento recusado' })).toBeVisible();
    await expect(page.getByText('Recusa registrada. O clube foi avisado.')).toBeVisible();
    expect(await cookiesDaArea(page)).toEqual([]);
  });
});
