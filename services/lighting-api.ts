/**
 * Cliente da "luz da quadra" na Lara.
 *
 * Mesmo caminho do resto do site: navegador → `/api/backend` (API_CONSUME) →
 * Lara. O proxy põe o `Authorization` da aplicação e o `Session` do sócio; este
 * módulo nunca vê nenhum dos dois, e nenhum endpoint aceita id de sócio.
 *
 * O front não decide nada aqui. Janela, feriado, teto de duração e se a quadra
 * está livre são respostas da Lara — este arquivo só dá forma a elas. Em
 * recusa de regra, o comportamento da tela sai do `reason` (código estável) e o
 * texto exibido é o `error` (já escrito para o sócio). Nunca compare mensagens.
 *
 * 401/403 seguem o interceptor padrão do API_CONSUME (toast + login), como nas
 * telas de reserva. A luz não depende da sessão: ela continua acesa.
 */

import API_CONSUME from "./api-consume";

/* -------------------------------------------------------------------------- */
/* Contratos                                                                   */
/* -------------------------------------------------------------------------- */

export interface LightingWindow {
    date: string;
    start: string;
    end: string;
    starts_at: string;
    ends_at: string;
    /** `weekly` (grade semanal do painel) ou `date` (dia liberado no painel). */
    source: string;
    /** Em `date`, costuma trazer o nome do feriado. */
    reason: string | null;
}

export interface LightingActivation {
    id: number;
    place_id: number;
    place_name: string;
    place_group: string;
    starts_at: string;
    /** Fim do acionamento DESTE sócio. */
    ends_at: string;
    /** Valor no instante da resposta — bom para o primeiro render, não para contar. */
    minutes_remaining: number;
    /** Até quando a luz da QUADRA vai, somando todos os sócios. É o número da tela. */
    lit_until: string | null;
    released_at: string | null;
}

/**
 * Cada quadra tem o próprio horário: nada aqui diz se a quadra X está aberta.
 * Isso — e o máximo do seletor — mora em `LightingPlace`.
 */
export interface LightingAvailability {
    now: string;
    /** Agregado: "há alguma quadra aberta agora?". Só decide se mostra o fluxo de escolha. */
    open: boolean;
    /** A PRIMEIRA janela a abrir entre todas as quadras. */
    next_window: LightingWindow | null;
    /** Horário geral do clube hoje. Só para frase genérica — não decide nada. */
    club_window: LightingWindow | null;
    max_minutes: number;
    min_minutes: number;
    step_minutes: number;
    activation: LightingActivation | null;
}

export interface LightingGroup {
    id: number;
    name: string;
    icon: string | null;
    places: number;
}

export interface LightingPlace {
    id: number;
    name: string;
    /** Como nos outros endpoints de espaço: usado como vier. */
    image: string | null;
    /** Horário DESTA quadra agora. Fechada não some da lista: aparece desabilitada. */
    open: boolean;
    /** A janela de hoje desta quadra (null quando fechada). */
    window: LightingWindow | null;
    /** A próxima janela desta quadra. */
    next_window: LightingWindow | null;
    /** Máximo do seletor nesta quadra: o teto aparado no que resta da janela dela. */
    available_minutes: number;
    /** Acesa NÃO quer dizer indisponível: acionar uma quadra acesa é prolongar. */
    lit: boolean;
    lit_until: string | null;
}

export interface LightingActivateResult {
    /** true = prolongou o que o sócio já tinha nesta quadra (HTTP 200). */
    extended: boolean;
    activation: LightingActivation | null;
}

/** Códigos de recusa documentados. Outros valores passam como `string`. */
export type LightingReason =
    | "window_closed"
    | "window_ending"
    | "member_limit"
    | "place_reserved"
    | "place_not_eligible"
    | "no_activation";

export type LightingFailureKind =
    | "rule" // recusa de regra: tem `reason`
    | "validation" // 422 do Laravel, sem `reason`
    | "throttled" // 429
    | "unauthorized" // 401/403 — o interceptor já cuidou
    | "network"
    | "server";

