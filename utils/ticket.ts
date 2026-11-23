/**
 * Formatação e textos dos ingressos de eventos.
 *
 * Nada aqui é regra: lote, preço, estoque, limite, lotação de cada dia, cupom e
 * total vêm da Lara. Estas funções só escrevem na tela o que ela respondeu; os
 * títulos das recusas saem do `reason` (código estável), nunca do texto.
 *
 * Exceções combinadas no contrato, só para AJUDAR a pessoa antes de enviar (a
 * Lara confere tudo de novo): a validação dos dígitos do CPF, o CPF repetido no
 * mesmo dia do pedido do não sócio e a PRÉVIA do cupom (o desconto que vale é
 * o que volta no pedido).
 */

import type {
    CouponPreview,
    OrderTicket,
    TicketEvent,
    TicketEventDay,
    TicketFailure,
    TicketLot,
    TicketOrder,
    TicketType,
} from "../services/ticket-api";
import { formatBRL, formatInstant, maskCpf, onlyDigits } from "./social";

export { formatBRL, formatInstant, maskCpf, onlyDigits };

const CLUB_TIME_ZONE = "America/Sao_Paulo";

export type BuyerKind = "member" | "guest";

/* ------------------------------------------------------------------ Datas */

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
});

function parse(iso: string | null): number | null {
    if (!iso) return null;
    const time = Date.parse(iso);
    return Number.isNaN(time) ? null : time;
}

/** "22:00". */
export function formatTime(iso: string | null): string {
    const time = parse(iso);
    return time === null ? "" : timeFormatter.format(time);
}

/** "sáb., 13/02". */
export function formatShortDate(iso: string | null): string {
    const time = parse(iso);
    return time === null ? "" : shortDateFormatter.format(time);
}

const dayMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
});

/**
 * Quando o evento acontece, no fuso de Brasília: "sáb., 13/02/2027, 22:00 às
 * 04:00" (o fim pode cair no dia seguinte) ou, em dias diferentes, as duas
 * datas completas.
 *
 * [v4] Evento de vários dias (com `days`): só as datas, do primeiro ao último
 * dia — "13/02 a 14/02" (os horários ficam nos blocos de cada dia).
 */
export function formatWhen(
    start: string | null,
    end: string | null,
    days: { starts_at: string | null }[] = []
): string {
    if (days.length > 1) {
        const first = parse(days[0].starts_at ?? start);
        const last = parse(days[days.length - 1].starts_at ?? end);
        if (first !== null && last !== null) {
            const a = dayMonthFormatter.format(first);
            const b = dayMonthFormatter.format(last);
            return a === b ? a : `${a} a ${b}`;
        }
    }
    const s = parse(start);
    if (s === null) return "";
    const e = parse(end);
    if (e === null) return dateTimeFormatter.format(s);
    const sameDay = dayKeyFormatter.format(s) === dayKeyFormatter.format(e);
    const nextMorning = !sameDay && e - s < 24 * 60 * 60 * 1000;
    if (sameDay || nextMorning) return `${dateTimeFormatter.format(s)} às ${timeFormatter.format(e)}`;
    return `${dateTimeFormatter.format(s)} a ${dateTimeFormatter.format(e)}`;
}

/**
 * Horário do dia de um evento de vários dias: "18:00 às 02:00". [sessões] Com o
 * `time_label` da Lara ("09:00–10:30"), vale o dela.
 */
export function formatDayHours(day: { starts_at: string | null; ends_at: string | null; time_label?: string }): string {
    if (day.time_label) return day.time_label;
    const start = formatTime(day.starts_at);
    const end = formatTime(day.ends_at);
    return start && end ? `${start} às ${end}` : start;
}

/* ------------------------------------------------------------- Endereços */

