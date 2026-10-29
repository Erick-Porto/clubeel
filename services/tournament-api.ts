/**
 * Cliente dos torneios na Lara.
 *
 * Mesmo caminho do resto do site: navegador → `/api/backend` (API_CONSUME) →
 * Lara. O proxy põe o `Authorization` da aplicação e, nas rotas de sócio, o
 * `Session` dele; o sócio é sempre o dono do Session — nenhum corpo aqui leva
 * id, CPF ou matrícula de sócio (a busca de convidado manda a matrícula ou o
 * CPF de QUEM SE PROCURA, e a Lara devolve uma `ref` opaca).
 *
 * O front não decide nada. Elegibilidade (sexo, idade), vagas, período de
 * inscrição, formação de time, chaveamento e placar vêm da Lara; este arquivo
 * só dá forma às respostas. Em recusa de regra, a tela decide pelo `reason`
 * (código estável) — nunca pelo texto.
 *
 * Três públicos, três tratamentos de 401/403:
 * - público (lista, detalhe, chaveamento): visitante deslogado; um 401 não
 *   pode deslogar ninguém (`skipAuthCheck`, como no Replay);
 * - sócio: 401 é sessão vencida → sai para o login. 403 NÃO desloga: é o
 *   `not_captain` da Lara (recusa de regra). Por isso o interceptor genérico do
 *   API_CONSUME fica desligado aqui e o 401 é tratado à mão;
 * - equipe do clube (lançamento de resultados): não usa login de sócio. O
 *   código de lançamento vai no header `Tournament-Code` (o proxy repassa só
 *   nessas rotas) e o 401 `invalid_code` volta para a tela do código.
 *
 * O pagamento NÃO passa por aqui: vai pelo fluxo de cartão do site
 * (`/api/erede/payment_methods` → `/api/success`), que relê as inscrições no
 * servidor para saber quanto cobrar e avisa a Lara com o `tid` (utils/lara.ts).
 */

import { signOut } from "next-auth/react";
import { toast } from "react-toastify";
import API_CONSUME, { type IApiResponse } from "./api-consume";
import { comBase } from "../utils/base-path";

/* -------------------------------------------------------------------------- */
/* Contratos                                                                   */
/* -------------------------------------------------------------------------- */

/** `published` | `in_progress` | `finished` (rascunho e cancelado nunca chegam). */
export type TournamentStatus = "published" | "in_progress" | "finished" | string;

/** `organizer` e `draw`: a organização monta no Lara. `captain`: o sócio monta pelo site. */
export type TeamFormation = "organizer" | "draw" | "captain" | string;

/** Time como aparece no detalhe do torneio. */
export interface TournamentTeamSummary {
    id: number;
    name: string;
    /** `complete` (todos pagaram) ou `forming`. */
    status: string;
    members: string[];
}

export interface TournamentCategory {
    id: number;
    name: string;
    /** Descrição pronta ("Duplas · Feminino · 30+ anos"). */
    summary: string;
    team_size: number;
    /** `male` | `female` | `any`. A Lara confere; aqui é só informação. */
    gender: string;
    min_age: number | null;
    max_age: number | null;
    price: number;
    /** `null` = sem limite. */
    max_registrations: number | null;
    paid_registrations: number;
    /** `null` = sem limite. As vagas são de quem paga primeiro. */
    vacancies_left: number | null;
    team_formation: TeamFormation;
    format: string;
    sets_to_win: number;
    /** Só com `true` o chaveamento pode ser mostrado. */
    bracket_published: boolean;
    teams: TournamentTeamSummary[];
}

export interface Tournament {
    id: number;
    title: string;
    description: string | null;
    image_url: string | null;
    place_group: { id: number; name: string } | null;
    status: TournamentStatus;
    registration_starts_at: string | null;
    registration_ends_at: string | null;
    /** Só com `true` a inscrição é oferecida. */
    registration_open: boolean;
    /** AAAA-MM-DD. */
    starts_on: string | null;
    ends_on: string | null;
    /** Regulamento (texto com quebras de linha). Só no detalhe. */
    rules: string | null;
    categories: TournamentCategory[];
}

