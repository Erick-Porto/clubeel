/**
 * Cliente dos "espaços sociais" (churrasqueiras, salões, áreas de festa) na Lara.
 *
 * Mesmo caminho do resto do site: navegador → `/api/backend` (API_CONSUME) →
 * Lara. O proxy põe o `Authorization` da aplicação e o `Session` do sócio; o
 * sócio é sempre o dono do Session — nenhum corpo aqui leva id, CPF ou
 * matrícula de sócio.
 *
 * O front não decide nada. Disponibilidade, preço, desconto, prazo, limite,
 * capacidade, horário de término e mesas/cadeiras vêm da Lara; este arquivo só dá forma às respostas. Em recusa de
 * regra, o comportamento da tela sai do `reason` (código estável) — nunca do
 * texto.
 *
 * O pagamento NÃO passa por aqui: vai pelo fluxo de cartão do site
 * (`/api/erede/payment_methods` → `/api/success`), que relê a reserva no
 * servidor para saber quanto cobrar (ver utils/lara.ts).
 */

import API_CONSUME from "./api-consume";

/* -------------------------------------------------------------------------- */
/* Contratos                                                                   */
/* -------------------------------------------------------------------------- */

export interface SocialGroup {
    id: number;
    name: string;
    image_vertical: string | null;
    image_horizontal: string | null;
    /** Texto do clube (crianças, convidados...). Mostrado como veio. */
    rules: string | null;
    minimum_antecedence: number;
    maximum_antecedence: number;
    places_count: number;
}

export interface SocialPlace {
    id: number;
    name: string;
    /** Observações/restrições do espaço ("Proibida a utilização de fogão"). */
    description: string | null;
    /** Itens fornecidos ("10 jogos de mesa com 4 cadeiras..."). */
    amenities: string | null;
    image: string | null;
    /** Diária. */
    price: number;
    /** Total de pessoas (sócios + não sócios). */
    capacity: number;
    /** Convidados não sócios incluídos no preço. */
    max_guests: number;
    /** Quantos convidados extras dá para contratar, no máximo. */
    extra_guests: number;
    extra_guest_price: number;
    /** Mesas e cadeiras incluídas no preço. */
    base_tables: number;
    base_chairs: number;
    /**
     * Duração fixa do evento em horas. `null` = espaço sem horário: não se
     * pede início. Com valor, o início é obrigatório na pré-reserva.
     */
    event_duration_hours: number | null;
    /** Faixa permitida para o início ("HH:MM"); `null` = sem limite. */
    event_earliest_start: string | null;
    event_latest_start: string | null;
}

export interface SocialGroupPlaces {
    group: { id: number; name: string; rules: string | null } | null;
    places: SocialPlace[];
}

export type SocialDayStatus = "available" | "reserved" | "blocked" | "out_of_window";

export interface SocialCalendarDay {
    /** AAAA-MM-DD. */
    date: string;
    /** Só `available` é clicável. Outros valores desconhecidos contam como indisponíveis. */
    status: SocialDayStatus | string;
}

export interface SocialCalendar {
    place_id: number;
    month: string;
    price: number;
    days: SocialCalendarDay[];
}

/**
 * Item do catálogo: bebida (`GET social/beverages`) ou mesa/cadeira/jogo
 * (`GET social/furniture`). Os dois vão no mesmo `items` do pedido, por
 * `item_id`; distinguem-se pela `category`.
 */
export interface SocialCatalogItem {
    id: number;
    /** "bebida" ou "mobiliario". */
    category: string;
    name: string;
    unit: string | null;
    price: number;
    /** Quantas mesas/cadeiras CADA unidade acrescenta (0 nas bebidas). */
    tables_per_unit: number;
    chairs_per_unit: number;
    /** Máximo por reserva; `null` = sem limite. */
    max_quantity: number | null;
}

/** Cada limite é `null` quando o grupo não define. */
export interface SocialLimits {
    active: { limit: number; used: number; remaining: number } | null;
    window: { limit: number; days: number } | null;
}

