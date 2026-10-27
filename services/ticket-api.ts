/**
 * Cliente dos ingressos de eventos na Lara.
 *
 * Mesmo caminho do resto do site: navegador → `/api/backend` (API_CONSUME) →
 * Lara, com o `Authorization` da aplicação e, nas rotas de sócio, o `Session`
 * dele. A novidade é o NÃO SÓCIO, que compra sem login:
 *
 * - criar o pedido e abrir o pedido pelo link do e-mail passam por rotas
 *   próprias do servidor (`/api/ingressos/pedidos…`), porque a Lara devolve o
 *   `access_token` do pedido e ele não pode chegar ao navegador: o servidor
 *   guarda o token num cookie httpOnly (um por pedido) e tira do corpo;
 * - as demais rotas do pedido (`tickets/guest-orders/{id}`) vão pelo proxy,
 *   que põe o header `Ticket-Order-Token` a partir desse cookie;
 * - o PDF também passa por rota própria (o proxy só repassa JSON).
 *
 * O front não decide nada: lote, preço, estoque, limite, lotação de cada dia,
 * cupom e o total vêm da Lara. Em recusa, a tela decide pelo `reason` (código
 * estável), nunca pelo texto.
 *
 * O pagamento NÃO passa por aqui: vai pelo fluxo de cartão do site
 * (`/api/erede/payment_methods` → `/api/success`), que relê o pedido no
 * servidor para saber quanto cobrar e avisa a Lara com o `tid`.
 */

import { signOut } from "next-auth/react";
import { toast } from "react-toastify";
import API_CONSUME, { type IApiResponse } from "./api-consume";
import { comBase } from "../utils/base-path";

/* -------------------------------------------------------------------------- */
/* Contratos                                                                   */
/* -------------------------------------------------------------------------- */

/** `event` = evento de um dia só; `day` = diária do `day_id`; `passport` = todos os dias. */
export type TicketValidity = "event" | "day" | "passport" | string;

export interface TicketEventDay {
    id: number;
    name: string | null;
    /** Pronto para a tela: "Sábado (13/02)" ou "Sáb 13/02". */
    label: string;
    starts_at: string | null;
    ends_at: string | null;
    /** `null` = sem lotação. */
    capacity_left: number | null;
}

export interface TicketLot {
    id: number;
    name: string;
    price_member: number | null;
    /** `null` = lote só para sócios. */
    price_non_member: number | null;
    members_only: boolean;
    starts_at: string | null;
    ends_at: string | null;
    remaining: number | null;
}

export interface TicketType {
    id: number;
    name: string;
    description: string | null;
    validity: TicketValidity;
    day_id: number | null;
    /** Só com `true` (e `lot`) o tipo pode ser comprado agora. */
    available: boolean;
    /** O lote à venda agora (a Lara já escolheu). */
    lot: TicketLot | null;
    next_lot: TicketLot | null;
}

export interface TicketEvent {
    id: number;
    title: string;
    description: string | null;
    image_url: string | null;
    venue: string | null;
    /** `published` | `finished` (rascunho e cancelado nunca chegam). */
    status: string;
    starts_at: string | null;
    ends_at: string | null;
    sales_starts_at: string | null;
    sales_ends_at: string | null;
    sales_open: boolean;
    /** Limite de ingressos do pedido do NÃO sócio (`null` = a Lara não informou limite). */
    max_per_order: number | null;
    capacity_left: number | null;
    multi_day: boolean;
    days: TicketEventDay[];
    types: TicketType[];
    /** Texto livre com quebras de linha. Só no detalhe. */
    rules: string | null;
}

/** [v2] Resposta do `coupon-check`: só para a prévia; o desconto que vale é o do pedido. */
export interface CouponPreview {
    code: string;
    description: string | null;
    /** `percent` (do preço do lote) ou `fixed` (reais por ingresso). */
    kind: string;
    value: number;
    label: string;
    /** `all`, `member` ou `non_member`. */
    audience: string;
    /** `null` = vale para todos os tipos. */
    type_ids: number[] | null;
    ends_at: string | null;
}

/** [v3] Pessoa do título do sócio logado. O CPF vem mascarado; o pedido vai pela `ref`. */
export interface TitlePerson {
    ref: string;
    name: string;
    cpf: string;
    titular: boolean;
    is_me: boolean;
    has_ticket: boolean;
    /** [v4] Dias em que a pessoa já tem ingresso (o passaporte cobre todos). */
    days_taken: number[];
}

export interface MyTitle {
    title: string;
    people: TitlePerson[];
}