/** `pending_payment` | `paid` | `withdrawn` | `cancelled`. */
export type RegistrationStatus = "pending_payment" | "paid" | "withdrawn" | "cancelled" | string;

/** Formato da inscrição em todas as respostas (inscrever, pagar, desistir, aceitar convite). */
export interface TournamentRegistration {
    id: number;
    status: RegistrationStatus;
    status_label: string;
    amount: number;
    paid_at: string | null;
    category: { id: number; name: string };
    tournament: { id: number; title: string; starts_on: string | null; registration_ends_at: string | null };
    /** `manual: true` = pago na secretaria. */
    payment: { id: number; manual: boolean; status: string } | null;
    team: { id: number; name: string; status: string } | null;
}

/** `gender`, `gender_unknown`, `birth_date_unknown`, `too_young`, `too_old`. */
export interface CategoryEligibility {
    category_id: number;
    eligible: boolean;
    reason: string | null;
    /** Inscrição ativa nessa categoria, se já existir: não pode ser escolhida de novo. */
    registration: TournamentRegistration | null;
}

export interface TournamentEligibility {
    tournament_id: number;
    registration_open: boolean;
    categories: CategoryEligibility[];
}

export interface RegistrationResult {
    registrations: TournamentRegistration[];
    /** Soma do que falta pagar (categoria de preço zero já volta paga e não entra). */
    total_due: number;
    pay_until: string | null;
}

export interface TeamMember {
    name: string;
    paid: boolean;
    captain: boolean;
}

export interface MyTeam {
    id: number;
    name: string;
    status: string;
    status_label: string;
    team_size: number;
    category: { id: number; name: string; team_formation: TeamFormation };
    tournament: { id: number; title: string };
    is_captain: boolean;
    members: TeamMember[];
    /** Só vem preenchido para o capitão. */
    pending_invites: { id: number; name: string }[];
}

/** Pessoa achada na busca do capitão. O CPF nunca volta; o convite vai pela `ref`. */
export interface MemberLookupResult {
    ref: string;
    name: string;
    cpf_masked: string;
    titular: boolean;
}

export interface TeamInvite {
    id: number;
    status: string;
    name: string;
    invited_by: string;
    team: { id: number; name: string; members: string[] };
    category: { id: number; name: string; price: number };
    tournament: { id: number; title: string; registration_ends_at: string | null };
}

export interface AcceptInviteResult {
    registration: TournamentRegistration;
    team: { id: number; name: string; status: string } | null;
}

/* ------------------------------------------------------------ Chaveamento */

export interface MatchTeam {
    id: number;
    name: string;
    members: string[];
}

export interface MatchSide {
    /** `null` enquanto não se sabe quem é. */
    team: MatchTeam | null;
    /** De onde vem quem ainda não se sabe ("1º do Grupo A"). */
    source: { group: string | null; position: number | null; label: string } | null;
    /** Sets ganhos (no W.O.: `sets_to_win` × 0). */
    sets: number | null;
}

export interface MatchSet {
    number: number;
    home_games: number;
    away_games: number;
    home_tiebreak: number | null;
    away_tiebreak: number | null;
}

/** `pending` | `finished` | `walkover` | `bye`. */
export type MatchStatus = "pending" | "finished" | "walkover" | "bye" | string;

export interface TournamentMatch {
    id: number;
    round: number;
    /** Pronto ("Semifinal", "1ª rodada"). */
    round_label: string;
    position: number;
    third_place: boolean;
    status: MatchStatus;
    status_label: string;
    home: MatchSide;
    away: MatchSide;
    winner_team_id: number | null;
    sets: MatchSet[];
    /** Para onde segue o vencedor — desenha as linhas da chave. */
    next_match_id: number | null;
    scheduled_at: string | null;
    location: string | null;
    /** Só nas rotas da equipe. */
    editable: boolean;
    /** Só nas rotas da equipe: lançado pela organização no Lara (não editar). */
    locked: boolean;
    /** Só nas rotas da equipe: `lara`, `site` ou `null`. */
    result_origin: string | null;
}