export type SocialStage =
    | "requested"
    | "awaiting_payment"
    | "confirmed"
    | "refused"
    | "cancelled"
    | "expired";

export interface SocialBookingItem {
    item_id: number;
    /** "bebida" ou "mobiliario". */
    category: string;
    name: string;
    unit: string | null;
    /** Preço contratado (congelado na pré-reserva). */
    unit_price: number;
    quantity: number;
    subtotal: number;
    tables_per_unit: number;
    chairs_per_unit: number;
}

/** Pagamento registrado — pelo site (Rede) ou baixa manual da secretaria. */
export interface SocialPayment {
    paid_amount: number;
    paid_at: string | null;
    /** "credit"/"debit" (Rede, pelo site) ou "manual_*" (secretaria). */
    method: string;
    /** Rótulo pronto em português ("Pix direto ao clube"). */
    method_label: string;
    /** true = baixa manual: pago fora da plataforma. */
    manual: boolean;
    refunded_amount: number;
}

export interface SocialGuest {
    id: number | null;
    name: string;
    /** Volta mascarado da Lara ("123.***.**0-09"). */
    cpf: string;
}

export interface SocialBooking {
    id: number;
    /** É este id que vai no pagamento. */
    schedule_id: number;
    stage: SocialStage | string;
    stage_label: string;
    /**
     * "site" (pedida aqui) ou "secretaria" (feita no balcão, em nome do sócio).
     * As da secretaria podem já começar em `awaiting_payment` ou `confirmed`.
     */
    origin: string;
    date: string;
    /** "HH:MM"; `null` quando o espaço não tem duração. */
    start_time: string | null;
    end_time: string | null;
    duration_hours: number | null;
    /** O fim cai depois da meia-noite. */
    ends_next_day: boolean;
    place: { id: number; name: string; capacity: number; max_guests: number };
    place_group: { id: number; name: string } | null;
    event_type: string | null;
    expected_guests: number | null;
    notes: string | null;
    /** Preços congelados na pré-reserva — não são os do catálogo atual. */
    base_price: number;
    extra_guests: number;
    extra_guest_price: number;
    extras_total: number;
    /** Base de mesas/cadeiras copiada do espaço na pré-reserva. */
    base_tables: number;
    base_chairs: number;
    /** Base + mobiliário contratado — os números oficiais. */
    tables_total: number;
    chairs_total: number;
    items: SocialBookingItem[];
    items_total: number;
    discount: number;
    /** Valor a cobrar. Não somar no front. */
    total: number;
    payment_due_at: string | null;
    /** Pagamento registrado; `null` enquanto não há. Com ele, nunca cobrar de novo. */
    payment: SocialPayment | null;
    /** `max_guests` + extras contratados. */
    guest_limit: number;
    guests: SocialGuest[];
    guests_editable_until: string | null;
    /**
     * Pode editar a pré-reserva (`PUT social/bookings/{id}`): só em `requested`
     * e antes de a secretaria marcar o contrato como ok. Não deduzir pelo `stage`.
     */
    can_edit: boolean;
    can_pay: boolean;
    can_cancel: boolean;
    can_edit_guests: boolean;
    refusal_reason: string | null;
    cancel_reason: string | null;
}

export interface SocialBookingRequest {
    place_id: number;
    date: string;
    /** "HH:MM" — obrigatório quando o espaço tem `event_duration_hours`. */
    start_time?: string;
    event_type?: string;
    expected_guests?: number;
    extra_guests?: number;
    notes?: string;
    /** Bebidas e mobiliário juntos. */
    items?: Array<{ item_id: number; quantity: number }>;
    guests?: Array<{ name: string; cpf: string }>;
}

/**
 * Edição da pré-reserva. Todo campo é opcional e campo ausente fica como está;
 * `items` e `guests`, quando vêm, substituem a lista inteira. Data e espaço
 * não mudam (a Lara ignora `date`/`place_id`), por isso nem existem aqui.
 * `null` limpa o campo.
 */
