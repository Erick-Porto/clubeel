/**
 * Formatação e textos dos torneios.
 *
 * Nada aqui é regra: elegibilidade, vagas, período, times, chaveamento e
 * placar vêm da Lara. Estas funções só escrevem na tela o que ela respondeu, e
 * os títulos das recusas saem do `reason` (código estável), nunca do texto.
 */

import type {
    MatchSide,
    TournamentFailure,
    TournamentMatch,
    TournamentRegistration,
} from "../services/tournament-api";
import { formatBRL, formatDayShort, formatInstant } from "./social";

export { formatBRL, formatInstant };

const CLUB_TIME_ZONE = "America/Sao_Paulo";

/** "sáb., 28/11/2026" — dia (AAAA-MM-DD), sem passar pelo fuso do aparelho. */
export function formatDay(day: string | null): string {
    return day ? formatDayShort(day) : "";
}

/** "28/11 a 29/11/2026", ou um dia só. */
export function formatDayRange(start: string | null, end: string | null): string {
    if (!start) return "";
    if (!end || end === start) return formatDayShort(start);
    const [sy, sm, sd] = start.split("-");
    const [ey, em, ed] = end.split("-");
    if (!sy || !ey) return `${formatDayShort(start)} a ${formatDayShort(end)}`;
    return sy === ey ? `${sd}/${sm} a ${ed}/${em}/${ey}` : `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`;
}

const matchTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: CLUB_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

/** Data e hora do jogo no fuso do clube: "sáb., 28/11, 09:00". */
export function formatMatchTime(iso: string | null): string {
    if (!iso) return "";
    const time = Date.parse(iso);
    return Number.isNaN(time) ? iso : matchTimeFormatter.format(time);
}