export interface GroupStanding {
    position: number;
    /** Classificação fechada pela organização. */
    final: boolean;
    team: { id: number; name: string } | null;
    played: number;
    wins: number;
    losses: number;
    sets_won: number;
    sets_lost: number;
    games_won: number;
    games_lost: number;
}

export interface BracketGroup {
    id: number;
    name: string;
    closed: boolean;
    standings: GroupStanding[];
    matches: TournamentMatch[];
}

export type BracketStage =
    | { type: "group"; groups: BracketGroup[] }
    | { type: "knockout"; rounds: number; matches: TournamentMatch[] };

export interface TournamentBracket {
    tournament_id: number;
    category_id: number;
    category_name: string;
    format: string;
    sets_to_win: number;
    published_at: string | null;
    stages: BracketStage[];
}

/* ----------------------------------------------------------------- Equipe */

export interface StaffTournament {
    id: number;
    title: string;
    status: string;
}

export interface StaffCheck {
    tournament: StaffTournament;
    valid_until: string | null;
}

export interface StaffMatches {
    tournament: StaffTournament;
    categories: TournamentBracket[];
}

export type StaffResult =
    | { sets: Array<{ home_games: number; away_games: number; home_tiebreak?: number; away_tiebreak?: number }> }
    | { walkover_winner_team_id: number };

/* ----------------------------------------------------------------- Falhas */

export type TournamentFailureKind =
    | "rule" // recusa de regra: tem `reason`
    | "validation" // 422 do Laravel com `errors`, sem `reason`
    | "throttled" // 429
    | "unauthorized" // 401 sem `reason` (sessão do sócio) — já levado ao login
    | "network"
    | "server";

export interface TournamentFailure {
    ok: false;
    status: number;
    kind: TournamentFailureKind;
    reason: string | null;
    /** Texto que a Lara mandou (ou um genérico). */
    error: string;
    context: Record<string, unknown>;
    fieldErrors: Record<string, string[]>;
}

export type TournamentResult<T> = { ok: true; status: number; data: T } | TournamentFailure;

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

function toStrings(raw: unknown): string[] {
    return Array.isArray(raw) ? raw.map((item) => String(typeof item === "object" ? asObj(item).name ?? "" : item)) : [];
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

/** Objeto puro ou envelopado em `<chave>`/`data`. */
function unwrap(raw: unknown, key: string): unknown {
    const obj = asObj(raw);
    if (objOrNull(obj[key])) return obj[key];
    if (objOrNull(obj.data)) return obj.data;
    return raw;
}

function toTeamSummary(raw: unknown): TournamentTeamSummary {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        status: String(obj.status ?? ""),
        members: toStrings(obj.members),
    };
}

function toCategory(raw: unknown): TournamentCategory {
    const obj = asObj(raw);
    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        summary: String(obj.summary ?? ""),
        team_size: toNumber(obj.team_size, 1),
        gender: String(obj.gender ?? "any"),
        min_age: toNumberOrNull(obj.min_age),
        max_age: toNumberOrNull(obj.max_age),
        price: toNumber(obj.price),
        max_registrations: toNumberOrNull(obj.max_registrations),
        paid_registrations: toNumber(obj.paid_registrations),
        vacancies_left: toNumberOrNull(obj.vacancies_left),
        team_formation: String(obj.team_formation ?? ""),
        format: String(obj.format ?? ""),
        sets_to_win: toNumber(obj.sets_to_win, 1),
        bracket_published: obj.bracket_published === true,
        teams: listOf(obj.teams, "teams").map(toTeamSummary),
    };
}

function toTournament(raw: unknown): Tournament {
    const obj = asObj(unwrap(raw, "tournament"));
    const group = objOrNull(obj.place_group);
    return {
        id: toNumber(obj.id),
        title: String(obj.title ?? ""),
        description: toStringOrNull(obj.description),
        image_url: toStringOrNull(obj.image_url),
        place_group: group ? { id: toNumber(group.id), name: String(group.name ?? "") } : null,
        status: String(obj.status ?? ""),
        registration_starts_at: toStringOrNull(obj.registration_starts_at),
        registration_ends_at: toStringOrNull(obj.registration_ends_at),
        registration_open: obj.registration_open === true,
        starts_on: toStringOrNull(obj.starts_on),
        ends_on: toStringOrNull(obj.ends_on),
        rules: toStringOrNull(obj.rules),
        categories: listOf(obj.categories, "categories").map(toCategory),
    };
}