export interface SocialBookingUpdate {
    start_time?: string;
    event_type?: string | null;
    expected_guests?: number | null;
    extra_guests?: number;
    notes?: string | null;
    items?: Array<{ item_id: number; quantity: number }>;
    guests?: Array<{ name: string; cpf: string }>;
}

/** Códigos de recusa documentados. Outros valores passam como `string`. */
export type SocialReason =
    | "contract_closed"
    | "place_not_social"
    | "date_unavailable"
    | "date_blocked"
    | "out_of_window"
    | "limit_reached"
    | "over_capacity"
    | "beverage_unavailable"
    | "item_limit"
    | "invalid_time"
    | "invalid_guest"
    | "guests_locked"
    | "invalid_stage"
    | "payment_mismatch"
    | "not_owner";

export type SocialFailureKind =
    | "rule" // recusa de regra: tem `reason`
    | "validation" // 422 do Laravel com `errors`, sem `reason`
    | "throttled" // 429
    | "unauthorized" // 401/403 — o interceptor já cuidou
    | "network"
    | "server";

export interface SocialFailure {
    ok: false;
    status: number;
    kind: SocialFailureKind;
    reason: SocialReason | string | null;
    /** Texto que a Lara mandou (ou um genérico). */
    error: string;
    /** `context` da recusa (`limit`, `index`, `item_id`, `max_quantity`, `earliest_start`...). */
    context: Record<string, unknown>;
    /** Erros de campo do Laravel (`errors`), quando `kind === 'validation'`. */
    fieldErrors: Record<string, string[]>;
}

export type SocialResult<T> = { ok: true; status: number; data: T } | SocialFailure;

/* -------------------------------------------------------------------------- */
/* Normalização                                                                */
/* -------------------------------------------------------------------------- */

type Obj = Record<string, unknown>;

function asObj(raw: unknown): Obj {
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Obj) : {};
}

function toNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: unknown): string | null {
    return value === null || value === undefined || value === "" ? null : String(value);
}

/**
 * A Lara não é consistente no envelope (às vezes array puro, às vezes
 * `{chave: [...]}` ou `{data: [...]}`); aceita os três.
 */
function listOf(raw: unknown, key: string): unknown[] {
    if (Array.isArray(raw)) return raw;
    const obj = asObj(raw);
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
    if (Array.isArray(obj.data)) return obj.data as unknown[];
    return [];
}

/** O objeto da reserva pode vir puro ou envelopado em `booking`/`data`. */
function unwrapBooking(raw: unknown): unknown {
    const obj = asObj(raw);
    if (obj.booking && typeof obj.booking === "object") return obj.booking;
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) return obj.data;
    return raw;
}

function toGroup(raw: unknown): SocialGroup {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        image_vertical: toStringOrNull(obj.image_vertical),
        image_horizontal: toStringOrNull(obj.image_horizontal),
        rules: toStringOrNull(obj.rules),
        minimum_antecedence: toNumber(obj.minimum_antecedence),
        maximum_antecedence: toNumber(obj.maximum_antecedence),
        places_count: toNumber(obj.places_count),
    };
}

function toPlace(raw: unknown): SocialPlace {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        description: toStringOrNull(obj.description),
        amenities: toStringOrNull(obj.amenities),
        image: toStringOrNull(obj.image),
        price: toNumber(obj.price),
        capacity: toNumber(obj.capacity),
        max_guests: toNumber(obj.max_guests),
        extra_guests: toNumber(obj.extra_guests),
        extra_guest_price: toNumber(obj.extra_guest_price),
        base_tables: toNumber(obj.base_tables),
        base_chairs: toNumber(obj.base_chairs),
        event_duration_hours: toNumberOrNull(obj.event_duration_hours),
        event_earliest_start: toTimeOrNull(obj.event_earliest_start),
        event_latest_start: toTimeOrNull(obj.event_latest_start),
    };
}

