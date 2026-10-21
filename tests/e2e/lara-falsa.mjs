/**
 * Lara falsa para os testes de ponta a ponta da assinatura remota.
 *
 * Implementa o contrato de /api/assinatura/remota/* em memória, com o mínimo
 * de regra para o fluxo andar (CPF certo, perguntas, anexos obrigatórios,
 * mínimo de pontos), e dois endpoints de controle para os testes:
 *
 *   POST /__cenario   { ...opções }   reinicia o estado com as opções dadas
 *   GET  /__registro                  chamadas recebidas (sem dado pessoal)
 *
 * NUNCA aponte o site real para isto; é só para `npm run test:e2e`.
 */

import http from 'node:http';
import crypto from 'node:crypto';

const PORTA = Number(process.env.LARA_FALSA_PORTA ?? 4010);
const TOKEN_API = 'token-teste';
export const TOKEN_LINK = 'Tk' + 'a1B2c3D4'.repeat(7) + 'zz0099';
const CPF_CERTO = '52998224725';
const PREFIXO = '/api/assinatura/remota/';

let estado;

function reiniciar(cenario = {}) {
  estado = {
    cenario,
    sessao: null,
    identidadeOk: false,
    tentativas: cenario.tentativas ?? 5,
    usado: false,
    respondido: false,
    respostas: {},
    versao: 'v1',
    anexos: [
      { key: 'doc_identidade', label: 'Identidade', required: true, files: [] },
      {
        key: 'doc_comprovante',
        label: 'Comprovante de residência',
        required: false,
        files: [
          { id: 7, type: 'pdf', size_label: 'PDF, 120 KB', sent_at: '2026-10-20T10:00:00-03:00', mine: false, can_remove: false },
        ],
      },
    ],
    proximoId: 100,
    registro: [],
  };
}
reiniciar();

/* ------------------------------------------------------------------ PDF */

function pdfMinimo(paginas, rotulo) {
  const objetos = [];
  const kids = [];
  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  for (let i = 0; i < paginas; i += 1) {
    const pagina = 4 + i * 2;
    const conteudo = pagina + 1;
    kids.push(`${pagina} 0 R`);
    const fluxo = `BT /F1 28 Tf 72 700 Td (${rotulo} - pagina ${i + 1}) Tj ET`;
    objetos[conteudo] = `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`;
    objetos[pagina] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${conteudo} 0 R >>`;
  }
  objetos[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${paginas} >>`;

  let saida = '%PDF-1.4\n';
  const posicoes = [];
  for (let n = 1; n < objetos.length; n += 1) {
    posicoes[n] = saida.length;
    saida += `${n} 0 obj\n${objetos[n]}\nendobj\n`;
  }
  const xref = saida.length;
  saida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objetos.length; n += 1) saida += `${String(posicoes[n]).padStart(10, '0')} 00000 n \n`;
  saida += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(saida, 'latin1');
}

/* ------------------------------------------------------------------ dados */

function linkInfo() {
  const c = estado.cenario;
  return {
    document: { title: 'Contrato de locação — Salão Nobre', validation_code: 'K7M2Q9XA' },
    signer: { name: 'Maria de Souza', role: 'Contratante' },
    sent_by: 'Ana (atendimento)',
    sent_at: '2026-10-21T14:02:11-03:00',
    expires_at: '2026-10-24T14:02:11-03:00',
    requirements: {
      identity: 'cpf_full',
      photo: true,
      initials: Boolean(c.comVisto),
      form: !c.semFormulario,
      attachments: c.semAnexos ? 0 : 2,
      attachments_required: c.semAnexos ? 0 : 1,
    },
    identity_attempts_left: estado.tentativas,
    server_time: '2026-10-21T15:10:00-03:00',
  };
}

function listaAnexos() {
  const items = estado.cenario.semAnexos ? [] : estado.anexos;
  return {
    items,
    missing_required: items.filter((i) => i.required && i.files.length === 0).map((i) => i.label),
    max_kb: estado.cenario.maxKb ?? 10240,
    accepted_types: ['pdf', 'jpg', 'png'],
  };
}

function sessaoInfo() {
  const c = estado.cenario;
  return {
    document: { id: 812, title: 'Contrato de locação — Salão Nobre', pdf_url: null, pdf_version: estado.versao },
    form: c.semFormulario
      ? null
      : {
          answered: estado.respondido,
          fields: [
            { key: 'telefone', question: 'Qual o seu telefone?', type: 'phone', required: true, options: [], value: estado.respostas.telefone ?? '' },
            { key: 'evento', question: 'Tipo de evento', type: 'radio', required: true, options: ['Aniversário', 'Casamento', 'Outro'], value: estado.respostas.evento ?? 'Aniversário' },
            { key: 'bebida', question: 'Haverá bebida alcoólica?', type: 'yes_no', required: true, options: [], value: estado.respostas.bebida ?? '' },
            { key: 'data_evento', question: 'Data do evento', type: 'date', required: false, options: [], value: estado.respostas.data_evento ?? '2026-11-15' },
          ],
        },
    signer: { name: 'Maria de Souza', role: 'Contratante', has_email: true },
    rules: {
      identity_check: 'full',
      requires_photo: true,
      requires_initials: Boolean(c.comVisto),
      identity_confirmed: estado.identidadeOk,
    },
    session: { remaining_seconds: c.restante ?? 1800, warning_seconds: 60 },
    server_time: '2026-10-21T15:10:02-03:00',
    photo_consent_text: 'Autorizo a captura da minha imagem (foto) para anexo ao contrato.\nA imagem será usada só como evidência desta assinatura.',
    attachments: estado.identidadeOk ? listaAnexos() : null,
    link: { expires_at: '2026-10-24T14:02:11-03:00', identity_attempts_left: estado.tentativas },
  };
}

