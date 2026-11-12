/**
 * Cliente dos dashboards da Lara (`/api/dashboard/*`) — SÓ no servidor.
 *
 * O navegador de quem usa o site não alcança a Lara, e estes endpoints NÃO
 * estão na allowlist do proxy (`pages/api/backend`) de propósito: todas as
 * chamadas partem dos Server Components de `app/painel`, com o token da
 * aplicação (`Authorization: Bearer`, posto pelo `API_CONSUME` no servidor) e o
 * `Session` do sócio logado, tirado da sessão do NextAuth.
 *
 * Ser administrador é decidido pela Lara a cada chamada (um administrador
 * rebaixado recebe 403 já na próxima, com o mesmo token). Por isso nada aqui
 * guarda "é admin" além da requisição atual: o `cache` do React vale só para a
 * renderização em curso (layout e página dividem a mesma resposta).
 *
 * Sem o pacote `server-only` neste projeto (ver services/aprovacao-api.ts), o
 * guard abaixo faz o papel dele.
 */

if (typeof window !== "undefined") {
    throw new Error("services/dashboard-api só pode ser importado no servidor.");
}

import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import API_CONSUME from "./api-consume";

/* ------------------------------------------------------------------ Tipos */

export interface PainelDisponivel {
    key: string;
    label: string;
    path: string;
}

export interface Acesso {
    admin: boolean;
    member: { name: string; title: string } | null;
    panels: PainelDisponivel[];
}

export interface EventoDoPainel {
    id: number;
    title: string;
    venue: string | null;
    starts_at: string | null;
    ends_at: string | null;
    status: string;
    status_label: string;
    sold?: number;
    net?: number;
}

export interface ListaDeEventos {
    default_event_id: number | null;
    events: EventoDoPainel[];
}

export type FormatoKpi = "int" | "money" | "percent";

export interface Kpi {
    key: string;
    label: string;
    value: number | null;
    format: FormatoKpi;
}

export interface Resumo {
    event: EventoDoPainel;
    kpis: Kpi[];
    generated_at: string | null;
}

export interface VendaDoDia {
    date: string;
    tickets: number;
    amount: number;
}

export interface LinhaDeLote {
    type: string;
    lot: string;
    capacity: number | null;
    member: number;
    non_member: number;
    courtesies: number;
    total: number;
    net: number;
}

export interface FatiaDeCanal {
    key: string;
    label: string;
    count: number;
    amount: number;
}

export interface LinhaDeForma {
    method: string;
    count: number;
    paid: number;
    refunded: number;
    received: number;
}

/* Vendas (MultiVendas) */

export interface FiltroDeVendas {
    /** AAAA-MM-DD, repassados como vieram da URL (quem valida é a Lara: 422). */
    de?: string;
    ate?: string;
    /** Vazio = todas as lojas (não manda `stores[]`). */
    lojas: string[];
}

export interface ItemDeValor {
    label: string;
    amount: number;
}

export interface Vendas {
    period: { from: string; to: string; days: number };
    stores: { selected: string[]; all: boolean };
    kpis: Kpi[];
    by_store: ItemDeValor[];
    top_products: ItemDeValor[];
    by_hour: { hour: number; amount: number }[];
    by_day: { date: string; amount: number; sales: number }[];
    payment_methods: ItemDeValor[];
    sellers: ItemDeValor[];
    generated_at: string | null;
}

export interface DadosDoEvento {
    resumo: Resumo;
    porDia: VendaDoDia[];
    porLote: LinhaDeLote[];
    porCanal: { origin: FatiaDeCanal[]; buyer: FatiaDeCanal[] };
    porForma: LinhaDeForma[];
}

/**
 * Falha já traduzida para o que a tela faz (tabela de erros do contrato):
 * 400/401 → login (e volta ao painel); 403 → sem acesso; 404 → evento não
 * encontrado; 422 → filtro inválido (mensagem da Lara junto do filtro);
 * 429 → muitas atualizações; o resto (inclusive o 503 do MultiVendas fora do
 * ar) → indisponível, com a mensagem da Lara.
 */
export type TipoDeFalha = "login" | "sem-acesso" | "nao-encontrado" | "invalido" | "limite" | "indisponivel";

export interface Falha {
    ok: false;
    tipo: TipoDeFalha;
    mensagem: string | null;
}

export type Resultado<T> = { ok: true; dados: T } | Falha;

/** Quando várias chamadas falham juntas, vale a mais grave. */
const GRAVIDADE: TipoDeFalha[] = ["login", "sem-acesso", "nao-encontrado", "invalido", "limite", "indisponivel"];