/** "HH:MM" (corta segundos, se vierem); `null` se vazio ou mal formado. */
function toTimeOrNull(value: unknown): string | null {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ""));
    return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

function toCalendar(raw: unknown): SocialCalendar {
    const obj = asObj(raw);
    return {
        place_id: toNumber(obj.place_id),
        month: String(obj.month ?? ""),
        price: toNumber(obj.price),
        days: listOf(obj.days, "days").map((day) => {
            const d = asObj(day);
            return { date: String(d.date ?? ""), status: String(d.status ?? "") };
        }),
    };
}

function toCatalogItem(raw: unknown, fallbackCategory: string): SocialCatalogItem {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        category: String(obj.category ?? fallbackCategory),
        name: String(obj.name ?? ""),
        unit: toStringOrNull(obj.unit),
        price: toNumber(obj.price ?? obj.unit_price),
        tables_per_unit: toNumber(obj.tables_per_unit),
        chairs_per_unit: toNumber(obj.chairs_per_unit),
        max_quantity: toNumberOrNull(obj.max_quantity),
    };
}

function toPayment(raw: unknown): SocialPayment | null {
    if (!raw || typeof raw !== "object") return null;
    const obj = asObj(raw);
    return {
        paid_amount: toNumber(obj.paid_amount),
        paid_at: toStringOrNull(obj.paid_at),
        method: String(obj.method ?? ""),
        method_label: String(obj.method_label ?? obj.method ?? ""),
        manual: obj.manual === true,
        refunded_amount: toNumber(obj.refunded_amount),
    };
}

function toLimits(raw: unknown): SocialLimits {
    const obj = asObj(raw);
    const active = obj.active && typeof obj.active === "object" ? asObj(obj.active) : null;
    const window = obj.window && typeof obj.window === "object" ? asObj(obj.window) : null;

    return {
        active:
            active && toNumberOrNull(active.limit) !== null
                ? {
                      limit: toNumber(active.limit),
                      used: toNumber(active.used),
                      remaining: toNumber(active.remaining),
                  }
                : null,
        window:
            window && toNumberOrNull(window.limit) !== null
                ? { limit: toNumber(window.limit), days: toNumber(window.days) }
                : null,
    };
}

function toBooking(raw: unknown): SocialBooking {
    const obj = asObj(unwrapBooking(raw));
    const place = asObj(obj.place);
    const group = obj.place_group && typeof obj.place_group === "object" ? asObj(obj.place_group) : null;

    return {
        id: toNumber(obj.id),
        schedule_id: toNumber(obj.schedule_id),
        stage: String(obj.stage ?? ""),
        stage_label: String(obj.stage_label ?? ""),
        origin: String(obj.origin ?? "site"),
        date: String(obj.date ?? ""),
        start_time: toTimeOrNull(obj.start_time),
        end_time: toTimeOrNull(obj.end_time),
        duration_hours: toNumberOrNull(obj.duration_hours),
        ends_next_day: obj.ends_next_day === true,
        place: {
            id: toNumber(place.id),
            name: String(place.name ?? ""),
            capacity: toNumber(place.capacity),
            max_guests: toNumber(place.max_guests),
        },
        place_group: group ? { id: toNumber(group.id), name: String(group.name ?? "") } : null,
        event_type: toStringOrNull(obj.event_type),
        expected_guests: toNumberOrNull(obj.expected_guests),
        notes: toStringOrNull(obj.notes),
        base_price: toNumber(obj.base_price),
        extra_guests: toNumber(obj.extra_guests),
        extra_guest_price: toNumber(obj.extra_guest_price),
        extras_total: toNumber(obj.extras_total),
        base_tables: toNumber(obj.base_tables),
        base_chairs: toNumber(obj.base_chairs),
        tables_total: toNumber(obj.tables_total),
        chairs_total: toNumber(obj.chairs_total),
        items: listOf(obj.items, "items").map((item) => {
            const i = asObj(item);
            return {
                // `beverage_id` é o nome antigo do mesmo id.
                item_id: toNumber(i.item_id ?? i.beverage_id),
                category: String(i.category ?? "bebida"),
                name: String(i.name ?? ""),
                unit: toStringOrNull(i.unit),
                unit_price: toNumber(i.unit_price),
                quantity: toNumber(i.quantity),
                subtotal: toNumber(i.subtotal),
                tables_per_unit: toNumber(i.tables_per_unit),
                chairs_per_unit: toNumber(i.chairs_per_unit),
            };
        }),
        items_total: toNumber(obj.items_total),
        discount: toNumber(obj.discount),
        total: toNumber(obj.total),
        payment_due_at: toStringOrNull(obj.payment_due_at),
        payment: toPayment(obj.payment),
        guest_limit: toNumber(obj.guest_limit),
        guests: listOf(obj.guests, "guests").map(toGuest),
        guests_editable_until: toStringOrNull(obj.guests_editable_until),
        can_edit: obj.can_edit === true,
        can_pay: obj.can_pay === true,
        can_cancel: obj.can_cancel === true,
        can_edit_guests: obj.can_edit_guests === true,
        refusal_reason: toStringOrNull(obj.refusal_reason),
        cancel_reason: toStringOrNull(obj.cancel_reason),
    };
}