/* ------------------------------------------------------------------ http */

function responder(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(corpo));
}

function recusa(res, status, reason, error) {
  responder(res, status, { error, reason });
}

function lerCorpo(req) {
  return new Promise((resolve) => {
    const partes = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', () => resolve(Buffer.concat(partes)));
  });
}

function pontos(tracos) {
  return Array.isArray(tracos) ? tracos.reduce((s, t) => s + (Array.isArray(t?.points) ? t.points.length : 0), 0) : 0;
}

/** Estado do link para as rotas que dependem dele. Devolve true se já respondeu. */
function recusaDoLink(res) {
  const c = estado.cenario;
  if (c.linkErro) {
    recusa(res, c.linkErro.status, c.linkErro.reason, c.linkErro.error);
    return true;
  }
  if (estado.usado) {
    recusa(res, 409, 'link_used', 'Você já assinou este documento. Obrigado!');
    return true;
  }
  if (estado.tentativas <= 0) {
    recusa(res, 423, 'link_locked', 'O CPF não conferiu nas tentativas permitidas.');
    return true;
  }
  return false;
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://lara');
  const corpoBruto = await lerCorpo(req);

  if (url.pathname === '/__saude') return responder(res, 200, { ok: true });
  if (url.pathname === '/__cenario' && req.method === 'POST') {
    reiniciar(JSON.parse(corpoBruto.toString() || '{}'));
    return responder(res, 200, { ok: true });
  }
  if (url.pathname === '/__registro') return responder(res, 200, estado.registro);
  if (url.pathname === '/__derrubar-sessao') {
    estado.sessao = null;
    return responder(res, 200, { ok: true });
  }

  if (!url.pathname.startsWith(PREFIXO)) return recusa(res, 404, 'not_found', 'Rota inexistente.');
  const rota = url.pathname.slice(PREFIXO.length);

  let json = {};
  const tipo = req.headers['content-type'] ?? '';
  if (tipo.startsWith('application/json') && corpoBruto.length) json = JSON.parse(corpoBruto.toString());

  estado.registro.push({
    metodo: req.method,
    rota: rota.replace(/\d+$/, '{id}'),
    autorizacao: req.headers.authorization,
    ip: req.headers['x-signer-ip'] ?? null,
    navegador: Boolean(req.headers['x-signer-user-agent']),
    temSessao: Boolean(req.headers['x-signature-session']),
    resumo:
      rota === 'assinar'
        ? {
            pontos: pontos(json.strokes),
            pontosVisto: pontos(json.initials_strokes),
            assinaturaPng: String(json.signature ?? '').startsWith('data:image/png;base64,'),
            fotoJpeg: String(json.photo ?? '').startsWith('data:image/jpeg;base64,'),
            photo_consent: json.photo_consent,
            accepted: json.accepted,
            wants_copy: json.wants_copy,
            read_seconds: json.read_seconds,
            scrolled_to_end: json.scrolled_to_end,
            viewport: json.viewport,
          }
        : rota === 'visualizado'
          ? json
          : undefined,
  });

  if (req.headers.authorization !== `Bearer ${TOKEN_API}` || estado.cenario.naoAutorizado) {
    return recusa(res, 401, 'unauthorized', 'Credencial inválida.');
  }

  // Rotas sem sessão
  if (rota === 'link' || rota === 'abrir') {
    if (json.token !== TOKEN_LINK) return recusa(res, 404, 'invalid_link', 'Não encontramos este link.');
    if (recusaDoLink(res)) return;
    if (rota === 'link') return responder(res, 200, linkInfo());
    estado.sessao = crypto.randomBytes(32).toString('hex');
    estado.identidadeOk = false;
    return responder(res, 200, { session_token: estado.sessao, ...sessaoInfo() });
  }

  // Rotas com sessão
  if (!estado.sessao || req.headers['x-signature-session'] !== estado.sessao) {
    return recusa(res, 419, 'session_ended', 'Sua sessão terminou. Abra o link de novo para continuar.');
  }
  if (recusaDoLink(res)) return;

  if (rota === 'sessao') return responder(res, 200, sessaoInfo());
  if (rota === 'encerrar') {
    estado.sessao = null;
    return responder(res, 200, { ok: true });
  }
  if (rota === 'recusar') {
    estado.usado = true;
    return responder(res, 200, { ok: true, message: 'Recusa registrada. O clube foi avisado.' });
  }

  if (rota === 'identidade') {
    if (String(json.cpf ?? '').replace(/\D/g, '') === CPF_CERTO) {
      estado.identidadeOk = true;
      return responder(res, 200, { ok: true });
    }
    estado.tentativas -= 1;
    if (estado.tentativas <= 0) return recusa(res, 423, 'link_locked', 'O CPF não conferiu nas tentativas permitidas.');
    return responder(res, 422, {
      error: 'O CPF não confere com o cadastro.',
      reason: 'identity_failed',
      attempts_left: estado.tentativas,
    });
  }

  if (!estado.identidadeOk) {
    return recusa(res, 409, 'identity_required', 'Confirme o seu CPF antes de continuar.');
  }

  if (rota === 'pdf') {
    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    return res.end(pdfMinimo(3, estado.versao === 'v1' ? 'Contrato' : 'Contrato respondido'));
  }

  if (rota === 'respostas') {
    const respostas = json.answers ?? {};
    const errors = {};
    if (String(respostas.telefone ?? '').replace(/\D/g, '').length < 10) errors.telefone = 'Informe um telefone com DDD.';
    if (!['sim', 'nao'].includes(respostas.bebida)) errors.bebida = 'Responda sim ou não.';
    if (Object.keys(errors).length) {
      return responder(res, 422, { error: 'Confira as respostas destacadas.', reason: 'invalid_answers', errors });
    }
    estado.respostas = respostas;
    estado.respondido = true;
    estado.versao = 'v2';
    return responder(res, 200, sessaoInfo());
  }

  if (rota === 'visualizado') return responder(res, 200, { ok: true });

  if (rota === 'anexos' && req.method === 'GET') return responder(res, 200, listaAnexos());
  if (rota === 'anexos' && req.method === 'POST') {
    const texto = corpoBruto.toString('latin1');
    const chave = /name="key"\r\n\r\n([^\r]*)\r\n/.exec(texto)?.[1];
    const item = estado.anexos.find((i) => i.key === chave);
    if (!item) return recusa(res, 422, 'attachment_refused', 'Item de anexo inválido.');
    const ehPdf = texto.includes('%PDF');
    const ehPng = texto.includes('PNG');
    if (!ehPdf && !ehPng && !texto.includes('JFIF')) {
      return recusa(res, 422, 'attachment_refused', 'Envie um PDF, JPG ou PNG.');
    }
    item.files.push({
      id: estado.proximoId++,
      type: ehPdf ? 'pdf' : ehPng ? 'png' : 'jpg',
      size_label: `${ehPdf ? 'PDF' : 'Imagem'}, ${Math.max(1, Math.round(corpoBruto.length / 1024))} KB`,
      sent_at: '2026-10-21T15:12:40-03:00',
      mine: true,
      can_remove: true,
    });
    return responder(res, 201, listaAnexos());
  }
  if (rota.startsWith('anexos/') && req.method === 'DELETE') {
    const id = Number(rota.slice('anexos/'.length));
    for (const item of estado.anexos) {
      const arquivo = item.files.find((f) => f.id === id);
      if (arquivo) {
        if (!arquivo.mine) return recusa(res, 403, 'attachment_refused', 'Este anexo foi enviado pelo clube.');
        item.files = item.files.filter((f) => f.id !== id);
        return responder(res, 200, listaAnexos());
      }
    }
    return recusa(res, 404, 'attachment_refused', 'Anexo não encontrado.');
  }

  if (rota === 'assinar') {
    if (listaAnexos().missing_required.length) {
      return recusa(res, 409, 'attachments_missing', 'Falta anexar documento obrigatório.');
    }
    if (pontos(json.strokes) < 30) return recusa(res, 422, 'invalid', 'A assinatura está curta demais.');
    if (estado.cenario.comVisto && pontos(json.initials_strokes) < 8) return recusa(res, 422, 'invalid', 'Falta o visto.');
    if (!String(json.photo ?? '').startsWith('data:image/jpeg')) return recusa(res, 422, 'invalid', 'Falta a foto.');
    if (json.photo_consent !== true || json.accepted !== true) return recusa(res, 422, 'invalid', 'Falta o aceite.');
    estado.usado = true;
    if (estado.cenario.assinarPerdeResposta) {
      // Gravou, mas a resposta não chega: o site precisa conferir pelo `link`.
      req.socket.destroy();
      return;
    }
    return responder(res, 200, {
      ok: true,
      message: 'Assinatura registrada. Obrigado!',
      signed_at: '2026-10-21T15:20:00-03:00',
      validation_code: 'K7M2Q9XA',
    });
  }

  return recusa(res, 404, 'not_found', 'Rota inexistente.');
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`Lara falsa em http://127.0.0.1:${PORTA}`);
});