function toShortTeam(raw: unknown): { id: number; name: string; status: string } | null {
    const obj = objOrNull(raw);
    return obj ? { id: toNumber(obj.id), name: String(obj.name ?? ""), status: String(obj.status ?? "") } : null;
}

function toRegistration(raw: unknown): TournamentRegistration {
    const obj = asObj(unwrap(raw, "registration"));
    const category = asObj(obj.category);
    const tournament = asObj(obj.tournament);
    const payment = objOrNull(obj.payment);
    return {
        id: toNumber(obj.id),
        status: String(obj.status ?? ""),
        status_label: String(obj.status_label ?? obj.status ?? ""),
        amount: toNumber(obj.amount),
        paid_at: toStringOrNull(obj.paid_at),
        category: { id: toNumber(category.id), name: String(category.name ?? "") },
        tournament: {
            id: toNumber(tournament.id),
            title: String(tournament.title ?? ""),
            starts_on: toStringOrNull(tournament.starts_on),
            registration_ends_at: toStringOrNull(tournament.registration_ends_at),
        },
        payment: payment
            ? { id: toNumber(payment.id), manual: payment.manual === true, status: String(payment.status ?? "") }
            : null,
        team: toShortTeam(obj.team),
    };
}

function toEligibility(raw: unknown): TournamentEligibility {
    const obj = asObj(raw);
    return {
        tournament_id: toNumber(obj.tournament_id),
        registration_open: obj.registration_open === true,
        categories: listOf(obj.categories, "categories").map((item) => {
            const entry = asObj(item);
            return {
                category_id: toNumber(entry.category_id),
                eligible: entry.eligible === true,
                reason: toStringOrNull(entry.reason),
                registration: objOrNull(entry.registration) ? toRegistration(entry.registration) : null,
            };
        }),
    };
}

function toMyTeam(raw: unknown): MyTeam {
    const obj = asObj(unwrap(raw, "team"));
    const category = asObj(obj.category);
    const tournament = asObj(obj.tournament);
    return {
        id: toNumber(obj.id),
        name: String(obj.name ?? ""),
        status: String(obj.status ?? ""),
        status_label: String(obj.status_label ?? obj.status ?? ""),
        team_size: toNumber(obj.team_size, 1),
        category: {
            id: toNumber(category.id),
            name: String(category.name ?? ""),
            team_formation: String(category.team_formation ?? ""),
        },
        tournament: { id: toNumber(tournament.id), title: String(tournament.title ?? "") },
        is_captain: obj.is_captain === true,
        members: listOf(obj.members, "members").map((item) => {
            const member = asObj(item);
            return { name: String(member.name ?? ""), paid: member.paid === true, captain: member.captain === true };
        }),
        pending_invites: listOf(obj.pending_invites, "pending_invites").map((item) => {
            const invite = asObj(item);
            return { id: toNumber(invite.id), name: String(invite.name ?? "") };
        }),
    };
}

function toInvite(raw: unknown): TeamInvite {
    const obj = asObj(unwrap(raw, "invite"));
    const team = asObj(obj.team);
    const category = asObj(obj.category);
    const tournament = asObj(obj.tournament);
    return {
        id: toNumber(obj.id),
        status: String(obj.status ?? ""),
        name: String(obj.name ?? ""),
        invited_by: String(obj.invited_by ?? ""),
        team: { id: toNumber(team.id), name: String(team.name ?? ""), members: toStrings(team.members) },
        category: { id: toNumber(category.id), name: String(category.name ?? ""), price: toNumber(category.price) },
        tournament: {
            id: toNumber(tournament.id),
            title: String(tournament.title ?? ""),
            registration_ends_at: toStringOrNull(tournament.registration_ends_at),
        },
    };
}

