/**
 * Formatação e regras de exibição da área de Replay.
 *
 * A regra dos 7 dias mora na Lara (grava, guarda 7 dias, apaga). Aqui só
 * traduzimos o que ela devolve para o que o sócio lê na tela — e deixamos
 * explícito que a `url` do vídeo não deve ser guardada em lugar nenhum:
 * ela vira 404 quando o arquivo é apagado.
 */

import type { ReplayOrientation, ReplayPlace, ReplayVideo } from "../services/replay-api";

/** A partir daqui o prazo vira aviso em destaque no card. */
export const REPLAY_URGENT_DAYS = 2;

export function formatRecordedAt(isoDate: string): string {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Data indisponível";

    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatRecordedAtLong(isoDate: string): string {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Data indisponível";

    return date.toLocaleString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** "há 2 horas", "ontem", "12/09" — para o último vídeo de uma quadra. */
export function formatRelative(isoDate: string | null): string {
    if (!isoDate) return "sem gravação recente";

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "sem gravação recente";

    const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000);

    if (diffMinutes < 1) return "agora mesmo";
    if (diffMinutes < 60) return `há ${diffMinutes} min`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `há ${diffHours} h`;

    const diffDays = Math.round(diffHours / 24);
    if (diffDays === 1) return "ontem";
    if (diffDays < 7) return `há ${diffDays} dias`;

    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
    if (seconds < 60) return `${Math.round(seconds)}s`;

    const minutes = Math.floor(seconds / 60);
    const rest = Math.round(seconds % 60);
    return rest === 0 ? `${minutes}min` : `${minutes}min ${rest}s`;
}

export function formatSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
    return `${mb.toFixed(1)} MB`;
}

/** Texto do prazo. Quem quiser guardar o vídeo precisa baixar antes. */
export function formatDaysLeft(daysLeft: number): string {
    if (daysLeft <= 0) return "expira hoje";
    if (daysLeft === 1) return "resta 1 dia";
    return `restam ${daysLeft} dias`;
}

export function isUrgent(daysLeft: number): boolean {
    return daysLeft <= REPLAY_URGENT_DAYS;
}

/** Já passou da validade — o arquivo na Lara provavelmente não existe mais. */
export function isExpired(video: { days_left: number; expires_at: string }): boolean {
    if (video.days_left < 0) return true;

    const expiresAt = Date.parse(video.expires_at);
    return Number.isFinite(expiresAt) && expiresAt < Date.now();
}

/**
 * Proporção do player. Um vídeo vertical numa moldura 16:9 vira duas tarjas
 * pretas gigantes com um filete de jogo no meio.
 */
export function aspectRatioFor(orientation: ReplayOrientation): string {
    return orientation === "vertical" ? "9 / 16" : "16 / 9";
}

/* -------------------------------------------------------------------------- */
/* Agrupamento por esporte                                                    */
/* -------------------------------------------------------------------------- */

/** Um esporte e as quadras dele que têm vídeo agora. */
export interface ReplayGroupedPlaces {
    id: number;
    name: string;
    places: ReplayPlace[];
    videosCount: number;
    lastRecordedAt: string | null;
}

/** Quadra sem esporte cadastrado não pode sumir da tela por causa disso. */
const UNGROUPED_NAME = "Outras quadras";

