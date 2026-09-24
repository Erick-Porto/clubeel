/**
 * Destino pós-login.
 *
 * O NextAuth (e o middleware) põem `?callbackUrl=` no /login quando alguém
 * tenta abrir uma página protegida deslogado — é isso que faz o link do e-mail
 * de replay cair em /meus-videos depois da autenticação, sem passo extra.
 *
 * Só aceita caminho interno: um `callbackUrl` absoluto vindo da URL é vetor de
 * open redirect (phishing hospedado no nosso próprio domínio de login).
 */

export const DEFAULT_CALLBACK_URL = "/";

export function safeCallbackUrl(raw: string | null | undefined): string {
    if (!raw) return DEFAULT_CALLBACK_URL;

    let value = raw.trim();
    if (!value) return DEFAULT_CALLBACK_URL;

    // O NextAuth manda a URL absoluta da própria aplicação; reduz para o path.
    if (/^https?:\/\//i.test(value)) {
        try {
            const url = new URL(value);
            const appUrl = process.env.NEXT_PUBLIC_APP_URL;
            const sameOrigin =
                (typeof window !== "undefined" && url.origin === window.location.origin) ||
                (appUrl ? url.origin === new URL(appUrl).origin : false);

            if (!sameOrigin) return DEFAULT_CALLBACK_URL;
            value = `${url.pathname}${url.search}${url.hash}`;
        } catch {
            return DEFAULT_CALLBACK_URL;
        }
    }

    // `//evil.com` e `/\evil.com` são caminhos protocol-relative: saem do site.
    if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
        return DEFAULT_CALLBACK_URL;
    }

    // Voltar para o próprio login seria um laço.
    if (value === "/login" || value.startsWith("/login?")) return DEFAULT_CALLBACK_URL;

    return value;
}