export interface LightingFailure {
    ok: false;
    status: number;
    kind: LightingFailureKind;
    reason: LightingReason | string | null;
    /** Texto pronto para exibir. */
    error: string;
    /** Campos extras da recusa (`next_window`, `active_activation`, `reserved_from`...). */
    extras: Record<string, unknown>;
}

export type LightingResult<T> = { ok: true; status: number; data: T } | LightingFailure;

/* -------------------------------------------------------------------------- */
/* Normalização                                                                */
/* -------------------------------------------------------------------------- */

type Obj = Record<string, unknown>;

function asObj(raw: unknown): Obj {
    return raw && typeof raw === "object" ? (raw as Obj) : {};
}

function toNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toStringOrNull(value: unknown): string | null {
    return value === null || value === undefined || value === "" ? null : String(value);
}

export function toWindow(raw: unknown): LightingWindow | null {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Obj;
    if (!obj.starts_at || !obj.ends_at) return null;

    return {
        date: String(obj.date ?? ""),
        start: String(obj.start ?? ""),
        end: String(obj.end ?? ""),
        starts_at: String(obj.starts_at),
        ends_at: String(obj.ends_at),
        source: String(obj.source ?? ""),
        reason: toStringOrNull(obj.reason),
    };
}

export function toActivation(raw: unknown): LightingActivation | null {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Obj;

    return {
        id: toNumber(obj.id),
        place_id: toNumber(obj.place_id),
        place_name: String(obj.place_name ?? ""),
        place_group: String(obj.place_group ?? ""),
        starts_at: String(obj.starts_at ?? ""),
        ends_at: String(obj.ends_at ?? ""),
        minutes_remaining: toNumber(obj.minutes_remaining),
        lit_until: toStringOrNull(obj.lit_until),
        released_at: toStringOrNull(obj.released_at),
    };
}

function toAvailability(raw: unknown): LightingAvailability {
    const obj = asObj(raw);

    return {
        now: String(obj.now ?? ""),
        open: obj.open === true,
        next_window: toWindow(obj.next_window),
        club_window: toWindow(obj.club_window),
        max_minutes: toNumber(obj.max_minutes),
        min_minutes: toNumber(obj.min_minutes),
        step_minutes: toNumber(obj.step_minutes),
        activation: toActivation(obj.activation),
    };
}

function toGroup(raw: unknown): LightingGroup {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        icon: toStringOrNull(obj.icon),
        places: toNumber(obj.places),
    };
}

function toPlace(raw: unknown): LightingPlace {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        image: toStringOrNull(obj.image),
        open: obj.open === true,
        window: toWindow(obj.window),
        next_window: toWindow(obj.next_window),
        available_minutes: toNumber(obj.available_minutes),
        lit: obj.lit === true,
        lit_until: toStringOrNull(obj.lit_until),
    };
}

function listOf(raw: unknown, key: string): unknown[] {
    if (Array.isArray(raw)) return raw;
    const value = asObj(raw)[key];
    return Array.isArray(value) ? value : [];
}

/**
 * Monta a falha a partir da resposta. O `reason` vem da Lara; o que não tiver
 * `reason` é classificado só pelo status HTTP, para a tela saber se é o caso de
 * avisar, tentar de novo ou ficar quieta.
 */
function failure(status: number, data: unknown, message?: string | null): LightingFailure {
    const body = asObj(data);
    const reason = toStringOrNull(body.reason);

    let kind: LightingFailureKind;
    if (reason) kind = "rule";
    else if (status === 401 || status === 403) kind = "unauthorized";
    else if (status === 429) kind = "throttled";
    else if (status === 422) kind = "validation";
    else if (status === 502 || status === 503) kind = "network";
    else kind = "server";

    const fallback =
        kind === "throttled"
            ? "Muitas tentativas em pouco tempo. Espere um instante e tente de novo."
            : kind === "network"
              ? "Não foi possível falar com o servidor. Tente de novo em instantes."
              : kind === "unauthorized"
                ? "Sua sessão expirou. Entre novamente."
                : "Não foi possível concluir agora. Tente de novo em instantes.";

    const text = toStringOrNull(body.error) ?? toStringOrNull(message) ?? fallback;

    const extras: Obj = { ...body };
    delete extras.error;
    delete extras.reason;
    delete extras.message;

    return { ok: false, status, kind, reason, error: text, extras };
}

