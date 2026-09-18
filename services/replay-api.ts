/**
 * Cliente da área de Replay (vídeos das quadras) na Lara.
 *
 * Duas coisas importam aqui:
 *
 * 1. As CHAMADAS DE API passam pelo proxy `pages/api/backend` (via API_CONSUME),
 *    como todo o resto do site. A Lara não é publicada na internet e o
 *    `INTERNAL_LARA_API_TOKEN` nunca pode chegar ao navegador — o proxy é quem
 *    põe o `Authorization: Bearer <appToken>` e, quando há sessão, o header
 *    `Session` com o JWT do sócio.
 *
 * 2. O ARQUIVO DE VÍDEO não passa por aqui nem pelo nosso servidor. A `url` que
 *    a Lara devolve é um arquivo estático servido por ela, e é usada direto no
 *    `<video src>`. É isso que preserva o range request (arrastar a barra do
 *    player em vez de assistir do começo) e evita torrar banda do Next.
 *
 * Nenhuma chamada daqui usa o interceptor de signOut automático do API_CONSUME
 * (`skipAuthCheck: true`): a galeria pública é aberta a visitante deslogado, e
 * um 401/403 da Lara não pode derrubar quem nunca esteve logado. Em "meus
 * vídeos", o 401 vira um estado de tela ("sessão expirada") em vez de um
 * redirect seco.
 */

import API_CONSUME from "./api-consume";

/* -------------------------------------------------------------------------- */
/* Contratos (docs/replay-api.md, no repositório da Lara)                      */
/* -------------------------------------------------------------------------- */

export type ReplayOrientation = "horizontal" | "vertical";

export interface ReplayPlaceRef {
    id: number;
    name: string;
}

export interface ReplayVideo {
    uuid: string;
    /** Arquivo estático na Lara. Expira em 7 dias — nunca persistir. */
    url: string;
    place: ReplayPlaceRef;
    place_group: ReplayPlaceRef;
    orientation: ReplayOrientation;
    duration_seconds: number;
    size_bytes: number;
    recorded_at: string;
    expires_at: string;
    days_left: number;
    /**
     * O vídeo foi gravado durante uma reserva. A API NÃO diz de quem, de
     * propósito — a galeria da quadra é pública. Não tente inferir.
     */
    has_member: boolean;
}

/** Quadra que tem vídeo disponível AGORA (`GET /replay/places`). */
export interface ReplayPlace {
    id: number;
    name: string;
    place_group?: ReplayPlaceRef | null;
    videos_count: number;
    last_recorded_at: string | null;
}

export interface ReplayPageMeta {
    current_page: number;
    last_page: number;
    per_page?: number;
    total?: number;
}

export interface ReplayVideoPage {
    videos: ReplayVideo[];
    meta: ReplayPageMeta;
    place: ReplayPlaceRef | null;
}

/** Resultado de uma chamada: ou deu certo, ou tem um motivo legível. */
export type ReplayResult<T> =
    | { ok: true; data: T }
    | { ok: false; status: number; reason: ReplayFailure; message: string };

export type ReplayFailure = "unauthorized" | "not_found" | "network" | "server";

/* -------------------------------------------------------------------------- */
/* Normalização                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A Lara às vezes devolve a coleção na raiz, às vezes aninhada em `data`.
 * Mesma tolerância já usada em `utils/lara.ts` e no CartContext.
 */
function extractArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        for (const key of ["data", "videos", "places"]) {
            if (Array.isArray(obj[key])) return obj[key] as unknown[];
        }
        const found = Object.values(obj).find((v) => Array.isArray(v));
        if (Array.isArray(found)) return found;
    }
    return [];
}

function toNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toPlaceRef(raw: unknown): ReplayPlaceRef {
    const obj = (raw ?? {}) as Record<string, unknown>;
    return { id: toNumber(obj.id), name: String(obj.name ?? "") };
}

function toVideo(raw: unknown): ReplayVideo {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const orientation: ReplayOrientation =
        obj.orientation === "vertical" ? "vertical" : "horizontal";

    return {
        uuid: String(obj.uuid ?? ""),
        url: String(obj.url ?? ""),
        place: toPlaceRef(obj.place),
        place_group: toPlaceRef(obj.place_group),
        orientation,
        duration_seconds: toNumber(obj.duration_seconds),
        size_bytes: toNumber(obj.size_bytes),
        recorded_at: String(obj.recorded_at ?? ""),
        expires_at: String(obj.expires_at ?? ""),
        days_left: toNumber(obj.days_left),
        has_member: obj.has_member === true,
    };
}