export interface OrderTicketDay {
    id: number;
    name: string | null;
    label: string;
    starts_at: string | null;
    ends_at: string | null;
}

export interface OrderTicket {
    id: number;
    /** `pending` | `valid` | `used` | `expired` | `cancelled`. */
    status: string;
    status_label: string;
    holder_name: string;
    holder_cpf: string;
    type: { id: number; name: string };
    lot: { id: number; name: string } | null;
    price_kind: string;
    list_price: number;
    discount_amount: number;
    amount: number;
    validity: TicketValidity;
    day: OrderTicketDay | null;
    /** Só com o ingresso pago. */
    code: string | null;
    /** Imagem SVG em data URI, direto no `<img src>`. Só com o ingresso pago. */
    qr_code: string | null;
    checked_in_at: string | null;
    entries: { day_id: number | null; checked_in_at: string | null }[];
}

export interface TicketOrder {
    id: number;
    /** `pending_payment` | `paid` | `expired` | `withdrawn` | `cancelled`. */
    status: string;
    status_label: string;
    /** `member` | `guest`. */
    buyer_kind: string;
    buyer: { name: string; email: string | null; cpf: string | null };
    total: number;
    discount_total: number;
    coupon_code: string | null;
    courtesy: boolean;
    hold_until: string | null;
    paid_at: string | null;
    /** `site` | `secretaria`. */
    origin: string;
    event: {
        id: number;
        title: string;
        venue: string | null;
        starts_at: string | null;
        ends_at: string | null;
        image_url: string | null;
        days: OrderTicketDay[];
    };
    payment: { refunded_amount: number | null } | null;
    tickets: OrderTicket[];
}

/** Item do pedido do sócio: sem `holder_ref`, o ingresso é do próprio sócio. */
export interface MemberTicketItem {
    type_id: number;
    holder_ref?: string;
}

export interface GuestBuyer {
    cpf: string;
    name: string;
    email: string;
    phone: string;
}

export interface GuestTicketItem {
    type_id: number;
    holder_name: string;
    holder_cpf: string;
}

/* ----------------------------------------------------------------- Falhas */

export type TicketFailureKind =
    | "rule" // recusa de regra: tem `reason`
    | "validation" // 422 do Laravel com `errors`, sem `reason`
    | "throttled" // 429
    | "unauthorized" // 401 sem `reason` (sessão do sócio) — já levado ao login
    | "network"
    | "server";

export interface TicketFailure {
    ok: false;
    status: number;
    kind: TicketFailureKind;
    reason: string | null;
    /** Texto que a Lara mandou (ou um genérico). */
    error: string;
    context: Record<string, unknown>;
    fieldErrors: Record<string, string[]>;
}

export type TicketResult<T> = { ok: true; status: number; data: T } | TicketFailure;

/* -------------------------------------------------------------------------- */
/* Normalização                                                                */
/* -------------------------------------------------------------------------- */

type Obj = Record<string, unknown>;

function asObj(raw: unknown): Obj {
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Obj) : {};
}

function objOrNull(raw: unknown): Obj | null {
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Obj) : null;
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

/** Array puro, `{chave: [...]}` ou `{data: [...]}`. */
function listOf(raw: unknown, key: string): unknown[] {
    if (Array.isArray(raw)) return raw;
    const obj = asObj(raw);
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
    if (Array.isArray(obj.data)) return obj.data as unknown[];
    return [];
}

/** Objeto puro ou envelopado em `<chave>`/`data`. */
function unwrap(raw: unknown, key: string): unknown {
    const obj = asObj(raw);
    if (objOrNull(obj[key])) return obj[key];
    if (objOrNull(obj.data)) return obj.data;
    return raw;
}

function toDay(raw: unknown): TicketEventDay {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        name: toStringOrNull(obj.name),
        label: String(obj.label ?? obj.name ?? ""),
        starts_at: toStringOrNull(obj.starts_at),
        ends_at: toStringOrNull(obj.ends_at),
        capacity_left: toNumberOrNull(obj.capacity_left),
    };
}

function toLot(raw: unknown): TicketLot | null {
    const obj = objOrNull(raw);
    if (!obj) return null;
    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        price_member: toNumberOrNull(obj.price_member),
        price_non_member: toNumberOrNull(obj.price_non_member),
        members_only: obj.members_only === true,
        starts_at: toStringOrNull(obj.starts_at),
        ends_at: toStringOrNull(obj.ends_at),
        remaining: toNumberOrNull(obj.remaining),
    };
}