function toGuest(raw: unknown): SocialGuest {
    const obj = asObj(raw);
    return {
        id: toNumberOrNull(obj.id),
        name: String(obj.name ?? ""),
        cpf: String(obj.cpf ?? ""),
    };
}

function toFieldErrors(raw: unknown): Record<string, string[]> {
    const obj = asObj(raw);
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) out[key] = value.map(String);
        else if (typeof value === "string") out[key] = [value];
    }
    return out;
}

/**
 * Monta a falha a partir da resposta. O `reason` vem da Lara; sem ele, a falha
 * é classificada pelo status HTTP para a tela saber se avisa, tenta de novo ou
 * fica quieta.
 */
function failure(status: number, data: unknown, message?: string | null): SocialFailure {
    const body = asObj(data);
    const reason = toStringOrNull(body.reason);
    const fieldErrors = toFieldErrors(body.errors);

    let kind: SocialFailureKind;
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

    // No erro de validação, a primeira mensagem de campo costuma ser a mais útil.
    const firstFieldError = Object.values(fieldErrors)[0]?.[0] ?? null;
    const text =
        toStringOrNull(body.error) ??
        (kind === "validation" ? firstFieldError : null) ??
        toStringOrNull(message) ??
        fallback;

    return { ok: false, status, kind, reason, error: text, context: asObj(body.context), fieldErrors };
}

/* -------------------------------------------------------------------------- */
/* Chamadas                                                                    */
/* -------------------------------------------------------------------------- */

export async function fetchSocialGroups(): Promise<SocialResult<SocialGroup[]>> {
    const response = await API_CONSUME("GET", "social/groups");
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: listOf(response.data, "groups").map(toGroup) };
}

export async function fetchSocialGroupPlaces(groupId: number): Promise<SocialResult<SocialGroupPlaces>> {
    const response = await API_CONSUME("GET", `social/groups/${encodeURIComponent(String(groupId))}/places`);
    if (!response.ok) return failure(response.status, response.data, response.message);

    const body = asObj(response.data);
    const group = body.group && typeof body.group === "object" ? asObj(body.group) : null;
    return {
        ok: true,
        status: response.status,
        data: {
            group: group
                ? { id: toNumber(group.id), name: String(group.name ?? ""), rules: toStringOrNull(group.rules) }
                : null,
            places: listOf(response.data, "places").map(toPlace),
        },
    };
}

/** `month` no formato AAAA-MM. */
export async function fetchSocialCalendar(placeId: number, month: string): Promise<SocialResult<SocialCalendar>> {
    const query = new URLSearchParams({ place_id: String(placeId), month });
    const response = await API_CONSUME("GET", `social/availability?${query.toString()}`);
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: toCalendar(response.data) };
}

