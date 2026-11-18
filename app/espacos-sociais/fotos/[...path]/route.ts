/**
 * Entrega das fotos da galeria dos espaços sociais.
 *
 * As fotos são arquivos estáticos da Lara (`/images/galeria/...`), servidos
 * direto pelo servidor web dela. Só que a Lara não é publicada na internet: do
 * navegador do sócio, o endereço dela não resolve. Esta rota busca o arquivo
 * de dentro da DMZ e o devolve no domínio do site.
 *
 * Limites deliberados:
 *  - Só GET e HEAD.
 *  - Só caminhos `images/...` com extensão de imagem e sem `..`
 *    (`segmentosDeFoto` em utils/social-fotos.ts). Não é um proxy de uso geral:
 *    não alcança a API da Lara nem outros diretórios.
 *  - Exige sessão de sócio: está sob `/espacos-sociais/:path*` no `matcher` do
 *    middleware. Ver e reservar os espaços é só para associados, por decisão do
 *    clube — por isso o cache é `private` (navegador do sócio), não `public`.
 *  - O nome do arquivo nunca muda (foto nova = arquivo novo; foto excluída some
 *    da API), então o navegador pode guardá-lo por um ano.
 */

import { NextRequest } from "next/server";
import { segmentosDeFoto } from "../../../../utils/social-fotos";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const LARA_URL = process.env.INTERNAL_LARA_API_URL;

const PASSTHROUGH_HEADERS = ["content-type", "content-length", "last-modified", "etag"];

async function handle(
    context: { params: Promise<{ path: string[] }> },
    method: "GET" | "HEAD"
): Promise<Response> {
    const { path } = await context.params;
    const segmentos = segmentosDeFoto(path ?? []);

    if (!segmentos || !LARA_URL) {
        return new Response("Foto inválida.", { status: 400 });
    }

    const upstreamUrl = `${LARA_URL.replace(/\/+$/, "")}/${segmentos.join("/")}`;

    let upstream: Response;
    try {
        upstream = await fetch(upstreamUrl, { method, cache: "no-store" });
    } catch {
        return new Response("Não foi possível alcançar a foto.", { status: 502 });
    }

    // Foto excluída no painel: o arquivo some junto.
    if (upstream.status === 404) {
        return new Response("Foto inexistente.", { status: 404 });
    }
    if (!upstream.ok) {
        return new Response("Não foi possível carregar a foto.", { status: 502 });
    }

    // Só repassa o que for imagem: um HTML de erro do servidor web não vira foto.
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
        return new Response("Não foi possível carregar a foto.", { status: 502 });
    }

    const responseHeaders = new Headers();
    for (const name of PASSTHROUGH_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("cache-control", "private, max-age=31536000, immutable");
    responseHeaders.set("x-content-type-options", "nosniff");

    return new Response(method === "HEAD" ? null : upstream.body, {
        status: 200,
        headers: responseHeaders,
    });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return handle(context, "GET");
}

export async function HEAD(_request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return handle(context, "HEAD");
}
