/**
 * Prefixo de caminho do site (homologação).
 *
 * Produção roda na raiz (`NEXT_PUBLIC_BASE_PATH` vazio). A homologação é uma
 * segunda instância do mesmo código, compilada com `NEXT_PUBLIC_BASE_PATH=/homolog`
 * e servida pelo mesmo domínio em `/homolog/*` (ver docs/resumo-modulos/01).
 *
 * O Next aplica o `basePath` sozinho em `<Link>`, `router.push` e `redirect()`.
 * Ele NÃO aplica em: `fetch('/api/...')`, `src="/images/..."` (string, inclusive
 * no `<Image>`), `url(...)` em `style`, `<video src>`, `callbackUrl` do NextAuth,
 * `new URL(..., request.url)` e `path` de cookie. Nesses casos use `comBase`.
 *
 * A variável é `NEXT_PUBLIC_` porque precisa existir no bundle do cliente; ela é
 * fixada no build — trocar o valor exige `npm run build` de novo.
 */

function normalizar(bruto: string | undefined): string {
    const valor = (bruto ?? "").trim().replace(/\/+$/, "");
    if (!valor) return "";
    return valor.startsWith("/") ? valor : `/${valor}`;
}

export const BASE_PATH = normalizar(process.env.NEXT_PUBLIC_BASE_PATH);

/** Se esta instância é a homologação (qualquer prefixo configurado). */
export const EM_HOMOLOGACAO = BASE_PATH !== "";

/** `/api/success` → `/homolog/api/success` (ou igual, em produção). */
export function comBase(caminho: string): string {
    if (!BASE_PATH) return caminho;
    return `${BASE_PATH}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

/**
 * Tira o prefixo de um caminho que já o traz (ex.: o `callbackUrl` que o
 * middleware monta). Necessário antes de `router.push`, que prefixa de novo.
 */
export function semBase(caminho: string): string {
    if (!BASE_PATH) return caminho;
    if (caminho === BASE_PATH) return "/";
    if (caminho.startsWith(`${BASE_PATH}/`) || caminho.startsWith(`${BASE_PATH}?`)) {
        const resto = caminho.slice(BASE_PATH.length);
        return resto.startsWith("/") ? resto : `/${resto}`;
    }
    return caminho;
}