/** Slug `<nome>-<id>`, no mesmo formato das outras telas (só o id importa). */
export function tournamentSlug(title: string, id: number): string {
    const base = title
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${base || "torneio"}-${id}`;
}

/** Aceita `copa-de-verao-3` e `3` (o link da equipe pode vir só com o número). */
export function idFromParam(param: string | string[] | undefined): number | null {
    const raw = Array.isArray(param) ? param[0] : param;
    const id = Number(String(raw ?? "").split("-").pop());
    return Number.isInteger(id) && id > 0 ? id : null;
}

export function tournamentHref(title: string, id: number): string {
    return `/torneios/${tournamentSlug(title, id)}`;
}

export function bracketHref(tournament: { id: number; title: string }, category: { id: number; name: string }): string {
    return `${tournamentHref(tournament.title, tournament.id)}/chaveamento/${tournamentSlug(category.name, category.id)}`;
}

/** Rótulo do `status` do torneio (a lista não traz rótulo pronto). */
export function tournamentStatusLabel(status: string): string {
    switch (status) {
        case "published":
            return "Publicado";
        case "in_progress":
            return "Em andamento";
        case "finished":
            return "Encerrado";
        default:
            return status;
    }
}

/** "20 vagas", "Sem limite de vagas", "Vagas esgotadas" — só o número da Lara em frase. */
export function vacanciesText(vacanciesLeft: number | null): string {
    if (vacanciesLeft === null) return "Sem limite de vagas";
    if (vacanciesLeft <= 0) return "Vagas esgotadas";
    return `${vacanciesLeft} vaga${vacanciesLeft === 1 ? "" : "s"} restante${vacanciesLeft === 1 ? "" : "s"}`;
}

/** Texto dos motivos de não elegibilidade (sugerido no contrato da Lara). */
export function eligibilityText(reason: string | null): string {
    switch (reason) {
        case "gender":
            return "Categoria de outro sexo";
        case "gender_unknown":
        case "birth_date_unknown":
            return "Seu cadastro no clube está incompleto: procure a secretaria";
        case "too_young":
        case "too_old":
            return "Fora da faixa de idade da categoria";
        default:
            return "Você não pode se inscrever nesta categoria";
    }
}

/** Como o time se forma, em português. */
export function formationText(formation: string, teamSize: number): string {
    if (teamSize <= 1) return "Individual";
    switch (formation) {
        case "captain":
            return "Você monta o time e convida os parceiros";
        case "draw":
            return "Times sorteados pela organização";
        case "organizer":
            return "Times montados pela organização";
        default:
            return "";
    }
}

/** Selo da inscrição: só a aparência; o texto é o `status_label` da Lara. */
export function registrationTone(status: string): "ok" | "warn" | "danger" | "off" {
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

/** Selo do time (`complete` × `forming`). */
export function teamTone(status: string): "ok" | "warn" | "off" {
    if (status === "complete") return "ok";
    if (status === "forming") return "warn";
    return "off";
}

export function teamStatusLabel(status: string): string {
    if (status === "complete") return "Completo";
    if (status === "forming") return "Em formação";
    return status;
}

/** Inscrição que ainda pode ser paga pelo site (o botão aparece até `registration_ends_at`). */
export function isPayable(registration: TournamentRegistration, now = Date.now()): boolean {
    if (registration.status !== "pending_payment") return false;
    const end = registration.tournament.registration_ends_at;
    if (!end) return true;
    const time = Date.parse(end);
    return Number.isNaN(time) || time >= now;
}

/* ------------------------------------------------------------------ Placar */

/** "6-4 3-6 7-6 (7-5)"; W.O.: "W.O."; sem sets: "". */
export function formatScore(match: Pick<TournamentMatch, "status" | "sets">): string {
    if (match.status === "walkover") return "W.O.";
    return match.sets
        .map((set) => {
            const base = `${set.home_games}-${set.away_games}`;
            return set.home_tiebreak !== null && set.away_tiebreak !== null
                ? `${base} (${set.home_tiebreak}-${set.away_tiebreak})`
                : base;
        })
        .join(" ");
}

/** Nome do lado: o time, de onde ele vem ("1º do Grupo A") ou "a definir". */
export function sideLabel(side: MatchSide): { text: string; known: boolean } {
    if (side.team) return { text: side.team.name, known: true };
    if (side.source?.label) return { text: side.source.label, known: false };
    return { text: "A definir", known: false };
}

/* ----------------------------------------------------------------- Recusas */

/**
 * Título de cada recusa, escolhido pelo CÓDIGO (`reason`), nunca pelo texto. O
 * detalhe exibido abaixo é a `message` da Lara, quando ela mandou.
 */
const REASON_TITLES: Record<string, string> = {
    tournament_not_found: "Torneio não encontrado",
    registration_closed: "As inscrições deste torneio estão fechadas",
    member_not_found: "Não encontramos seu cadastro de sócio",
    category_not_found: "Categoria não encontrada",
    ineligible: "Você não pode entrar nesta categoria",
    already_registered: "Você já está inscrito nesta categoria",
    category_full: "As vagas desta categoria acabaram",
    invalid_status: "Essa inscrição mudou de situação",
    not_owner: "Inscrição não encontrada",
    payment_mismatch: "O valor das inscrições mudou",
    paid_contact_organizer: "Inscrição já paga",
    already_paid: "Inscrição já paga",
    wrong_formation: "Nesta categoria os times são montados pela organização",
    team_not_found: "Time não encontrado",
    not_captain: "Só o capitão pode fazer isso",
    team_full: "O time já está completo",
    already_in_team: "Essa pessoa já está num time da categoria",
    not_registered: "Inscreva-se na categoria antes de criar o time",
    invite_not_found: "Convite não encontrado",
    bracket_not_published: "O chaveamento ainda não foi divulgado",
};

/** Texto de apoio quando a Lara não mandou mensagem. */
const REASON_FALLBACKS: Record<string, string> = {
    member_not_found: "Procure a secretaria do clube.",
    category_full: "A vaga é de quem paga primeiro. Atualizamos as vagas.",
    paid_contact_organizer: "Para desistir de uma inscrição paga, fale com a organização do torneio.",
    already_paid:
        "O pagamento já foi registrado (pela secretaria ou por outro caminho). Nada foi cobrado de novo — se o cartão chegou a ser cobrado, o valor foi estornado.",
    invalid_status: "Atualizamos suas inscrições — confira antes de tentar de novo.",
    payment_mismatch: "Atualizamos suas inscrições — confira o total antes de tentar de novo.",
    invite_not_found: "Ele pode ter sido retirado ou já respondido.",
};

export interface TournamentFlash {
    tone: "neutral" | "alert";
    title: string;
    text: string;
}

export function refusalFlash(failure: TournamentFailure, fallbackTitle = "Não deu certo"): TournamentFlash {
    const reason = failure.reason ?? "";
    const title = REASON_TITLES[reason] ?? fallbackTitle;
    let text = failure.error && failure.kind !== "server" ? failure.error : REASON_FALLBACKS[reason] ?? failure.error;
    // `ineligible` traz o motivo em `context.detail`: o mesmo texto da elegibilidade.
    if (reason === "ineligible" && !failure.error) {
        text = eligibilityText(typeof failure.context.detail === "string" ? failure.context.detail : null);
    }
    if (reason === "member_not_found" && text && !text.includes("secretaria")) {
        text = `${text} Procure a secretaria do clube.`;
    }
    return { tone: failure.kind === "rule" ? "neutral" : "alert", title, text: text ?? "" };
}

/** Falha que já levou ao login (401 de sessão): a tela não precisa avisar. */
export function isSilent(failure: TournamentFailure): boolean {
    return failure.kind === "unauthorized";
}
