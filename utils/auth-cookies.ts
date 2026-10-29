/**
 * Cookies do NextAuth na homologação.
 *
 * Produção e homologação ficam no MESMO domínio. Com os nomes padrão
 * (`__Secure-next-auth.session-token`, `path=/`), as duas instâncias leriam e
 * sobrescreveriam o mesmo cookie: sair de uma derrubaria a outra, e o JWT de
 * uma seria rejeitado pela outra (segredos diferentes). Na homologação os
 * cookies ganham sufixo `.homolog` e `path=/homolog`; o navegador nem os envia
 * para a produção.
 *
 * Em produção devolve `undefined` e o NextAuth segue com os padrões dele —
 * nenhuma sessão de sócio existente é invalidada.
 *
 * Fica fora de `pages/api/auth/[...nextauth].ts` porque o middleware precisa do
 * nome do cookie de sessão e não pode importar aquele arquivo (puxa
 * `API_CONSUME`, toast, next-auth/react).
 */

import type { CookiesOptions } from "next-auth";
import { BASE_PATH, EM_HOMOLOGACAO } from "./base-path";

const SUFIXO = ".homolog";

function cookiesSeguros(): boolean {
    return (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
}

/** Nome do cookie de sessão (o middleware precisa dele para achar o JWT). */
export function nomeCookieSessao(): string | undefined {
    if (!EM_HOMOLOGACAO) return undefined;
    return `${cookiesSeguros() ? "__Secure-" : ""}next-auth.session-token${SUFIXO}`;
}

export function cookiesNextAuth(): Partial<CookiesOptions> | undefined {
    if (!EM_HOMOLOGACAO) return undefined;

    const seguro = cookiesSeguros();
    // `__Host-` exige `path=/`, então o csrf-token da homologação usa `__Secure-`.
    const prefixo = seguro ? "__Secure-" : "";
    const opcoes = { httpOnly: true, sameSite: "lax" as const, path: BASE_PATH, secure: seguro };

    return {
        sessionToken: { name: nomeCookieSessao()!, options: opcoes },
        callbackUrl: { name: `${prefixo}next-auth.callback-url${SUFIXO}`, options: opcoes },
        csrfToken: { name: `${prefixo}next-auth.csrf-token${SUFIXO}`, options: opcoes },
    };
}