function toType(raw: unknown): TicketType {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        description: toStringOrNull(obj.description),
        validity: String(obj.validity ?? "event"),
        day_id: toNumberOrNull(obj.day_id),
        available: obj.available === true,
        lot: toLot(obj.lot),
        next_lot: toLot(obj.next_lot),
    };
}

function toEvent(raw: unknown): TicketEvent {
    const obj = asObj(unwrap(raw, "event"));
    return {
        id: toNumber(obj.id),
        title: String(obj.title ?? ""),
        description: toStringOrNull(obj.description),
        image_url: toStringOrNull(obj.image_url),
        venue: toStringOrNull(obj.venue),
        status: String(obj.status ?? ""),
        starts_at: toStringOrNull(obj.starts_at),
        ends_at: toStringOrNull(obj.ends_at),
        sales_starts_at: toStringOrNull(obj.sales_starts_at),
        sales_ends_at: toStringOrNull(obj.sales_ends_at),
        sales_open: obj.sales_open === true,
        max_per_order: toNumberOrNull(obj.max_per_order),
        capacity_left: toNumberOrNull(obj.capacity_left),
        multi_day: obj.multi_day === true,
        days: listOf(obj.days, "days").map(toDay),
        types: listOf(obj.types, "types").map(toType),
        rules: toStringOrNull(obj.rules),
    };
}

function toCoupon(raw: unknown): CouponPreview {
    const obj = asObj(unwrap(raw, "coupon"));
    return {
        code: String(obj.code ?? ""),
        description: toStringOrNull(obj.description),
        kind: String(obj.kind ?? ""),
        value: toNumber(obj.value),
        label: String(obj.label ?? ""),
        audience: String(obj.audience ?? "all"),
        type_ids: Array.isArray(obj.type_ids) ? obj.type_ids.map((id) => toNumber(id)) : null,
        ends_at: toStringOrNull(obj.ends_at),
    };
}

function toPerson(raw: unknown): TitlePerson {
    const obj = asObj(raw);
    return {
        ref: String(obj.ref ?? ""),
        name: String(obj.name ?? ""),
        cpf: String(obj.cpf ?? ""),
        titular: obj.titular === true,
        is_me: obj.is_me === true,
        has_ticket: obj.has_ticket === true,
        days_taken: Array.isArray(obj.days_taken) ? obj.days_taken.map((id) => toNumber(id)) : [],
    };
}

function toOrderDay(raw: unknown): OrderTicketDay | null {
    const obj = objOrNull(raw);
    if (!obj) return null;
    return {
        id: toNumber(obj.id),
        name: toStringOrNull(obj.name),
        label: String(obj.label ?? obj.name ?? ""),
        starts_at: toStringOrNull(obj.starts_at),
        ends_at: toStringOrNull(obj.ends_at),
    };
}

function toNamed(raw: unknown): { id: number; name: string } | null {
    const obj = objOrNull(raw);
    return obj ? { id: toNumber(obj.id), name: String(obj.name ?? "") } : null;
}

function toOrderTicket(raw: unknown): OrderTicket {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        status: String(obj.status ?? ""),
        status_label: String(obj.status_label ?? obj.status ?? ""),
        holder_name: String(obj.holder_name ?? ""),
        holder_cpf: String(obj.holder_cpf ?? ""),
        type: toNamed(obj.type) ?? { id: 0, name: "" },
        lot: toNamed(obj.lot),
        price_kind: String(obj.price_kind ?? ""),
        list_price: toNumber(obj.list_price, toNumber(obj.amount)),
        discount_amount: toNumber(obj.discount_amount),
        amount: toNumber(obj.amount),
        validity: String(obj.validity ?? "event"),
        day: toOrderDay(obj.day),
        code: toStringOrNull(obj.code),
        qr_code: toStringOrNull(obj.qr_code),
        checked_in_at: toStringOrNull(obj.checked_in_at),
        entries: listOf(obj.entries, "entries").map((item) => {
            const entry = asObj(item);
            return { day_id: toNumberOrNull(entry.day_id), checked_in_at: toStringOrNull(entry.checked_in_at) };
        }),
    };
}