function moreRecent(a: string | null, b: string | null): string | null {
    if (!a) return b;
    if (!b) return a;
    return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Agrupa por `place_group`, mantendo `GET /replay/places` como única fonte —
 * a lista continua sendo só de quadras que têm vídeo disponível agora, e
 * nenhum esporte vazio aparece.
 *
 * Esportes e quadras saem ordenados pela gravação mais recente: quem abre a
 * tela quer o jogo de hoje, não a ordem de cadastro.
 */
export function groupPlacesBySport(places: ReplayPlace[]): ReplayGroupedPlaces[] {
    const groups = new Map<number, ReplayGroupedPlaces>();

    for (const place of places) {
        const id = place.place_group?.id ?? 0;
        const name = place.place_group?.name || UNGROUPED_NAME;

        const group = groups.get(id) ?? {
            id,
            name,
            places: [],
            videosCount: 0,
            lastRecordedAt: null,
        };

        group.places.push(place);
        group.videosCount += place.videos_count;
        group.lastRecordedAt = moreRecent(group.lastRecordedAt, place.last_recorded_at);

        groups.set(id, group);
    }

    const sortByRecency = <T extends { last_recorded_at?: string | null; lastRecordedAt?: string | null }>(
        a: T,
        b: T
    ) => {
        const aDate = Date.parse(a.last_recorded_at ?? a.lastRecordedAt ?? "") || 0;
        const bDate = Date.parse(b.last_recorded_at ?? b.lastRecordedAt ?? "") || 0;
        return bDate - aDate;
    };

    const result = Array.from(groups.values());
    for (const group of result) group.places.sort(sortByRecency);
    result.sort(sortByRecency);

    // A vala comum das quadras sem esporte fica por último, sempre.
    return result.sort((a, b) => (a.id === 0 ? 1 : 0) - (b.id === 0 ? 1 : 0));
}

/** Um esporte e os vídeos do sócio naquele esporte. */
export interface ReplayGroupedVideos {
    id: number;
    name: string;
    videos: ReplayVideo[];
    lastRecordedAt: string | null;
}

/**
 * Mesmo agrupamento de `groupPlacesBySport`, agora sobre os vídeos do sócio.
 *
 * A ordem dos vídeos dentro do esporte é preservada — `fetchMyVideos` já os
 * entrega do mais recente para o mais antigo, que é a ordem que a tela promete.
 */
export function groupVideosBySport(videos: ReplayVideo[]): ReplayGroupedVideos[] {
    const groups = new Map<number, ReplayGroupedVideos>();

    for (const video of videos) {
        const id = video.place_group?.id || 0;
        const name = video.place_group?.name || UNGROUPED_NAME;

        const group = groups.get(id) ?? { id, name, videos: [], lastRecordedAt: null };

        group.videos.push(video);
        group.lastRecordedAt = moreRecent(group.lastRecordedAt, video.recorded_at);

        groups.set(id, group);
    }

    const result = Array.from(groups.values());
    result.sort(
        (a, b) => (Date.parse(b.lastRecordedAt ?? "") || 0) - (Date.parse(a.lastRecordedAt ?? "") || 0)
    );

    // Vídeo sem esporte cadastrado não some da tela, mas também não abre a fila.
    return result.sort((a, b) => (a.id === 0 ? 1 : 0) - (b.id === 0 ? 1 : 0));
}

/* -------------------------------------------------------------------------- */
/* Imagem do esporte                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Fotos das quadras do próprio clube, já no repositório (as mesmas do
 * carrossel do login).
 *
 * A API de replay devolve do esporte só `{id, name}` — sem imagem. E
 * `places/group`, que tem as imagens que a home usa, é endpoint autenticado:
 * a galeria de replay é aberta a visitante deslogado e não pode depender dele.
 *
 * Daí o casamento por nome. É um paliativo consciente: esporte novo cai no
 * degradê e a tela continua de pé. A solução durável é a Lara mandar a imagem
 * do grupo em `/replay/places`; quando mandar, troque isto pelo campo dela.
 */
const SPORT_IMAGES: Array<[RegExp, string]> = [
    [/beach/, "bg-beach-tennis.jpg"],
    [/padel/, "bg-padel.jpg"],
    [/tenis/, "bg-tennis.jpg"],
    [/futebol|futsal|society|campo/, "bg-futebol.jpg"],
    [/areia/, "bg-volei-baixo.jpg"],
    [/volei|volley/, "bg-volei-cima.jpg"],
];

/** Foto de fundo do esporte, ou `null` quando não houver — aí entra o degradê. */
export function sportImage(groupName: string): string | null {
    const normalized = groupName
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();

    for (const [pattern, file] of SPORT_IMAGES) {
        if (pattern.test(normalized)) return `/images/carousel/${file}`;
    }

    return null;
}

/* -------------------------------------------------------------------------- */
/* Entrega do arquivo de vídeo                                                */
/* -------------------------------------------------------------------------- */

/** Diretório da Lara onde os clipes ficam (docs/replay-api.md, §7). */
const MEDIA_MARKER = "/storage/replay/videos/";

/**
 * `direct` usa a `url` da Lara como ela vem — é o modo que o contrato descreve
 * e o melhor: o arquivo estático serve range request sozinho, sem custo para o
 * Next. Só funciona quando esse diretório está publicado num host que o
 * navegador do sócio alcança.
 *
 * `proxy` (padrão) passa pela rota `/api/replay/media`, que repassa o `Range`
 * para a Lara. É o que funciona hoje, com a Lara fechada para a internet.
 *
 * Trocar de um para o outro é mudar esta variável — nada mais no site muda.
 */
const MEDIA_MODE = process.env.NEXT_PUBLIC_REPLAY_MEDIA_MODE === "direct" ? "direct" : "proxy";

/**
 * Endereço que o `<video src>` e o botão de baixar devem usar.
 *
 * `download: true` só tem efeito no modo proxy, onde a resposta ganha
 * `Content-Disposition: attachment` — entre origens diferentes o atributo
 * `download` do `<a>` é ignorado pelo navegador.
 */
export function resolveMediaUrl(rawUrl: string, options: { download?: boolean } = {}): string {
    if (!rawUrl) return rawUrl;
    if (MEDIA_MODE === "direct") return rawUrl;

    const markerAt = rawUrl.indexOf(MEDIA_MARKER);
    // Formato inesperado: devolve a URL original em vez de quebrar o player.
    if (markerAt === -1) return rawUrl;

    const filePath = rawUrl.slice(markerAt + MEDIA_MARKER.length).replace(/^\/+/, "");
    if (!filePath) return rawUrl;

    return `/api/replay/media/${filePath}${options.download ? "?download=1" : ""}`;
}

/** `YYYY-MM-DD` no fuso local — formato que o filtro `?date=` da Lara espera. */
export function toApiDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/** Slug `nome-id`, mesma convenção já usada em /place e /places. */
export function placeSlug(name: string, id: number | string): string {
    const slug = name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase();

    return `${slug}-${id}`;
}

export function placeIdFromSlug(slug: string): string {
    return slug.split("-").pop() || "";
}