function tipoPorStatus(status: number): TipoDeFalha {
    if (status === 400 || status === 401) return "login";
    if (status === 403) return "sem-acesso";
    if (status === 404) return "nao-encontrado";
    if (status === 422) return "invalido";
    if (status === 429) return "limite";
    return "indisponivel";
}

/* -------------------------------------------------------------- Chamadas */

/** Token da Lara do sócio logado (o `Session`). Lido uma vez por renderização. */
const tokenDoSocio = cache(async (): Promise<string | null> => {
    const sessao = await getServerSession(authOptions);
    return sessao?.accessToken || null;
});

async function chamar<T>(endpoint: string): Promise<Resultado<T>> {
    const token = await tokenDoSocio();
    if (!token) return { ok: false, tipo: "login", mensagem: null };

    // `API_CONSUME` no servidor já vai direto à Lara, com o Bearer da aplicação
    // e `cache: 'no-store'` (o número tem que ser o de agora).
    const resposta = await API_CONSUME<T>("GET", `dashboard/${endpoint}`, { Session: token });
    if (resposta.ok && resposta.data) return { ok: true, dados: resposta.data };
    return { ok: false, tipo: tipoPorStatus(resposta.status), mensagem: resposta.message ?? null };
}

/** `GET /api/dashboard/access` — perfil conferido na Lara, a cada página. */
export const lerAcesso = cache(() => chamar<Acesso>("access"));

/** `GET /api/dashboard/tickets/events` — publicados, encerrados e cancelados. */
export const lerEventosDoPainel = cache(() => chamar<ListaDeEventos>("tickets/events"));

/** As 5 chamadas do evento, em paralelo. Uma falha derruba o conjunto. */
export async function lerDadosDoEvento(id: number): Promise<Resultado<DadosDoEvento>> {
    const base = `tickets/events/${encodeURIComponent(String(id))}`;
    const [resumo, porDia, porLote, porCanal, porForma] = await Promise.all([
        chamar<Resumo>(`${base}/summary`),
        chamar<{ series: VendaDoDia[] }>(`${base}/sales-by-day`),
        chamar<{ rows: LinhaDeLote[] }>(`${base}/by-lot`),
        chamar<{ origin: FatiaDeCanal[]; buyer: FatiaDeCanal[] }>(`${base}/by-channel`),
        chamar<{ rows: LinhaDeForma[] }>(`${base}/by-method`),
    ]);

    const falhas = [resumo, porDia, porLote, porCanal, porForma].filter((r): r is Falha => !r.ok);
    if (falhas.length > 0) {
        falhas.sort((a, b) => GRAVIDADE.indexOf(a.tipo) - GRAVIDADE.indexOf(b.tipo));
        return falhas[0];
    }

    // Aqui todas deram certo; os `if` só estreitam o tipo.
    if (!resumo.ok || !porDia.ok || !porLote.ok || !porCanal.ok || !porForma.ok) {
        return { ok: false, tipo: "indisponivel", mensagem: null };
    }

    return {
        ok: true,
        dados: {
            resumo: { ...resumo.dados, kpis: resumo.dados.kpis ?? [] },
            porDia: porDia.dados.series ?? [],
            porLote: porLote.dados.rows ?? [],
            porCanal: { origin: porCanal.dados.origin ?? [], buyer: porCanal.dados.buyer ?? [] },
            porForma: porForma.dados.rows ?? [],
        },
    };
}

/** `GET /api/dashboard/sales/stores` — nomes das lojas, já em ordem, usados exatamente como vêm. */
export const lerLojas = cache(() => chamar<{ stores: string[] }>("sales/stores"));

/**
 * `GET /api/dashboard/sales?from&to&stores[]` — tudo calculado pela Lara
 * (faturamento, ticket médio, vendas = `ID_Venda` distinto). As listas já vêm
 * do maior para o menor; o site não reordena. Sem cache aqui: quem guarda os
 * números (60 s / 10 min) é a Lara.
 */
export async function lerVendas(filtro: FiltroDeVendas): Promise<Resultado<Vendas>> {
    const consulta = new URLSearchParams();
    if (filtro.de) consulta.set("from", filtro.de);
    if (filtro.ate) consulta.set("to", filtro.ate);
    for (const loja of filtro.lojas) consulta.append("stores[]", loja);
    const texto = consulta.toString();
    const resultado = await chamar<Vendas>(texto ? `sales?${texto}` : "sales");
    if (!resultado.ok) return resultado;

    const v = resultado.dados;
    return {
        ok: true,
        dados: {
            ...v,
            kpis: v.kpis ?? [],
            by_store: v.by_store ?? [],
            top_products: v.top_products ?? [],
            by_hour: v.by_hour ?? [],
            by_day: v.by_day ?? [],
            payment_methods: v.payment_methods ?? [],
            sellers: v.sellers ?? [],
        },
    };
}
