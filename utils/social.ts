/**
 * Formatação e textos dos espaços sociais.
 *
 * Nada aqui é regra: disponibilidade, preço, desconto, prazo, limite, horário
 * e mesas/cadeiras vêm da Lara. Estas funções só escrevem na tela o que ela
 * respondeu — e as `estimate*` são só ESTIMATIVAS para a pré-reserva (os
 * oficiais são `total`, `end_time`, `tables_total`/`chairs_total` da resposta).
 */

import type { SocialCatalogItem, SocialFailure, SocialPlace } from "../services/social-api";

const CLUB_TIME_ZONE = "America/Sao_Paulo";

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: number): string {
    return brlFormatter.format(Number.isFinite(value) ? value : 0);
}

/**
 * A data de uma reserva é um DIA (AAAA-MM-DD), não um instante: monta a data em
 * UTC e formata em UTC para não "voltar um dia" no fuso do aparelho.
 */
function dayToDate(day: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

const longDayFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
});

const shortDayFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
});

/** "sábado, 21 de novembro de 2026". */
export function formatDayLong(day: string): string {
    const date = dayToDate(day);
    return date ? longDayFormatter.format(date) : day;
}

/** "sáb., 21/11/2026". */
export function formatDayShort(day: string): string {
    const date = dayToDate(day);
    return date ? shortDayFormatter.format(date) : day;
}

const instantFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

/** Prazos (`payment_due_at`, `guests_editable_until`) no fuso do clube: "21/10/2026, 23:59". */
export function formatInstant(iso: string | null): string {
    if (!iso) return "";
    const time = Date.parse(iso);
    return Number.isNaN(time) ? iso : instantFormatter.format(time);
}

/** Mês (AAAA-MM) de hoje no fuso do clube — só o ponto de partida do calendário. */
export function currentClubMonth(): string {
    // en-CA formata como AAAA-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: CLUB_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
        .format(new Date())
        .slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
    const [year, mon] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });

/** "novembro de 2026". */
export function formatMonth(month: string): string {
    const [year, mon] = month.split("-").map(Number);
    if (!year || !mon) return month;
    return monthFormatter.format(new Date(Date.UTC(year, mon - 1, 1)));
}

/** Dia da semana (0 = domingo) do primeiro dia do mês — para alinhar a grade. */
export function firstWeekday(month: string): number {
    const [year, mon] = month.split("-").map(Number);
    return new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
}

export function onlyDigits(value: string): string {
    return value.replace(/\D/g, "");
}