export function toOrder(raw: unknown): TicketOrder {
    const obj = asObj(unwrap(raw, "order"));
    const buyer = asObj(obj.buyer);
    const event = asObj(obj.event);
    const payment = objOrNull(obj.payment);
    return {
        id: toNumber(obj.id),
        status: String(obj.status ?? ""),
        status_label: String(obj.status_label ?? obj.status ?? ""),
        buyer_kind: String(obj.buyer_kind ?? ""),
        buyer: {
            name: String(buyer.name ?? ""),
            email: toStringOrNull(buyer.email),
            cpf: toStringOrNull(buyer.cpf),
        },
        total: toNumber(obj.total),
        discount_total: toNumber(obj.discount_total),
        coupon_code: toStringOrNull(obj.coupon_code),
        courtesy: obj.courtesy === true,
        hold_until: toStringOrNull(obj.hold_until),
        paid_at: toStringOrNull(obj.paid_at),
        origin: String(obj.origin ?? ""),
        event: {
            id: toNumber(event.id),
            title: String(event.title ?? ""),
            venue: toStringOrNull(event.venue),
            starts_at: toStringOrNull(event.starts_at),
            ends_at: toStringOrNull(event.ends_at),
            image_url: toStringOrNull(event.image_url),
            days: listOf(event.days, "days")
                .map(toOrderDay)
                .filter((day): day is OrderTicketDay => day !== null),
        },
        payment: payment ? { refunded_amount: toNumberOrNull(payment.refunded_amount) } : null,
        tickets: listOf(obj.tickets, "tickets").map(toOrderTicket),
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
function failure(response: IApiResponse): TicketFailure {
    const { status } = response;
    const body = asObj(response.data);
    const reason = toStringOrNull(body.reason);
    const fieldErrors = toFieldErrors(body.errors);

    let kind: TicketFailureKind;
    if (reason) kind = "rule";
    else if (status === 401) kind = "unauthorized";
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

    const firstFieldError = Object.values(fieldErrors)[0]?.[0] ?? null;
    const text =
        (kind === "validation" ? firstFieldError : null) ??
        toStringOrNull(body.message) ??
        toStringOrNull(body.error) ??
        fallback;

    return { ok: false, status, kind, reason, error: text, context: asObj(body.context), fieldErrors };
}

/* -------------------------------------------------------------------------- */
/* Chamadas                                                                    */
/* -------------------------------------------------------------------------- */

type Method = "GET" | "POST" | "DELETE";

/** Rotas públicas e do não sócio: 401 nunca desloga ninguém. */
function publicCall(method: Method, endpoint: string, body: unknown = null) {
    return API_CONSUME(method, endpoint, {}, body, { skipAuthCheck: true });
}

/**
 * Rotas do sócio. 401 sem `reason` = sessão vencida (ou o proxy sem sessão):
 * sai para o login, como o interceptor faria.
 */
async function memberCall(method: Method, endpoint: string, body: unknown = null) {
    const response = await API_CONSUME(method, endpoint, {}, body, { skipAuthCheck: true });
    if (response.status === 401 && !toStringOrNull(asObj(response.data).reason)) {
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        await signOut({ callbackUrl: comBase("/login"), redirect: true });
    }
    return response;
}

/**
 * Rotas próprias do servidor do site (`/api/ingressos/*`): criar o pedido do
 * não sócio e abrir pelo link — as que lidam com o `access_token`. Respondem
 * no mesmo formato da Lara.
 */
async function siteCall(method: Method, path: string, body: unknown = null): Promise<IApiResponse> {
    try {
        const response = await fetch(comBase(path), {
            method,
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: body ? JSON.stringify(body) : undefined,
            cache: "no-store",
        });
        const text = await response.text();
        let data: unknown = null;
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
        return { data, status: response.status, ok: response.ok };
    } catch {
        return { data: null, status: 503, ok: false, message: "Falha de conexão com a API." };
    }
}

const id = (value: number) => encodeURIComponent(String(value));

/* ---------------------------------------------------------------- Vitrine */

/** Publicados e encerrados. */
export async function fetchEvents(): Promise<TicketResult<TicketEvent[]>> {
    const response = await publicCall("GET", "tickets/events");
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: listOf(response.data, "events").map(toEvent) };
}

/** 404 `event_not_found` para rascunho, cancelado ou inexistente. */
export async function fetchEvent(eventId: number): Promise<TicketResult<TicketEvent>> {
    const response = await publicCall("GET", `tickets/events/${id(eventId)}`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toEvent(response.data) };
}

/** [v2] Só informa (prévia). A Lara limita a 20 por minuto. */
export async function checkCoupon(
    eventId: number,
    code: string,
    buyerKind: "member" | "guest"
): Promise<TicketResult<CouponPreview>> {
    const response = await publicCall("POST", `tickets/events/${id(eventId)}/coupon-check`, {
        code: code.trim(),
        buyer_kind: buyerKind,
    });
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toCoupon(response.data) };
}

