/**
 * Saída para token expirado ou inválido.
 *
 * Um Server Component não pode apagar cookie durante a renderização, então
 * quando a API responde 401 a página redireciona para cá: este handler apaga a
 * sessão e manda para o login. É o que impede o laço de redirecionamento — sem
 * apagar o cookie, /aprovacao mandaria para o login, o login veria cookie
 * presente e mandaria de volta para /aprovacao, indefinidamente.
 *
 * O cookie é apagado na própria resposta de redirecionamento, não via
 * cookies(), para não depender da ordem de aplicação das duas coisas.
 *
 * Este handler é GET porque é destino de redirect — nunca é alvo de <Link>, que
 * o Next faria prefetch e deslogaria o usuário sem clique. O botão "Sair" usa a
 * Server Action `sair`, que é POST.
 */

import { NextResponse } from 'next/server';
import { COOKIE_PATH, COOKIE_TOKEN, COOKIE_USUARIO } from '../sessao';

export async function GET(request: Request) {
  const resposta = NextResponse.redirect(
    new URL('/aprovacao/login?motivo=expirada', request.url)
  );

  for (const nome of [COOKIE_TOKEN, COOKIE_USUARIO]) {
    resposta.cookies.set(nome, '', { path: COOKIE_PATH, maxAge: 0 });
  }

  return resposta;
}