/** Slug `<titulo>-<id>` (só o id importa). */
export function eventSlug(title: string, id: number): string {
    const base = title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${base || "evento"}-${id}`;
}

export function eventHref(event: { id: number; title: string }): string {
    return `/ingressos/${eventSlug(event.title, event.id)}`;
}

export function buyHref(event: { id: number; title: string }, guest = false): string {
    return `${eventHref(event)}/comprar${guest ? "?modo=nao-socio" : ""}`;
}

/** Aceita `baile-de-carnaval-3` e `3`. */
export function idFromParam(param: string | string[] | undefined): number | null {
    const raw = Array.isArray(param) ? param[0] : param;
    const id = Number(String(raw ?? "").split("-").pop());
    return Number.isInteger(id) && id > 0 ? id : null;
}

/** Página do pedido: a do sócio fica em "Meus ingressos"; a do não sócio é a do link. */
export function orderHref(orderId: number, kind: BuyerKind): string {
    return kind === "guest" ? `/ingressos/pedido/${orderId}` : `/ingressos/meus/${orderId}`;
}

/* ----------------------------------------------------------------- Preços */

/** O preço que vale para quem compra; `null` = este lote não vende para ele. */
export function priceFor(lot: TicketLot | null, kind: BuyerKind): number | null {
    if (!lot) return null;
    if (kind === "member") return lot.price_member;
    return lot.members_only ? null : lot.price_non_member;
}

/** Só para sócios: `members_only` ou sem preço de não sócio. */
export function isMembersOnly(lot: TicketLot | null): boolean {
    return !!lot && (lot.members_only || lot.price_non_member === null);
}

/** O tipo pode entrar num pedido agora (a Lara diz `available` e manda o lote). */
export function isBuyable(type: TicketType, kind: BuyerKind): boolean {
    return type.available && !type.session_closed && priceFor(type.lot, kind) !== null;
}

/**
 * [sessões] Quando a tela precisa reler o evento: o primeiro `sales_ends_at`
 * ainda por vir entre os tipos à venda (a diária para de vender no fim da
 * sessão dela) e o do evento. `null` = nada para vigiar.
 */
export function nextSalesChange(event: TicketEvent, now = Date.now()): number | null {
    const times = [event.sales_ends_at, ...event.types.filter((type) => type.available).map((type) => type.sales_ends_at)]
        .map(parse)
        .filter((time): time is number => time !== null && time > now);
    return times.length ? Math.min(...times) : null;
}

/** "a partir de" da vitrine: o menor preço de ENTRADA à venda para quem está vendo (mesa não é entrada). */
export function lowestPrice(event: TicketEvent, kind: BuyerKind): number | null {
    const prices = event.types
        .filter((type) => type.available && !isSeatType(type))
        .map((type) => priceFor(type.lot, kind))
        .filter((price): price is number => price !== null);
    return prices.length ? Math.min(...prices) : null;
}

/**
 * Selo "últimos ingressos": `remaining` pequeno. O número que dispara é só
 * apresentação (a Lara manda o estoque; o site escolhe quando avisar).
 */
export const FEW_LEFT = 10;

export function fewLeft(lot: TicketLot | null): boolean {
    return !!lot && lot.remaining !== null && lot.remaining > 0 && lot.remaining <= FEW_LEFT;
}

/* ------------------------------------------------------ Lugar marcado */

/**
 * [lugares] Tipo de lugar marcado (mesa, bistrô, camarote): o lugar é escolhido
 * no mapa e NÃO é entrada — cada pessoa compra a própria entrada à parte.
 */
export function isSeatType(type: Pick<TicketType, "kind">): boolean {
    return type.kind === "seat";
}

/** "4 lugares" / "1 lugar". */
export function placesText(places: number): string {
    return `${places} lugar${places === 1 ? "" : "es"}`;
}

/** "Mesa Vip V2" — o nome do tipo e o rótulo do lugar no mapa. */
export function seatName(typeName: string, label: string): string {
    return [typeName, label].filter(Boolean).join(" ");
}

/** Título do bloco de lugares: os nomes dos mapas ("Mesas e Bistrôs"). */
export function seatBlockTitle(event: Pick<TicketEvent, "maps">): string {
    const names = event.maps.map((map) => map.name).filter(Boolean);
    if (names.length === 0) return "Lugares marcados";
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export const SEAT_NOT_ENTRY = "Não é entrada: cada pessoa compra a própria entrada à parte.";

/**
 * [cativas] "sáb., 13/02 às 18:00" — quando as cativas não compradas viram lugar
 * comum. `null` sem prazo ou se o prazo já passou (aí a Lara já liberou).
 */
export function captiveReleaseText(iso: string | null, now = Date.now()): string | null {
    const time = parse(iso);
    if (time === null || time <= now) return null;
    return `${formatShortDate(iso)} às ${formatTime(iso)}`;
}

/** "3 ingressos" ou "2 ingressos · 1 lugar marcado" (listas de pedidos). */
export function orderCountText(tickets: Pick<OrderTicket, "kind">[]): string {
    const seats = tickets.filter((ticket) => ticket.kind === "seat").length;
    const entries = tickets.length - seats;
    const parts: string[] = [];
    if (entries > 0 || seats === 0) parts.push(`${entries} ingresso${entries === 1 ? "" : "s"}`);
    if (seats > 0) parts.push(`${seats} lugar${seats === 1 ? "" : "es"} marcado${seats === 1 ? "" : "s"}`);
    return parts.join(" · ");
}

/* --------------------------------------------------- Dias (vários dias) */

export interface DayGroup {
    day: TicketEventDay;
    types: TicketType[];
}

/**
 * [sessões] Uma data do evento com os dias dela. Mais de um = SESSÕES (vários
 * horários na mesma data); um só = dia comum, escolhido direto como antes.
 */
export interface DateGroup {
    date: string;
    /** "Sáb 21/11". */
    label: string;
    days: DayGroup[];
    /** A data tem mais de um horário. */
    sessions: boolean;
    /** Todos os dias/sessões da data já terminaram. */
    closed: boolean;
}

/** [sessões] Algum dia do evento é sessão (há mais de um horário numa data). */
export function hasSessions(event: Pick<TicketEvent, "days">): boolean {
    return event.days.some((day) => day.is_session);
}

/** [sessões] "sessão" no lugar de "dia" quando o dia é sessão. */
export function dayWord(day: Pick<TicketEventDay, "is_session"> | null | undefined): "sessão" | "dia" {
    return day?.is_session ? "sessão" : "dia";
}

/**
 * [sessões] O tipo não vende mais porque a sessão (ou o dia) dele terminou:
 * "Sessão encerrada" / "Dia encerrado". `null` se não é o caso.
 */
export function closedTypeText(type: Pick<TicketType, "session_closed" | "day_id">, days: TicketEventDay[]): string | null {
    if (!type.session_closed) return null;
    const day = days.find((item) => item.id === type.day_id);
    if (day?.is_session) return "Sessão encerrada";
    return day ? "Dia encerrado" : "Encerrado";
}

/**
 * Tipos de ENTRADA agrupados por dia, na ordem dos `days`, e o passaporte à
 * parte. [lugares] Os tipos de lugar marcado vão em `seats` (bloco próprio).
 */
export function groupTypes(event: TicketEvent): {
    days: DayGroup[];
    /** [sessões] Os mesmos `days`, agrupados pela data (`event.dates`). */
    dates: DateGroup[];
    passport: TicketType[];
    single: TicketType[];
    seats: TicketType[];
} {
    const seats = event.types.filter(isSeatType);
    const entries = event.types.filter((type) => !isSeatType(type));
    if (!event.multi_day) return { days: [], dates: [], passport: [], single: entries, seats };
    const days = event.days.map((day) => ({
        day,
        types: entries.filter((type) => type.validity === "day" && type.day_id === day.id),
    }));
    const dates = event.dates
        .map((date) => {
            const groups = date.days
                .map((id) => days.find((group) => group.day.id === id))
                .filter((group): group is DayGroup => group !== undefined);
            return {
                date: date.date,
                label: date.label,
                days: groups,
                sessions: groups.length > 1,
                closed: groups.length > 0 && groups.every((group) => group.day.closed),
            };
        })
        .filter((date) => date.days.length > 0);
    return {
        days,
        dates,
        passport: entries.filter((type) => type.validity === "passport"),
        single: [],
        seats,
    };
}

/**
 * Nome do tipo com o dia — o nome pode se repetir entre dias ("Pista"), então
 * no evento de vários dias ele sempre sai com o `label` do dia.
 */
export function typeLabel(type: TicketType, days: TicketEventDay[]): string {
    if (type.validity === "passport") return `${type.name} · todos os dias`;
    if (type.validity === "day") {
        const day = days.find((item) => item.id === type.day_id);
        return day ? `${type.name} · ${day.label}` : type.name;
    }
    return type.name;
}

/**
 * "Diária · Sáb 14/02", "Passaporte · todos os dias" ou "" (evento de um dia).
 * [lugares] O lugar é sempre de um dia: só o dia ("Sáb 14/02"), sem "Diária".
 * [sessões] Na sessão, data e horário: "Sessão · Sáb 21/11 · 09:00–10:30" (o
 * `label` da Lara já leva o horário).
 */
export function validityText(ticket: Pick<OrderTicket, "validity" | "day"> & { kind?: string }): string {
    if (ticket.kind === "seat") return ticket.day ? ticket.day.label : "";
    if (ticket.validity === "passport") return "Passaporte · todos os dias";
    if (ticket.validity === "day") {
        if (!ticket.day) return "Diária";
        return `${ticket.day.is_session ? "Sessão" : "Diária"} · ${ticket.day.label}`;
    }
    return "";
}

/**
 * O evento já terminou? Pelo fim do evento e dos dias (o maior). Sem data,
 * "não" — a tela continua mostrando o ingresso.
 */
export function eventIsOver(event: { ends_at: string | null; days: { ends_at: string | null }[] }, now = Date.now()): boolean {
    const ends = [event.ends_at, ...event.days.map((day) => day.ends_at)]
        .map(parse)
        .filter((time): time is number => time !== null);
    return ends.length > 0 && now > Math.max(...ends);
}

/**
 * [v4] Passaporte que já entrou num dia (`status: "used"`) continua valendo nos
 * outros enquanto o evento não termina — não é "Utilizado".
 */
export function passportStillValid(ticket: Pick<OrderTicket, "validity" | "status">, over: boolean): boolean {
    return ticket.validity === "passport" && ticket.status === "used" && !over;
}

/** Entradas registradas na portaria, com o rótulo do dia ("Entrou em Sáb 13/02, 21:14"). */
export function entryTexts(ticket: OrderTicket, days: { id: number; label: string }[]): string[] {
    return ticket.entries
        .filter((entry) => entry.checked_in_at)
        .map((entry) => {
            const day = days.find((item) => item.id === entry.day_id);
            const when = formatTime(entry.checked_in_at);
            return day ? `Entrou em ${day.label}, ${when}` : `Entrou em ${formatInstant(entry.checked_in_at)}`;
        });
}

/* ------------------------------------------------------------------ Cupom */

/** O cupom vale para este público? */
export function couponFitsBuyer(coupon: CouponPreview, kind: BuyerKind): boolean {
    if (coupon.audience === "member") return kind === "member";
    if (coupon.audience === "non_member") return kind === "guest";
    return true;
}

/**
 * PRÉVIA do desconto num ingresso (o que vale é o `discount_amount` do pedido):
 * porcentagem do preço do lote ou valor fixo, nunca abaixo de zero, só nos
 * tipos da lista do cupom.
 */
export function couponPreviewDiscount(coupon: CouponPreview | null, typeId: number, price: number, kind: BuyerKind): number {
    if (!coupon || !couponFitsBuyer(coupon, kind)) return 0;
    if (coupon.type_ids && !coupon.type_ids.includes(typeId)) return 0;
    const raw = coupon.kind === "percent" ? (price * coupon.value) / 100 : coupon.kind === "fixed" ? coupon.value : 0;
    return Math.min(price, Math.max(0, Math.round(raw * 100) / 100));
}

/**
 * Código do ingresso para mostrar: as letras e os números separados, para a
 * portaria ler ("CT-48291" → "CT-" e "48291"). Não é validação — o código é
 * mostrado como a Lara manda (os antigos `ING-…` continuam valendo); sem hífen
 * fica inteiro. `digits` = quantos números há depois do hífen, se só números.
 */
export function splitTicketCode(code: string): { prefix: string; rest: string; digits: number | null } {
    const at = code.indexOf("-");
    if (at <= 0 || at === code.length - 1) return { prefix: "", rest: code, digits: null };
    const rest = code.slice(at + 1);
    return { prefix: code.slice(0, at + 1), rest, digits: /^\d+$/.test(rest) ? rest.length : null };
}

/** "carla@email.com" → "c***@email.com" (para dizer para onde foi o código). */
export function maskEmail(email: string): string {
    const [user, domain] = email.trim().split("@");
    if (!user || !domain) return email.trim();
    return `${user[0]}***@${domain}`;
}

/* -------------------------------------------------------------------- CPF */

/**
 * O CPF digitado bate com o mascarado da Lara ("529.***.**7-25")? Compara só
 * as posições que vieram com dígito — serve para destacar quem já tem ingresso.
 */
export function cpfMatchesMasked(cpf: string, masked: unknown): boolean {
    if (typeof masked !== "string") return false;
    const digits = onlyDigits(cpf);
    const pattern = masked.replace(/[.\-\s]/g, "");
    if (digits.length !== 11 || pattern.length !== 11) return false;
    return [...pattern].every((char, i) => char === "*" || char === digits[i]);
}

/** Dígitos verificadores do CPF (a Lara confere de novo). */
export function isValidCpf(value: string): boolean {
    const cpf = onlyDigits(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const digit = (length: number) => {
        let sum = 0;
        for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
        const rest = (sum * 10) % 11;
        return rest === 10 ? 0 : rest;
    };
    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/* ---------------------------------------------------------------- Selos */

export function orderTone(status: string): "ok" | "warn" | "danger" | "off" {
    switch (status) {
        case "paid":
            return "ok";
        case "pending_payment":
            return "warn";
        case "cancelled":
            return "danger";
        default:
            return "off";
    }
}

export function ticketTone(status: string): "ok" | "warn" | "danger" | "info" | "off" {
    switch (status) {
        case "valid":
            return "ok";
        case "pending":
            return "warn";
        case "used":
            return "info";
        case "cancelled":
            return "danger";
        default:
            return "off";
    }
}

/** Texto do status do ingresso (o `status_label` da Lara tem preferência). */
export function ticketStatusText(ticket: Pick<OrderTicket, "status" | "status_label">): string {
    if (ticket.status_label && ticket.status_label !== ticket.status) return ticket.status_label;
    switch (ticket.status) {
        case "pending":
            return "Aguardando pagamento";
        case "valid":
            return "Válido";
        case "used":
            return "Utilizado";
        case "expired":
            return "Expirado";
        case "cancelled":
            return "Cancelado";
        default:
            return ticket.status;
    }
}

/** Valor do pedido na tela: cortesia não tem valor. */
export function orderValueText(order: Pick<TicketOrder, "courtesy" | "total">): string {
    return order.courtesy ? "Cortesia" : formatBRL(order.total);
}

/* ----------------------------------------------------------------- Recusas */

const REASON_TITLES: Record<string, string> = {
    event_not_found: "Este evento não está mais disponível",
    sales_closed: "Vendas fechadas",
    type_not_found: "Esse tipo de ingresso não está mais à venda",
    sold_out: "Esse ingresso esgotou",
    capacity_full: "Evento esgotado",
    members_only: "Este lote é só para sócios",
    limit_per_order: "Ingressos demais no pedido",
    already_has_ticket: "Essa pessoa já tem ingresso",
    invalid_holder: "Confira os dados do ingresso",
    holder_is_member: "Esse CPF é de sócio",
    holder_not_in_title: "Essa pessoa não é do seu título",
    member_not_found: "Não encontramos seu cadastro de sócio",
    order_not_found: "Pedido não encontrado",
    invalid_status: "Esse pedido mudou de situação",
    hold_expired: "Os ingressos esgotaram",
    payment_mismatch: "O valor do pedido mudou",
    paid_contact_organizer: "Pedido já pago",
    already_paid: "Pedido já pago",
    coupon_invalid: "Cupom inválido",
    coupon_not_applicable: "Esse cupom não vale para este pedido",
    coupon_exhausted: "Cupom esgotado",
    access_code_invalid: "Código incorreto",
    access_code_expired: "Este código não vale mais",
    access_expired: "Seu acesso venceu",
    seat_required: "Escolha o lugar no mapa",
    seat_not_found: "Esse lugar não está mais disponível",
    seat_wrong_type: "Esse lugar não é vendido por esse tipo",
    seat_taken: "Esse lugar acabou de ser reservado",
    day_required: "Não foi possível abrir o mapa",
    map_not_found: "Mapa não encontrado",
    seat_captive: "Esse lugar está indisponível",
    session_closed: "Esta sessão já terminou",
};

/** Texto de apoio quando a Lara não mandou mensagem. */
const REASON_FALLBACKS: Record<string, string> = {
    sales_closed: "Atualizamos o evento.",
    sold_out: "Atualizamos o evento: confira se há um próximo lote.",
    members_only: "O sócio compra pelo login de sócio.",
    holder_is_member: "O sócio compra o próprio ingresso entrando com o login de sócio.",
    holder_not_in_title: "Quem não é do seu título compra como não sócio ou, se for sócio de outro título, pelo login dele.",
    member_not_found: "Procure a secretaria do clube.",
    order_not_found: "Abra o link que enviamos por e-mail ou peça o link de novo.",
    invalid_status: "Atualizamos o pedido — confira antes de tentar de novo.",
    hold_expired: "Os ingressos esgotaram enquanto o pagamento era feito. O valor foi estornado.",
    payment_mismatch: "Atualizamos o pedido — confira o total antes de tentar de novo.",
    paid_contact_organizer: "Para desistir de um pedido pago, fale com a organização do evento.",
    already_paid:
        "O pagamento já foi registrado. Nada foi cobrado de novo — se o cartão chegou a ser cobrado, o valor foi estornado.",
    seat_required: "Escolha o lugar no mapa.",
    seat_not_found: "Atualizamos o mapa: escolha outro lugar.",
    seat_wrong_type: "Atualizamos o mapa: escolha outro lugar.",
    seat_taken: "Escolha outro.",
    map_not_found: "O mapa saiu de venda. Atualizamos o evento.",
    seat_captive: "Atualizamos o mapa: escolha outro lugar.",
    session_closed: "Atualizamos o evento e tiramos esse ingresso do pedido.",
};

export interface TicketFlash {
    tone: "neutral" | "alert";
    title: string;
    text: string;
}

export function refusalFlash(failure: TicketFailure, fallbackTitle = "Não deu certo", days: TicketEventDay[] = []): TicketFlash {
    const reason = failure.reason ?? "";
    let title = REASON_TITLES[reason] ?? fallbackTitle;
    // [v4] Dia lotado no evento de vários dias: "Sáb 13/02 esgotado".
    // [sessões] Sessão lotada: "Sessão Sáb 21/11 · 09:00–10:30 esgotada".
    if (reason === "capacity_full" && failure.context.day_id !== undefined && failure.context.day_id !== null) {
        const day = days.find((item) => item.id === Number(failure.context.day_id));
        if (day) title = day.is_session ? `Sessão ${day.label} esgotada` : `${day.label} esgotado`;
    }
    // [sessões] A diária é de um dia que já terminou (fora de sessão): "Este dia já terminou".
    if (reason === "session_closed" && failure.context.day_id !== undefined && failure.context.day_id !== null) {
        const day = days.find((item) => item.id === Number(failure.context.day_id));
        if (day && !day.is_session) title = "Este dia já terminou";
    }
    // [v4] Já tem ingresso no mesmo dia (`day_id`) ou passaporte (`day_id: null`).
    if (reason === "already_has_ticket" && "day_id" in failure.context) {
        const dayId = failure.context.day_id;
        const day = days.find((item) => item.id === Number(dayId));
        if (dayId === null) title = "Essa pessoa já tem passaporte neste evento";
        else if (day) title = `Essa pessoa já tem ingresso em ${day.label}`;
    }
    if (reason === "coupon_exhausted" && typeof failure.context.remaining === "number" && failure.context.remaining > 0) {
        const left = failure.context.remaining;
        title = `Este cupom vale para mais ${left} ingresso${left === 1 ? "" : "s"}`;
    }
    // [cativas] `seat_captive`: o texto é sempre o do site — a mensagem da Lara
    // pode dizer que é cativa, e quem não é o dono não precisa saber.
    const text =
        failure.error && failure.kind !== "server" && reason !== "seat_captive"
            ? failure.error
            : REASON_FALLBACKS[reason] ?? failure.error;
    return { tone: failure.kind === "rule" ? "neutral" : "alert", title, text: text ?? "" };
}

/** Falha que já levou ao login (401 de sessão): a tela não precisa avisar. */
export function isSilent(failure: TicketFailure): boolean {
    return failure.kind === "unauthorized";
}

export const COUPON_REASONS = new Set(["coupon_invalid", "coupon_not_applicable", "coupon_exhausted"]);

/** Recusas em que o evento mudou (lote, estoque, janela): relê o evento. */
export const EVENT_RELOAD_REASONS = new Set([
    "sales_closed",
    "type_not_found",
    "sold_out",
    "capacity_full",
    "members_only",
    // [lugares] `seats_free` mudou.
    "seat_taken",
    "seat_not_found",
    "seat_wrong_type",
    "map_not_found",
    "seat_captive",
    // [sessões] A sessão da diária terminou.
    "session_closed",
]);


/** [lugares] Recusas de lugar: a tela volta ao mapa (relido). */
export const SEAT_REASONS = new Set(["seat_required", "seat_not_found", "seat_wrong_type", "seat_taken", "seat_captive"]);