/** Bebidas ativas. */
export async function fetchSocialBeverages(): Promise<SocialResult<SocialCatalogItem[]>> {
    const response = await API_CONSUME("GET", "social/beverages");
    if (!response.ok) return failure(response.status, response.data, response.message);
    return {
        ok: true,
        status: response.status,
        data: listOf(response.data, "beverages").map((item) => toCatalogItem(item, "bebida")),
    };
}

/** Mesas, cadeiras e jogos completos adicionais ativos. */
export async function fetchSocialFurniture(): Promise<SocialResult<SocialCatalogItem[]>> {
    const response = await API_CONSUME("GET", "social/furniture");
    if (!response.ok) return failure(response.status, response.data, response.message);
    return {
        ok: true,
        status: response.status,
        data: listOf(response.data, "furniture").map((item) => toCatalogItem(item, "mobiliario")),
    };
}

/**
 * Os dois catálogos de uma vez. Um catálogo que falhar volta vazio: a
 * pré-reserva segue sem aqueles itens em vez de travar.
 */
export async function fetchSocialCatalog(): Promise<{ beverages: SocialCatalogItem[]; furniture: SocialCatalogItem[] }> {
    const [beverages, furniture] = await Promise.all([fetchSocialBeverages(), fetchSocialFurniture()]);
    return { beverages: beverages.ok ? beverages.data : [], furniture: furniture.ok ? furniture.data : [] };
}

export async function fetchSocialLimits(groupId: number): Promise<SocialResult<SocialLimits>> {
    const query = new URLSearchParams({ place_group_id: String(groupId) });
    const response = await API_CONSUME("GET", `social/limits?${query.toString()}`);
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: toLimits(response.data) };
}

export async function createSocialBooking(request: SocialBookingRequest): Promise<SocialResult<SocialBooking>> {
    const response = await API_CONSUME("POST", "social/bookings", {}, request);
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: toBooking(response.data) };
}

/** Do site e da secretaria; futuras primeiro, depois as passadas — a ordem é a da Lara. */
export async function fetchSocialBookings(): Promise<SocialResult<SocialBooking[]>> {
    const response = await API_CONSUME("GET", "social/bookings");
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: listOf(response.data, "bookings").map(toBooking) };
}

export async function fetchSocialBooking(id: number): Promise<SocialResult<SocialBooking>> {
    const response = await API_CONSUME("GET", `social/bookings/${encodeURIComponent(String(id))}`);
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: toBooking(response.data) };
}

/**
 * Edita a pré-reserva (enquanto `can_edit`). Responde a reserva recalculada:
 * `total`, `extras_total`, `items_total` e `guest_limit` podem mudar.
 */
export async function updateSocialBooking(
    id: number,
    update: SocialBookingUpdate
): Promise<SocialResult<SocialBooking>> {
    const response = await API_CONSUME("PUT", `social/bookings/${encodeURIComponent(String(id))}`, {}, update);
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: toBooking(response.data) };
}

/** Substitui a lista INTEIRA (pode ser vazia). CPFs voltam mascarados. */
export async function replaceSocialGuests(
    id: number,
    guests: Array<{ name: string; cpf: string }>
): Promise<SocialResult<SocialBooking>> {
    const response = await API_CONSUME("PUT", `social/bookings/${encodeURIComponent(String(id))}/guests`, {}, { guests });
    if (!response.ok) return failure(response.status, response.data, response.message);
    return { ok: true, status: response.status, data: toBooking(response.data) };
}

/** Desistir — só cabe em `requested`/`awaiting_payment`; a Lara recusa o resto. */
export async function cancelSocialBooking(id: number): Promise<SocialResult<SocialBooking | null>> {
    const response = await API_CONSUME("DELETE", `social/bookings/${encodeURIComponent(String(id))}`);
    if (!response.ok) return failure(response.status, response.data, response.message);
    const hasBooking = Object.keys(asObj(unwrapBooking(response.data))).length > 0;
    return { ok: true, status: response.status, data: hasBooking ? toBooking(response.data) : null };
}
