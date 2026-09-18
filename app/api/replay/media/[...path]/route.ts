/**
 * Entrega dos arquivos de vídeo do Replay.
 *
 * O contrato da Lara (docs/replay-api.md, §7) manda usar a `url` do vídeo
 * direto no `<video src>`, sem proxy — e por um bom motivo: é o arquivo
 * estático que suporta *range request*, e é o range que deixa o visitante
 * arrastar a barra do player em vez de assistir do começo.
 *
 * Só que nem a Lara de homologação nem a de produção são publicadas na
 * internet: do navegador do sócio, `https://lara.../storage/replay/...` não
 * resolve. Só esta aplicação, de dentro da DMZ, alcança aquele host. Sem algo
 * aqui no meio, o player simplesmente não carrega nada.
 *
 * Então esta rota repassa o arquivo PRESERVANDO o que a regra protege:
 * encaminha o header `Range` para a Lara e devolve o `206 Partial Content`
 * com `Content-Range`/`Accept-Ranges` intactos. O seek continua funcionando;
 * o que se paga é banda e uma conexão aberta no Next por vídeo em reprodução.
 *
 * É uma ponte, não o destino. Publicando um vhost somente-leitura para
 * `storage/replay/videos/` (ex.: replay.clubedosfuncionarios.com.br), basta
 * ligar NEXT_PUBLIC_REPLAY_MEDIA_MODE=direct e o site volta a apontar para o
 * arquivo estático, sem passar por aqui. Ver `resolveMediaUrl` em utils/replay.
 *
 * Limites deliberados:
 *  - Só GET e HEAD.
 *  - O caminho é fixo em /storage/replay/videos/: esta rota não alcança a API
 *    da Lara nem nenhum outro diretório. Não é um proxy de uso geral.
 *  - Sem sessão: a galeria da quadra é aberta por decisão de negócio, e o
 *    arquivo de um vídeo de reserva já aparece nela. Esta rota não amplia o
 *    acesso que a Lara já concede.
 */

import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
/* O arquivo é streamado; nada aqui pode ser pré-renderizado ou cacheado pelo Next. */
export const fetchCache = "force-no-store";

const LARA_URL = process.env.INTERNAL_LARA_API_URL;

/** Único diretório alcançável por esta rota. */
const MEDIA_PREFIX = "/storage/replay/videos/";

/** Nomes de arquivo da Lara são `AAAA/MM/<uuid>.mp4` — nada além disso passa. */
const SEGMENT = /^[A-Za-z0-9._-]+$/;

const PASSTHROUGH_HEADERS = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "last-modified",
    "etag",
];

function buildUpstreamUrl(segments: string[]): string | null {
    if (!LARA_URL) return null;
    if (segments.length === 0 || segments.length > 8) return null;

    for (const segment of segments) {
        if (!SEGMENT.test(segment)) return null;
        if (segment === "." || segment === "..") return null;
    }

    return `${LARA_URL.replace(/\/+$/, "")}${MEDIA_PREFIX}${segments.join("/")}`;
}

async function handle(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> },
    method: "GET" | "HEAD"
): Promise<Response> {
    const { path } = await context.params;
    const upstreamUrl = buildUpstreamUrl(path ?? []);

    if (!upstreamUrl) {
        return new Response("Arquivo inválido.", { status: 400 });
    }

    const headers = new Headers();
    // O range é o motivo de esta rota existir em vez de um download simples.
    const range = request.headers.get("range");
    if (range) headers.set("Range", range);

    const ifRange = request.headers.get("if-range");
    if (ifRange) headers.set("If-Range", ifRange);

    let upstream: Response;
    try {
        upstream = await fetch(upstreamUrl, { method, headers, cache: "no-store" });
    } catch {
        return new Response("Não foi possível alcançar o arquivo.", { status: 502 });
    }

    // 404 aqui quase sempre significa vídeo expirado: a Lara apaga o arquivo 7
    // dias depois da gravação. A tela trata isso como "expirou", não como erro.
    if (upstream.status === 404) {
        return new Response("Vídeo expirado ou inexistente.", { status: 404 });
    }

    const responseHeaders = new Headers();
    for (const name of PASSTHROUGH_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
    }

    // Sem isto o player não oferece seek quando a Lara não anuncia o suporte.
    if (!responseHeaders.has("accept-ranges")) {
        responseHeaders.set("accept-ranges", "bytes");
    }

    // `<a download>` entre origens diferentes é ignorado pelo navegador; como
    // agora a rota é da mesma origem, o attachment faz o arquivo ser salvo em
    // vez de abrir numa aba.
    if (request.nextUrl.searchParams.get("download") === "1") {
        const fileName = path[path.length - 1];
        responseHeaders.set("content-disposition", `attachment; filename="${fileName}"`);
    }

    // O arquivo é imutável enquanto existe, mas some em 7 dias: cache curto.
    responseHeaders.set("cache-control", "private, max-age=300");

    return new Response(method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
    });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return handle(request, context, "GET");
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return handle(request, context, "HEAD");
}
