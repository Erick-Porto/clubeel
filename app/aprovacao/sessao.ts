/**
 * Sessão da área de aprovação de compras.
 *
 * Não tem NENHUMA relação com a sessão de sócio do NextAuth: cookie próprio,
 * nome próprio, path próprio. Um sócio logado não é um aprovador; um aprovador
 * não vira sócio.
 *
 * O token fica em cookie httpOnly e nunca sai do servidor — não vai para
 * localStorage, sessionStorage, estado de React nem para o payload de nenhum
 * componente de cliente. É o oposto do que o fluxo de sócio faz hoje, onde o
 * token da Lara é copiado para dentro da sessão do NextAuth e servido ao
 * navegador por GET /api/auth/session.
 */

import { cookies } from 'next/headers';
import type { AprovacaoUsuario } from '../../services/aprovacao-api';

export const COOKIE_TOKEN = 'aprovacao_token';
export const COOKIE_USUARIO = 'aprovacao_usuario';

/**
 * Escopado à área. As Server Actions são postadas para a própria rota, e o
 * Route Handler de expiração também vive sob /aprovacao, então tudo que precisa
 * do cookie o recebe.
 */
export const COOKIE_PATH = '/aprovacao';

const OITO_HORAS_MS = 8 * 60 * 60 * 1000;

/**
 * `secure` só em produção: em http://localhost o navegador descarta cookie
 * secure, e o login "funcionaria" sem a sessão nunca persistir.
 */
function opcoes(expiraEm: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: COOKIE_PATH,
    expires: expiraEm,
  };
}

/** Alinha a expiração do cookie ao `expira_em` da API. Sem refresh: expirou, loga de novo. */
function calcularExpiracao(expiraEm: string | undefined): Date {
  const instante = expiraEm ? Date.parse(expiraEm) : Number.NaN;
  if (Number.isNaN(instante) || instante <= Date.now()) {
    console.warn(
      `[aprovacao] expira_em ausente ou inválido ("${expiraEm}"); usando 8h a partir de agora.`
    );
    return new Date(Date.now() + OITO_HORAS_MS);
  }
  return new Date(instante);
}

/**
 * O nome do aprovador também vai em cookie httpOnly e é lido no servidor para
 * montar o cabeçalho. Base64url porque nome com acento em valor de cookie é
 * ambíguo entre camadas que codificam e camadas que não.
 */
function codificarUsuario(usuario: AprovacaoUsuario): string {
  return Buffer.from(JSON.stringify(usuario), 'utf8').toString('base64url');
}

export async function gravarSessao(
  token: string,
  expiraEm: string,
  usuario: AprovacaoUsuario
): Promise<void> {
  const expiracao = calcularExpiracao(expiraEm);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_TOKEN, token, opcoes(expiracao));
  cookieStore.set(COOKIE_USUARIO, codificarUsuario(usuario), opcoes(expiracao));
}

export async function lerToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_TOKEN)?.value ?? null;
}

export async function lerUsuario(): Promise<AprovacaoUsuario | null> {
  const cookieStore = await cookies();
  const bruto = cookieStore.get(COOKIE_USUARIO)?.value;
  if (!bruto) return null;
  try {
    const dados = JSON.parse(Buffer.from(bruto, 'base64url').toString('utf8'));
    if (dados && typeof dados.nome === 'string') return dados as AprovacaoUsuario;
  } catch {
    // Cookie corrompido: o cabeçalho fica sem nome, o que não impede trabalhar.
  }
  return null;
}

/** Usada pela Server Action de sair. */
export async function limparSessao(): Promise<void> {
  const cookieStore = await cookies();
  for (const nome of [COOKIE_TOKEN, COOKIE_USUARIO]) {
    cookieStore.set(nome, '', { path: COOKIE_PATH, maxAge: 0 });
  }
}