function toPlace(raw: unknown): ReplayPlace {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const group = obj.place_group ?? obj.group;

    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        place_group: group ? toPlaceRef(group) : null,
        videos_count: toNumber(obj.videos_count),
        last_recorded_at: obj.last_recorded_at ? String(obj.last_recorded_at) : null,
    };
}

function toMeta(raw: unknown, fallbackCount: number): ReplayPageMeta {
    const root = (raw ?? {}) as Record<string, unknown>;
    const meta = (root.meta ?? root) as Record<string, unknown>;

    return {
        current_page: toNumber(meta.current_page, 1) || 1,
        last_page: toNumber(meta.last_page, 1) || 1,
        per_page: meta.per_page !== undefined ? toNumber(meta.per_page) : undefined,
        total: meta.total !== undefined ? toNumber(meta.total) : fallbackCount,
    };
}

function failure(status: number, message?: string | null): ReplayResult<never> {
    let reason: ReplayFailure = "server";
    if (status === 401 || status === 403) reason = "unauthorized";
    else if (status === 404) reason = "not_found";
    else if (status === 502 || status === 503) reason = "network";

    const fallbackMessage =
        reason === "unauthorized"
            ? "Sua sessão expirou. Entre novamente para ver seus vídeos."
            : reason === "not_found"
              ? "Não encontramos esta quadra na área de replay."
              : reason === "network"
                ? "Não foi possível falar com o servidor. Tente de novo em instantes."
                : "Não foi possível carregar os vídeos agora.";

    return { ok: false, status, reason, message: message || fallbackMessage };
}

/* -------------------------------------------------------------------------- */
/* Chamadas                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Quadras que têm vídeo disponível agora. Público — sem sessão.
 *
 * Esta é a ÚNICA fonte da lista de quadras da área de replay. Montá-la a partir
 * de `places/group` levaria o visitante a clicar em quadra sem vídeo nenhum.
 */
export async function fetchReplayPlaces(): Promise<ReplayResult<ReplayPlace[]>> {
    const response = await API_CONSUME("GET", "replay/places", {}, null, {
        skipAuthCheck: true,
    });

    if (!response.ok) return failure(response.status, response.message);

    return { ok: true, data: extractArray(response.data).map(toPlace) };
}

/** Galeria pública de uma quadra, paginada (24 por página na Lara). */
export async function fetchPlaceVideos(
    placeId: number | string,
    options: { date?: string | null; page?: number } = {}
): Promise<ReplayResult<ReplayVideoPage>> {
    const params = new URLSearchParams();
    if (options.date) params.set("date", options.date);
    if (options.page && options.page > 1) params.set("page", String(options.page));

    const query = params.toString();
    const endpoint = `replay/places/${encodeURIComponent(String(placeId))}/videos${
        query ? `?${query}` : ""
    }`;

    const response = await API_CONSUME("GET", endpoint, {}, null, {
        skipAuthCheck: true,
    });

    if (!response.ok) return failure(response.status, response.message);

    const videos = extractArray(response.data).map(toVideo);
    const root = (response.data ?? {}) as Record<string, unknown>;

    return {
        ok: true,
        data: {
            videos,
            meta: toMeta(root, videos.length),
            place: root.place ? toPlaceRef(root.place) : (videos[0]?.place ?? null),
        },
    };
}

/**
 * Vídeos gravados durante as reservas pagas do sócio logado.
 *
 * O header `Session` é posto pelo proxy a partir da sessão NextAuth — este
 * módulo não manipula o JWT. Sem sessão, a resposta é 401 e vira o estado de
 * "sessão expirada" na tela, não um signOut automático.
 */
export async function fetchMyVideos(): Promise<ReplayResult<ReplayVideo[]>> {
    const response = await API_CONSUME("GET", "replay/my-videos", {}, null, {
        skipAuthCheck: true,
    });

    if (!response.ok) return failure(response.status, response.message);

    const videos = extractArray(response.data).map(toVideo);
    videos.sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));

    return { ok: true, data: videos };
}