/* ------------------------------------------------------------------ Sócio */

/** [v3] Pessoas do título do sócio logado, com `has_ticket`/`days_taken` deste evento. */
export async function fetchMyTitle(eventId: number): Promise<TicketResult<MyTitle>> {
    const query = new URLSearchParams({ event_id: String(eventId) });
    const response = await memberCall("GET", `tickets/my-title?${query}`);
    if (!response.ok) return failure(response);
    const body = asObj(response.data);
    return {
        ok: true,
        status: response.status,
        data: { title: String(body.title ?? ""), people: listOf(body.people, "people").map(toPerson) },
    };
}

export async function createMemberOrder(
    eventId: number,
    tickets: MemberTicketItem[],
    couponCode: string | null
): Promise<TicketResult<TicketOrder>> {
    const body: Obj = { tickets };
    if (couponCode) body.coupon_code = couponCode;
    const response = await memberCall("POST", `tickets/events/${id(eventId)}/orders`, body);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toOrder(response.data) };
}

export async function fetchMyOrders(): Promise<TicketResult<TicketOrder[]>> {
    const response = await memberCall("GET", "tickets/my-orders");
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: listOf(response.data, "orders").map(toOrder) };
}

/** De outro sócio: 404 `order_not_found`. */
export async function fetchMyOrder(orderId: number): Promise<TicketResult<TicketOrder>> {
    const response = await memberCall("GET", `tickets/orders/${id(orderId)}`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toOrder(response.data) };
}

/** Só pendente. Pago: 422 `paid_contact_organizer`. */
export async function withdrawMyOrder(orderId: number): Promise<TicketResult<TicketOrder>> {
    const response = await memberCall("DELETE", `tickets/orders/${id(orderId)}`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toOrder(response.data) };
}

/* -------------------------------------------------------------- Não sócio */

/**
 * Cria o pedido sem login. O servidor do site guarda o `access_token` num
 * cookie httpOnly e devolve o pedido sem ele.
 */
export async function createGuestOrder(
    eventId: number,
    buyer: GuestBuyer,
    tickets: GuestTicketItem[],
    couponCode: string | null
): Promise<TicketResult<TicketOrder>> {
    const body: Obj = { event_id: eventId, buyer, tickets };
    if (couponCode) body.coupon_code = couponCode;
    const response = await siteCall("POST", "/api/ingressos/pedidos", body);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toOrder(response.data) };
}

/** Link do e-mail: troca o token da URL pelo cookie deste aparelho. */
export async function openGuestOrder(orderId: number, token: string): Promise<TicketResult<TicketOrder>> {
    const response = await siteCall("POST", `/api/ingressos/pedidos/${id(orderId)}/abrir`, { token });
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toOrder(response.data) };
}

/** Sem o cookie do pedido neste aparelho: 404 `order_not_found`. */
export async function fetchGuestOrder(orderId: number): Promise<TicketResult<TicketOrder>> {
    const response = await publicCall("GET", `tickets/guest-orders/${id(orderId)}`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toOrder(response.data) };
}

export async function withdrawGuestOrder(orderId: number): Promise<TicketResult<TicketOrder>> {
    const response = await publicCall("DELETE", `tickets/guest-orders/${id(orderId)}`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toOrder(response.data) };
}

/** Sempre 200 com a mesma mensagem, exista pedido ou não. */
export async function resendGuestLink(cpf: string, email: string): Promise<TicketResult<string | null>> {
    const response = await publicCall("POST", "tickets/guest-orders/resend-link", { cpf, email: email.trim() });
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toStringOrNull(asObj(response.data).message) };
}

/* -------------------------------------------------------------------- PDF */

/**
 * PDF dos ingressos (só pedido pago). O servidor do site escolhe a rota da
 * Lara: a do não sócio se este aparelho tem o cookie do pedido, senão a do
 * sócio logado.
 */
export async function downloadOrderPdf(orderId: number): Promise<TicketResult<Blob>> {
    try {
        const response = await fetch(comBase(`/api/ingressos/pedidos/${id(orderId)}/pdf`), { cache: "no-store" });
        const type = response.headers.get("content-type") ?? "";
        if (response.ok && type.includes("pdf")) {
            return { ok: true, status: response.status, data: await response.blob() };
        }
        let data: unknown = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }
        return failure({ data, status: response.ok ? 502 : response.status, ok: false });
    } catch {
        return failure({ data: null, status: 503, ok: false });
    }
}
