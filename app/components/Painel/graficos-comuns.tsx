"use client";

/**
 * Peças comuns dos gráficos do painel (Ingressos e Vendas): cores das séries,
 * cartão, frase de vazio, legenda e caixa do tooltip. Regras de desenho em
 * docs/resumo-modulos/18-painel.md (um eixo por gráfico, cores --viz-* sempre
 * na mesma ordem, texto em --ink-*).
 */

import type { ReactNode } from "react";
import style from "../../../styles/painel.module.css";

export const CORES = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)", "var(--viz-6)"];
/** Mais fatias do que cores: o resto fica cinza (nunca uma cor inventada). */
export const corDaFatia = (i: number) => CORES[i] ?? "var(--ink-3)";

export const EIXO = { fill: "var(--ink-3)", fontSize: 12 };
export const GRADE = "var(--line)";

/* ------------------------------------------------------------ Peças comuns */

export function Cartao({ titulo, acao, largo, children }: { titulo: string; acao?: ReactNode; largo?: boolean; children: ReactNode }) {
    return (
        <section className={`${style.grafico} ${largo ? style.graficoInteiro : ""}`}>
            <div className={style.graficoTopo}>
                <h3 className={style.graficoTitulo}>{titulo}</h3>
                {acao}
            </div>
            {children}
        </section>
    );
}

export function Vazio({ children }: { children: ReactNode }) {
    return <p className={style.vazio}>{children}</p>;
}

export function Legenda({ itens }: { itens: { cor: string; rotulo: string; tracejado?: boolean }[] }) {
    return (
        <ul className={style.legenda}>
            {itens.map((item) => (
                <li key={item.rotulo}>
                    <span
                        className={item.tracejado ? style.legendaTraco : style.legendaCor}
                        style={{ background: item.tracejado ? undefined : item.cor, borderColor: item.cor }}
                        aria-hidden="true"
                    />
                    {item.rotulo}
                </li>
            ))}
        </ul>
    );
}

/** Caixa do tooltip: título e linhas "rótulo — valor", com a cor da série ao lado. */
export function CaixaDica({ titulo, linhas }: { titulo: string; linhas: { rotulo: string; valor: string; cor?: string }[] }) {
    return (
        <div className={style.dica}>
            <strong>{titulo}</strong>
            {linhas.map((linha) => (
                <div key={linha.rotulo} className={style.dicaLinha}>
                    {linha.cor && <span className={style.legendaCor} style={{ background: linha.cor }} aria-hidden="true" />}
                    <span>{linha.rotulo}</span>
                    <span className={style.mono}>{linha.valor}</span>
                </div>
            ))}
        </div>
    );
}

/* Recharts entrega o tooltip com `active` e `payload` (a linha de dados em `payload[0].payload`). */
// `T` só documenta qual linha o gráfico entrega; o tipo da Recharts é genérico.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type DicaProps<T> = { active?: boolean; payload?: { payload?: unknown }[] };

export function linhaDaDica<T>(props: DicaProps<T>): T | null {
    const linha = props.active && props.payload && props.payload.length > 0 ? props.payload[0].payload : null;
    return (linha as T | undefined) ?? null;
}
