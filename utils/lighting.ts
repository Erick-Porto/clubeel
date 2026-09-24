/**
 * Formatação da tela de luz da quadra.
 *
 * Nada aqui é regra: nenhuma janela, dia da semana, feriado ou limite de
 * duração. Tudo que decide vem da Lara; estas funções só escrevem na tela o
 * que ela respondeu. Os horários chegam em ISO 8601 com offset do clube e são
 * exibidos no fuso do clube, não no do aparelho.
 */

import type { LightingWindow } from "../services/lighting-api";

const CLUB_TIME_ZONE = "America/Sao_Paulo";

const clockFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
});

export function parseInstant(iso: string | null | undefined): number {
    if (!iso) return NaN;
    return Date.parse(iso);
}

/** "21:30" — aceita o ISO da Lara ou um instante em ms. */
export function formatClock(value: string | number | null | undefined): string {
    const time = typeof value === "number" ? value : parseInstant(value);
    return Number.isNaN(time) ? "--:--" : clockFormatter.format(time);
}

/** "<dia da semana>, DD/MM" — o nome do dia sai do Intl, não de uma lista nossa. */
export function formatDay(iso: string): string {
    const time = parseInstant(iso);
    return Number.isNaN(time) ? "" : dayFormatter.format(time);
}

/** Data (AAAA-MM-DD) do instante `now` que a Lara mandou, no fuso do clube. */
function serverDate(nowIso: string): string {
    const time = parseInstant(nowIso);
    if (Number.isNaN(time)) return "";
    // en-CA formata como AAAA-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: CLUB_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(time);
}

/** A janela é de hoje? "Hoje" é a data do `now` da Lara, no fuso do clube. */
export function isWindowToday(window: LightingWindow, nowIso: string): boolean {
    return window.date !== "" && window.date === serverDate(nowIso);
}

/**
 * "hoje, das HH:MM às HH:MM" ou "<dia da semana>, DD/MM, das HH:MM às HH:MM". Os
 * horários são os `start`/`end` que a Lara mandou.
 */
export function describeWindow(window: LightingWindow, nowIso: string): string {
    const day = isWindowToday(window, nowIso) ? "hoje" : formatDay(window.starts_at);
    const start = window.start || formatClock(window.starts_at);
    const end = window.end || formatClock(window.ends_at);
    return `${day}, das ${start} às ${end}`;
}

/** "abre às HH:MM" (hoje) ou "abre <dia da semana>, DD/MM, às HH:MM". */
export function describeOpening(window: LightingWindow, nowIso: string): string {
    const start = window.start || formatClock(window.starts_at);
    return isWindowToday(window, nowIso) ? `abre às ${start}` : `abre ${formatDay(window.starts_at)}, às ${start}`;
}

/**
 * Até quando a luz da quadra deve ir depois de acionar `minutes` agora. Prolongar
 * conta a partir de agora, e a luz da quadra é a soma de todos: se outro sócio já
 * a levou mais longe, esse prazo continua valendo. É só uma previsão para a dica;
 * o número de verdade vem na resposta.
 */
export function expectedLitUntil(currentLitUntil: string | null, serverNow: number, minutes: number): number {
    const mine = serverNow + minutes * 60_000;
    const current = parseInstant(currentLitUntil);
    return Number.isNaN(current) ? mine : Math.max(mine, current);
}

/** Nome do feriado/dia especial, quando a janela veio do painel com um. */
export function windowOccasion(window: LightingWindow | null): string | null {
    if (!window || window.source !== "date") return null;
    return window.reason?.trim() || null;
}

/** "45 min", "1 h", "1 h 30 min" */
export function formatDuration(minutes: number): string {
    const safe = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safe / 60);
    const rest = safe % 60;
    if (hours === 0) return `${rest} min`;
    if (rest === 0) return `${hours} h`;
    return `${hours} h ${rest} min`;
}

/** "1:05:09" ou "5:09" */
export function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
    const ss = String(seconds).padStart(2, "0");
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Opções do seletor de duração, montadas só com o que a Lara mandou:
 * de `min` em passos de `step` até `max` (o `available_minutes` DA QUADRA:
 * o teto aparado no que resta da janela dela).
 * Se `max` não cair num passo, ele entra como última opção — é "até o
 * fechamento". Vazio quando nem o mínimo cabe.
 */
export function durationOptions(min: number, step: number, max: number): number[] {
    if (!(min > 0) || !(max >= min)) return [];

    const options: number[] = [];
    const increment = step > 0 ? step : min;
    for (let value = min; value <= max; value += increment) {
        options.push(value);
    }
    if (options[options.length - 1] !== max) options.push(max);
    return options;
}

/** URL da imagem da quadra — usada como vier, igual aos outros endpoints de espaço. */
export function placeImageUrl(image: string | null): string | null {
    if (!image) return null;
    return /^(https?:)?\/\//i.test(image) || image.startsWith("/") ? image : null;
}
