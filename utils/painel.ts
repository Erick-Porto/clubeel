/**
 * Formatação dos números e datas do painel (servidor e cliente).
 *
 * O `format` de cada KPI vem da Lara; aqui só se escreve o número em pt-BR.
 * Datas e horas sempre no fuso do clube: o servidor pode estar em UTC.
 */

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faCashRegister, faTicket } from "@fortawesome/free-solid-svg-icons";

const FUSO = "America/Sao_Paulo";

const INTEIRO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const DINHEIRO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PERCENTUAL = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** `int` → 1.234 · `money` → R$ 1.234,56 · `percent` → 30,0% (o valor já vem em %). */
export function formatarValor(valor: number | null | undefined, formato: string): string {
    if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
    const n = Number(valor);
    if (formato === "money") return DINHEIRO.format(n);
    if (formato === "percent") return `${PERCENTUAL.format(n)}%`;
    return INTEIRO.format(n);
}

export const formatarInteiro = (n: number) => formatarValor(n, "int");
export const formatarDinheiro = (n: number) => formatarValor(n, "money");

function valido(iso: string | null | undefined): Date | null {
    if (!iso) return null;
    const data = new Date(iso);
    return Number.isNaN(data.getTime()) ? null : data;
}

/** "02/12/2026" */
export function formatarData(iso: string | null | undefined): string {
    const data = valido(iso);
    return data ? data.toLocaleDateString("pt-BR", { timeZone: FUSO }) : "";
}

/** "22:00" */
export function formatarHora(iso: string | null | undefined): string {
    const data = valido(iso);
    return data ? data.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }) : "";
}

/** "2026-11-10" (dia da série, sem fuso) → "10/11". */
export function formatarDiaCurto(dia: string): string {
    const [, mes, d] = dia.split("-");
    return mes && d ? `${d}/${mes}` : dia;
}

/** "2026-11-10" → "10/11/2026". */
export function formatarDiaLongo(dia: string): string {
    const [ano, mes, d] = dia.split("-");
    return ano && mes && d ? `${d}/${mes}/${ano}` : dia;
}

/**
 * Painéis que o site sabe mostrar, por `key` da Lara. Painel com chave
 * desconhecida (o MultiClubes, quando chegar) não aparece até ganhar tela aqui.
 */
export const PAINEIS_CONHECIDOS: Record<string, { href: string; icon: IconDefinition }> = {
    ingressos: { href: "/painel/ingressos", icon: faTicket },
    vendas: { href: "/painel/vendas", icon: faCashRegister },
};

/* ------------------------------------------------- Datas do filtro de vendas */

/** Hoje no fuso do clube, AAAA-MM-DD (o servidor pode estar em UTC). */
export function hojeNoClube(): string {
    // en-CA escreve a data como AAAA-MM-DD.
    return new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
}

/** Soma dias a uma data AAAA-MM-DD (aritmética de calendário, sem fuso). */
export function somarDias(dia: string, dias: number): string {
    const [ano, mes, d] = dia.split("-").map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, d + dias));
    return data.toISOString().slice(0, 10);
}

/** Dias corridos entre duas datas AAAA-MM-DD, contando as duas pontas. */
export function diasNoPeriodo(de: string, ate: string): number {
    const [a1, m1, d1] = de.split("-").map(Number);
    const [a2, m2, d2] = ate.split("-").map(Number);
    return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000) + 1;
}

export const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