function toSide(raw: unknown): MatchSide {
    const obj = asObj(raw);
    const team = objOrNull(obj.team);
    const source = objOrNull(obj.source);
    return {
        team: team ? { id: toNumber(team.id), name: String(team.name ?? ""), members: toStrings(team.members) } : null,
        source: source
            ? {
                  group: toStringOrNull(source.group),
                  position: toNumberOrNull(source.position),
                  label: String(source.label ?? ""),
              }
            : null,
        sets: toNumberOrNull(obj.sets),
    };
}

function toMatch(raw: unknown): TournamentMatch {
    const obj = asObj(unwrap(raw, "match"));
    return {
        id: toNumber(obj.id),
        round: toNumber(obj.round),
        round_label: String(obj.round_label ?? ""),
        position: toNumber(obj.position),
        third_place: obj.third_place === true,
        status: String(obj.status ?? ""),
        status_label: String(obj.status_label ?? ""),
        home: toSide(obj.home),
        away: toSide(obj.away),
        winner_team_id: toNumberOrNull(obj.winner_team_id),
        sets: listOf(obj.sets, "sets").map((item) => {
            const set = asObj(item);
            return {
                number: toNumber(set.number),
                home_games: toNumber(set.home_games),
                away_games: toNumber(set.away_games),
                home_tiebreak: toNumberOrNull(set.home_tiebreak),
                away_tiebreak: toNumberOrNull(set.away_tiebreak),
            };
        }),
        next_match_id: toNumberOrNull(obj.next_match_id),
        scheduled_at: toStringOrNull(obj.scheduled_at),
        location: toStringOrNull(obj.location),
        editable: obj.editable === true,
        locked: obj.locked === true,
        result_origin: toStringOrNull(obj.result_origin),
    };
}

function toStage(raw: unknown): BracketStage | null {
    const obj = asObj(raw);
    if (obj.type === "group") {
        return {
            type: "group",
            groups: listOf(obj.groups, "groups").map((item) => {
                const group = asObj(item);
                return {
                    id: toNumber(group.id),
                    name: String(group.name ?? ""),
                    closed: group.closed === true,
                    standings: listOf(group.standings, "standings").map((row) => {
                        const standing = asObj(row);
                        const team = objOrNull(standing.team);
                        return {
                            position: toNumber(standing.position),
                            final: standing.final === true,
                            team: team ? { id: toNumber(team.id), name: String(team.name ?? "") } : null,
                            played: toNumber(standing.played),
                            wins: toNumber(standing.wins),
                            losses: toNumber(standing.losses),
                            sets_won: toNumber(standing.sets_won),
                            sets_lost: toNumber(standing.sets_lost),
                            games_won: toNumber(standing.games_won),
                            games_lost: toNumber(standing.games_lost),
                        };
                    }),
                    matches: listOf(group.matches, "matches").map(toMatch),
                };
            }),
        };
    }
    if (obj.type === "knockout") {
        return { type: "knockout", rounds: toNumber(obj.rounds), matches: listOf(obj.matches, "matches").map(toMatch) };
    }
    // Fase de tipo desconhecido: fica de fora em vez de quebrar a tela.
    return null;
}

function toBracket(raw: unknown): TournamentBracket {
    const obj = asObj(raw);
    return {
        tournament_id: toNumber(obj.tournament_id),
        category_id: toNumber(obj.category_id),
        category_name: String(obj.category_name ?? ""),
        format: String(obj.format ?? ""),
        sets_to_win: toNumber(obj.sets_to_win, 1),
        published_at: toStringOrNull(obj.published_at),
        stages: listOf(obj.stages, "stages")
            .map(toStage)
            .filter((stage): stage is BracketStage => stage !== null),
    };
}