/** Máscara de digitação 000.000.000-00. Validar CPF é com a Lara. */
export function maskCpf(value: string): string {
    const digits = onlyDigits(value).slice(0, 11);
    return digits
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/**
 * Estimativa da pré-reserva com os preços do catálogo ATUAL. Só para a tela: o
 * valor oficial (com preços congelados e eventual desconto) é o `total` que a
 * Lara devolve.
 */
export function estimateTotal(
    place: Pick<SocialPlace, "price" | "extra_guest_price">,
    extraGuests: number,
    items: SocialCatalogItem[],
    quantities: Record<number, number>
): { base: number; extras: number; items: number; total: number } {
    const base = place.price;
    const extras = extraGuests * place.extra_guest_price;
    const itemsTotal = items.reduce((sum, item) => sum + (quantities[item.id] ?? 0) * item.price, 0);
    return { base, extras, items: itemsTotal, total: base + extras + itemsTotal };
}

/** Estimativa de mesas e cadeiras: base + Σ quantidade × por unidade. */
export function estimateFurniture(
    baseTables: number,
    baseChairs: number,
    items: SocialCatalogItem[],
    quantities: Record<number, number>
): { tables: number; chairs: number } {
    return items.reduce(
        (acc, item) => {
            const quantity = quantities[item.id] ?? 0;
            return {
                tables: acc.tables + quantity * item.tables_per_unit,
                chairs: acc.chairs + quantity * item.chairs_per_unit,
            };
        },
        { tables: baseTables, chairs: baseChairs }
    );
}

/** Item de mesa/cadeira (o resto do catálogo é bebida). */
export function isFurniture(category: string): boolean {
    return category === "mobiliario";
}

/**
 * Fim ESTIMADO do evento (início + duração), só para mostrar ao lado do campo.
 * O oficial é o `end_time` da reserva.
 */
export function estimateEndTime(start: string, hours: number | null): { end: string; nextDay: boolean } | null {
    const match = /^(\d{2}):(\d{2})$/.exec(start);
    if (!match || !hours || hours <= 0) return null;
    const minutes = Number(match[1]) * 60 + Number(match[2]) + Math.round(hours * 60);
    const inDay = minutes % (24 * 60);
    const end = `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`;
    return { end, nextDay: minutes >= 24 * 60 };
}

/** "20:00 às 02:00 (dia seguinte)". */
export function formatTimeRange(start: string | null, end: string | null, nextDay: boolean): string {
    if (!start) return "";
    if (!end) return `a partir das ${start}`;
    return `${start} às ${end}${nextDay ? " (dia seguinte)" : ""}`;
}

/** "Evento de 6 horas · início entre 10:00 e 20:00" — `null` se o espaço não tem horário. */
export function describeEventWindow(
    place: Pick<SocialPlace, "event_duration_hours" | "event_earliest_start" | "event_latest_start">
): string | null {
    if (!place.event_duration_hours) return null;
    const hours = place.event_duration_hours;
    const duration = `Evento de ${hours} hora${hours === 1 ? "" : "s"}`;
    const { event_earliest_start: from, event_latest_start: to } = place;
    if (from && to) return `${duration} · início entre ${from} e ${to}`;
    if (from) return `${duration} · início a partir das ${from}`;
    if (to) return `${duration} · início até as ${to}`;
    return duration;
}

/** "13 mesas e 52 cadeiras". */
export function formatFurnitureCount(tables: number, chairs: number): string {
    return `${tables} mesa${tables === 1 ? "" : "s"} e ${chairs} cadeira${chairs === 1 ? "" : "s"}`;
}

/** Slug `<nome>-<id>`, no mesmo formato das outras telas (só o id importa). */
export function socialSlug(name: string, id: number): string {
    const base = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${base || "espaco"}-${id}`;
}

export function idFromSlug(slug: string | undefined): number | null {
    const id = Number(String(slug ?? "").split("-").pop());
    return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Título de cada recusa, escolhido pelo CÓDIGO (`reason`), nunca pelo texto. O
 * detalhe exibido abaixo é o que a Lara escreveu, quando ela escreveu.
 */
const REASON_TITLES: Record<string, string> = {
    place_not_social: "Este espaço não está disponível para reserva",
    date_unavailable: "Essa data acabou de ser ocupada",
    date_blocked: "O clube bloqueou essa data",
    out_of_window: "Essa data está fora do período de reserva",
    limit_reached: "Você atingiu o limite de reservas deste grupo",
    over_capacity: "Passou do limite de pessoas ou convidados",
    beverage_unavailable: "Um dos itens saiu do catálogo",
    item_limit: "Quantidade acima do permitido para um item",
    invalid_time: "Confira o horário de início",
    already_paid: "Esta reserva já está paga",
    invalid_guest: "Confira a lista de convidados",
    guests_locked: "A lista de convidados já está fechada",
    invalid_stage: "Essa ação não cabe mais nesta reserva",
    contract_closed: "A pré-reserva não aceita mais alterações",
    payment_mismatch: "Não foi possível pagar esta reserva agora",
    not_owner: "Reserva não encontrada",
};

/** Texto de apoio quando a Lara não mandou mensagem. */
const REASON_FALLBACKS: Record<string, string> = {
    date_unavailable: "Escolha outra data no calendário.",
    date_blocked: "Escolha outra data no calendário.",
    out_of_window: "Escolha outra data no calendário.",
    limit_reached: "Quando uma das suas reservas terminar, você poderá reservar de novo.",
    guests_locked: "Para alterar a lista agora, fale com a secretaria.",
    contract_closed: "O contrato já foi fechado com a secretaria.",
    invalid_stage: "A reserva mudou de situação e os dados foram atualizados.",
    beverage_unavailable: "Atualizamos o catálogo: confira as bebidas e as mesas e cadeiras antes de enviar de novo.",
    already_paid:
        "O pagamento já foi registrado (pela secretaria ou por outro caminho). Nada foi cobrado de novo — se o cartão chegou a ser cobrado, o valor foi estornado.",
    payment_mismatch: "O prazo ou o valor desta reserva mudou. Atualizamos os dados — confira antes de tentar de novo.",
    not_owner: "Ela pode ter sido removida ou não pertence à sua conta.",
};

/**
 * Recusas em que não há mais o que fazer pelo site: além da mensagem, o sócio é
 * orientado a falar com a secretaria.
 */
const SECRETARY_REASONS = new Set(["contract_closed", "invalid_stage"]);
const SECRETARY_HINT = "Para mudar algo, fale com a secretaria pelo WhatsApp (24) 9 9251-0959.";

export interface SocialFlash {
    tone: "neutral" | "alert";
    title: string;
    text: string;
}

/**
 * Complemento montado com o `context` da recusa (limite do item, faixa de
 * horário) — dado da Lara, só colocado em frase.
 */
function contextSentence(failure: SocialFailure): string {
    const context = failure.context;
    if (failure.reason === "item_limit" && context.max_quantity != null) {
        return `Máximo de ${context.max_quantity} por reserva.`;
    }
    if (failure.reason === "invalid_time") {
        const from = context.earliest_start ? String(context.earliest_start).slice(0, 5) : null;
        const to = context.latest_start ? String(context.latest_start).slice(0, 5) : null;
        if (from && to) return `O início precisa ficar entre ${from} e ${to}.`;
        if (from) return `O início precisa ser a partir das ${from}.`;
        if (to) return `O início precisa ser até as ${to}.`;
    }
    return "";
}

export function refusalFlash(failure: SocialFailure, fallbackTitle = "Não deu certo"): SocialFlash {
    const reason = failure.reason ?? "";
    const title = REASON_TITLES[reason] ?? fallbackTitle;
    const base = failure.error && failure.kind !== "server" ? failure.error : REASON_FALLBACKS[reason] ?? failure.error;
    const extra = contextSentence(failure);
    const text = extra && !base?.includes(extra) ? `${base ?? ""} ${extra}` : base;
    const hint = SECRETARY_REASONS.has(reason) ? ` ${SECRETARY_HINT}` : "";
    return { tone: failure.kind === "rule" ? "neutral" : "alert", title, text: `${text ?? ""}${hint}`.trim() };
}

/** Índice da linha de convidado recusada (`context.index`), se veio. */
export function refusedGuestIndex(failure: SocialFailure): number | null {
    if (failure.reason !== "invalid_guest") return null;
    const index = Number(failure.context.index);
    return Number.isInteger(index) && index >= 0 ? index : null;
}

/** Cores do selo de estágio. Estágio desconhecido cai no neutro. */
export function stageTone(stage: string): "pending" | "action" | "ok" | "muted" {
    switch (stage) {
        case "requested":
            return "pending";
        case "awaiting_payment":
            return "action";
        case "confirmed":
            return "ok";
        default:
            return "muted";
    }
}

/** Aviso de `requested` (e do pós-criação): prazo de contato da secretaria. */
export const CONTACT_NOTICE = "A secretaria do clube vai entrar em contato em até 2 dias úteis para o contrato.";

/** Frase de cada estágio, como a tabela do contrato pede. */
export function stageSentence(stage: string): string {
    switch (stage) {
        case "requested":
            return "Em análise pela secretaria.";
        case "awaiting_payment":
            return "Aprovada pela secretaria. Falta o pagamento.";
        case "confirmed":
            return "Confirmada.";
        case "refused":
            return "Recusada pela secretaria.";
        case "cancelled":
            return "Cancelada.";
        case "expired":
            return "Expirada — prazo de pagamento vencido.";
        default:
            return "";
    }
}