/* -------------------------------------------------------------------------- */
/* Chamadas                                                                    */
/* -------------------------------------------------------------------------- */

/** O endpoint principal: lido ao abrir, depois de cada ação e periodicamente. */
export async function fetchAvailability(): Promise<LightingResult<LightingAvailability>> {
    const response = await API_CONSUME("GET", "lighting/availability");
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: toAvailability(response.data) };
}

/** Só vêm grupos com ao menos uma quadra liberada. Vazio é um estado, não um erro. */
export async function fetchGroups(): Promise<LightingResult<LightingGroup[]>> {
    const response = await API_CONSUME("GET", "lighting/groups");
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: listOf(response.data, "groups").map(toGroup) };
}

export async function fetchGroupPlaces(groupId: number): Promise<LightingResult<LightingPlace[]>> {
    const response = await API_CONSUME(
        "GET",
        `lighting/groups/${encodeURIComponent(String(groupId))}/places`
    );
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: listOf(response.data, "places").map(toPlace) };
}

/**
 * A quadra do acionamento vigente, com o horário e o `available_minutes` dela —
 * é o máximo do seletor de "Prolongar". O `activation` não traz o id do grupo,
 * só o nome (`place_group`); o grupo é achado pelo nome na lista de grupos.
 * `groupHint` pula essa busca quando já se sabe o grupo.
 */
export async function fetchActivationPlace(
    activation: LightingActivation,
    groupHint: number | null = null
): Promise<LightingResult<{ groupId: number; place: LightingPlace } | null>> {
    let groupId = groupHint;

    if (groupId === null) {
        const groups = await fetchGroups();
        if (!groups.ok) return groups;
        groupId = groups.data.find((group) => group.name === activation.place_group)?.id ?? null;
        if (groupId === null) return { ok: true, status: groups.status, data: null };
    }

    const places = await fetchGroupPlaces(groupId);
    if (!places.ok) return places;
    const place = places.data.find((item) => item.id === activation.place_id) ?? null;

    // A dica pode ter ficado velha (quadra mudou de grupo): tenta sem ela.
    if (!place && groupHint !== null) return fetchActivationPlace(activation, null);

    return { ok: true, status: places.status, data: place ? { groupId, place } : null };
}

/**
 * Acende ou prolonga — o mesmo endpoint para os dois. 201 = acionamento novo,
 * 200 = prolongou o que o sócio já tinha nesta quadra. A duração vem do que o
 * sócio escolheu; a resposta pode trazer menos (aparada na janela).
 */
export async function activatePlace(
    placeId: number,
    minutes: number
): Promise<LightingResult<LightingActivateResult>> {
    const response = await API_CONSUME(
        "POST",
        `lighting/places/${encodeURIComponent(String(placeId))}/activate`,
        {},
        { minutes }
    );
    if (!response.ok) return failure(response.status, response.data, response.message);

    const body = asObj(response.data);
    return {
        ok: true,
        status: response.status,
        data: { extended: body.extended === true, activation: toActivation(body.activation) },
    };
}

/** Devolve a quadra do acionamento vigente do sócio (ele só pode ter um). */
export async function releaseActivation(): Promise<LightingResult<LightingActivation | null>> {
    const response = await API_CONSUME("POST", "lighting/release");
    if (!response.ok) return failure(response.status, response.data, response.message);

    // A resposta pode vir envelopada em `activation` ou ser a própria ativação.
    const body = asObj(response.data);
    return { ok: true, status: response.status, data: toActivation(body.activation ?? body) };
}