function toStaffTournament(raw: unknown): StaffTournament {
    const obj = asObj(raw);
    return { id: toNumber(obj.id), title: String(obj.title ?? ""), status: String(obj.status ?? "") };
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
function failure(response: IApiResponse): TournamentFailure {
    const { status } = response;
    const body = asObj(response.data);
    const reason = toStringOrNull(body.reason);
    const fieldErrors = toFieldErrors(body.errors);

    let kind: TournamentFailureKind;
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

    // No erro de validação, a primeira mensagem de campo costuma ser a mais útil.
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

type Method = "GET" | "POST" | "PUT" | "DELETE";

/** Rotas públicas: visitante deslogado também chama; 401 nunca desloga. */
function publicCall(method: Method, endpoint: string, body: unknown = null) {
    return API_CONSUME(method, endpoint, {}, body, { skipAuthCheck: true });
}

/**
 * Rotas do sócio. 401 sem `reason` = sessão vencida (ou login sem conta na
 * Lara): sai para o login, como o interceptor faria. 403 fica com a tela
 * (`not_captain`).
 */
async function memberCall(method: Method, endpoint: string, body: unknown = null) {
    const response = await API_CONSUME(method, endpoint, {}, body, { skipAuthCheck: true });
    if (response.status === 401 && !toStringOrNull(asObj(response.data).reason)) {
        toast.error("Sua sessão expirou. Por favor, faça login novamente.");
        await signOut({ callbackUrl: comBase("/login"), redirect: true });
    }
    return response;
}

/** Rotas da equipe: o código vai no header, que o proxy repassa só nelas. */
function staffCall(method: Method, endpoint: string, code: string, body: unknown = null) {
    return API_CONSUME(method, endpoint, { "Tournament-Code": code }, body, { skipAuthCheck: true });
}

const id = (value: number) => encodeURIComponent(String(value));

/* ---------------------------------------------------------------- Público */

/** Publicados, em andamento e encerrados, do mais recente para o mais antigo. */
export async function fetchTournaments(placeGroupId?: number): Promise<TournamentResult<Tournament[]>> {
    const query = placeGroupId ? `?${new URLSearchParams({ place_group_id: String(placeGroupId) })}` : "";
    const response = await publicCall("GET", `tournaments${query}`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: listOf(response.data, "tournaments").map(toTournament) };
}

/** 404 `tournament_not_found` para rascunho, cancelado ou inexistente. */
export async function fetchTournament(tournamentId: number): Promise<TournamentResult<Tournament>> {
    const response = await publicCall("GET", `tournaments/${id(tournamentId)}`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toTournament(response.data) };
}

/** 404 `bracket_not_published` antes de a organização divulgar. */
export async function fetchBracket(tournamentId: number, categoryId: number): Promise<TournamentResult<TournamentBracket>> {
    const response = await publicCall("GET", `tournaments/${id(tournamentId)}/categories/${id(categoryId)}/bracket`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toBracket(response.data) };
}

/* ------------------------------------------------------------------ Sócio */

/** 422 `member_not_found`: o login não corresponde a sócio de título ativo. */
export async function fetchEligibility(tournamentId: number): Promise<TournamentResult<TournamentEligibility>> {
    const response = await memberCall("GET", `tournaments/${id(tournamentId)}/eligibility`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toEligibility(response.data) };
}

/** Ou entram todas as categorias, ou nenhuma. */
export async function registerInCategories(
    tournamentId: number,
    categoryIds: number[]
): Promise<TournamentResult<RegistrationResult>> {
    const response = await memberCall("POST", `tournaments/${id(tournamentId)}/registrations`, { category_ids: categoryIds });
    if (!response.ok) return failure(response);
    const body = asObj(response.data);
    return {
        ok: true,
        status: response.status,
        data: {
            registrations: listOf(body.registrations, "registrations").map(toRegistration),
            total_due: toNumber(body.total_due),
            pay_until: toStringOrNull(body.pay_until),
        },
    };
}

export async function fetchMyRegistrations(): Promise<TournamentResult<TournamentRegistration[]>> {
    const response = await memberCall("GET", "tournaments/my-registrations");
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: listOf(response.data, "registrations").map(toRegistration) };
}

/** Só antes de pagar. Paga: 422 `paid_contact_organizer`. */
export async function withdrawRegistration(registrationId: number): Promise<TournamentResult<TournamentRegistration>> {
    const response = await memberCall("DELETE", `tournaments/registrations/${id(registrationId)}`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toRegistration(response.data) };
}

export async function fetchMyTeams(): Promise<TournamentResult<MyTeam[]>> {
    const response = await memberCall("GET", "tournaments/my-teams");
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: listOf(response.data, "teams").map(toMyTeam) };
}

/** Nome opcional (até 60); vazio = a Lara usa o primeiro nome do capitão. */
export async function createTeam(categoryId: number, name: string): Promise<TournamentResult<MyTeam>> {
    const trimmed = name.trim();
    const response = await memberCall("POST", `tournaments/categories/${id(categoryId)}/teams`, trimmed ? { name: trimmed } : {});
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toMyTeam(response.data) };
}

/** Pela matrícula (a família do título) ou pelo CPF de quem se procura. */
export async function lookupMember(by: "title" | "cpf", value: string): Promise<TournamentResult<MemberLookupResult[]>> {
    const query = new URLSearchParams({ [by]: value });
    const response = await memberCall("GET", `tournaments/member-lookup?${query}`);
    if (!response.ok) return failure(response);
    return {
        ok: true,
        status: response.status,
        data: listOf(response.data, "members").map((item) => {
            const member = asObj(item);
            return {
                ref: String(member.ref ?? ""),
                name: String(member.name ?? ""),
                cpf_masked: String(member.cpf_masked ?? ""),
                titular: member.titular === true,
            };
        }),
    };
}

export async function inviteToTeam(teamId: number, ref: string): Promise<TournamentResult<TeamInvite>> {
    const response = await memberCall("POST", `tournaments/teams/${id(teamId)}/invites`, { ref });
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toInvite(response.data) };
}

export async function cancelInvite(inviteId: number): Promise<TournamentResult<null>> {
    const response = await memberCall("DELETE", `tournaments/invites/${id(inviteId)}`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: null };
}

export async function fetchMyInvites(): Promise<TournamentResult<TeamInvite[]>> {
    const response = await memberCall("GET", "tournaments/my-invites");
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: listOf(response.data, "invites").map(toInvite) };
}

/** Entra no time; se ainda não estava inscrito, a inscrição nasce aqui, aguardando pagamento. */
export async function acceptInvite(inviteId: number): Promise<TournamentResult<AcceptInviteResult>> {
    const response = await memberCall("POST", `tournaments/invites/${id(inviteId)}/accept`);
    if (!response.ok) return failure(response);
    const body = asObj(response.data);
    return {
        ok: true,
        status: response.status,
        data: { registration: toRegistration(body.registration), team: toShortTeam(body.team) },
    };
}

export async function declineInvite(inviteId: number): Promise<TournamentResult<null>> {
    const response = await memberCall("POST", `tournaments/invites/${id(inviteId)}/decline`);
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: null };
}

/* ----------------------------------------------------------------- Equipe */

/** Entrar com o código (a Lara limita a 10 tentativas por minuto). */
export async function staffCheck(tournamentId: number, code: string): Promise<TournamentResult<StaffCheck>> {
    const response = await staffCall("POST", `tournaments/${id(tournamentId)}/staff/check`, code, { code });
    if (!response.ok) return failure(response);
    const body = asObj(response.data);
    return {
        ok: true,
        status: response.status,
        data: { tournament: toStaffTournament(body.tournament), valid_until: toStringOrNull(body.valid_until) },
    };
}

/** Todas as categorias com chaveamento gerado (divulgado ou não), com `editable`/`locked` em cada jogo. */
export async function staffMatches(tournamentId: number, code: string): Promise<TournamentResult<StaffMatches>> {
    const response = await staffCall("GET", `tournaments/${id(tournamentId)}/staff/matches`, code);
    if (!response.ok) return failure(response);
    const body = asObj(response.data);
    return {
        ok: true,
        status: response.status,
        data: {
            tournament: toStaffTournament(body.tournament),
            categories: listOf(body.categories, "categories").map(toBracket),
        },
    };
}

/** Lança ou corrige. Depois, a tela relê os jogos (o vencedor já segue para o próximo). */
export async function staffSaveResult(
    tournamentId: number,
    matchId: number,
    code: string,
    operatorName: string,
    result: StaffResult
): Promise<TournamentResult<TournamentMatch>> {
    const response = await staffCall(
        "PUT",
        `tournaments/${id(tournamentId)}/staff/matches/${id(matchId)}/result`,
        code,
        { operator_name: operatorName, ...result }
    );
    if (!response.ok) return failure(response);
    return { ok: true, status: response.status, data: toMatch(response.data) };
}
