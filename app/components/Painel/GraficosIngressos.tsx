"use client";

/**
 * Os quatro gráficos de /painel/ingressos (Recharts). Os dados chegam prontos
 * do Server Component: aqui só se desenha.
 *
 * Regras de desenho (skill de dataviz): um eixo só por gráfico (por isso
 * "Quantidade / Valor" é um seletor, não dois eixos); séries categóricas nas
 * cores --viz-1..4, sempre na mesma ordem; legenda em texto ao lado da cor;
 * gráfico sem dado mostra uma frase curta, nunca um eixo vazio.
 */

import { useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import style from "../../../styles/painel.module.css";
import ui from "../../../styles/ui.module.css";
import { CORES, EIXO, GRADE, CaixaDica, Cartao, Legenda, Vazio, corDaFatia, linhaDaDica, type DicaProps } from "./graficos-comuns";
import {
    formatarDiaCurto,
    formatarDiaLongo,
    formatarDinheiro,
    formatarInteiro,
} from "../../../utils/painel";
import type { FatiaDeCanal, LinhaDeForma, LinhaDeLote, VendaDoDia } from "../../../services/dashboard-api";

/* ------------------------------------------------------------ Vendas por dia */

function VendasPorDia({ serie }: { serie: VendaDoDia[] }) {
    const [medida, setMedida] = useState<"tickets" | "amount">("tickets");

    const seletor = (
        <div className={ui.seg} role="group" aria-label="Medida">
            {(
                [
                    ["tickets", "Quantidade"],
                    ["amount", "Valor"],
                ] as const
            ).map(([chave, rotulo]) => (
                <button
                    key={chave}
                    type="button"
                    className={`${ui.segItem} ${medida === chave ? ui.segActive : ""}`}
                    aria-pressed={medida === chave}
                    onClick={() => setMedida(chave)}
                >
                    {rotulo}
                </button>
            ))}
        </div>
    );

    return (
        <Cartao titulo="Vendas por dia" acao={serie.length > 0 ? seletor : undefined}>
            {serie.length === 0 ? (
                <Vazio>Nenhuma venda ainda.</Vazio>
            ) : (
                <div className={style.area} style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                            <CartesianGrid stroke={GRADE} vertical={false} />
                            <XAxis dataKey="date" tickFormatter={formatarDiaCurto} tick={EIXO} tickLine={false} axisLine={{ stroke: GRADE }} minTickGap={16} />
                            <YAxis
                                tick={EIXO}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={medida === "amount"}
                                width={medida === "amount" ? 84 : 40}
                                tickFormatter={(v: number) => (medida === "amount" ? formatarDinheiro(v) : formatarInteiro(v))}
                            />
                            <Tooltip
                                cursor={{ stroke: "var(--line-strong)" }}
                                content={(props: DicaProps<VendaDoDia>) => {
                                    const dia = linhaDaDica(props);
                                    if (!dia) return null;
                                    return (
                                        <CaixaDica
                                            titulo={formatarDiaLongo(dia.date)}
                                            linhas={[
                                                { rotulo: "Ingressos", valor: formatarInteiro(dia.tickets) },
                                                { rotulo: "Valor", valor: formatarDinheiro(dia.amount) },
                                            ]}
                                        />
                                    );
                                }}
                            />
                            <Area
                                type="linear"
                                dataKey={medida}
                                stroke="var(--viz-1)"
                                strokeWidth={2}
                                fill="var(--viz-1)"
                                fillOpacity={0.15}
                                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </Cartao>
    );
}

/* ------------------------------------------------------------------ Por lote */

const SERIES_DO_LOTE = [
    { chave: "member", rotulo: "Sócio", cor: CORES[0] },
    { chave: "non_member", rotulo: "Não sócio", cor: CORES[1] },
    { chave: "courtesies", rotulo: "Cortesias", cor: CORES[2] },
] as const;

type LinhaDoLoteNoGrafico = LinhaDeLote & { nome: string };

/** Marca da capacidade: um traço vertical na posição do limite do lote. */
function MarcaDeCapacidade(props: { cx?: number; cy?: number; value?: number | null }) {
    const { cx, cy, value } = props;
    if (value === null || value === undefined || cx === undefined || cy === undefined) return <g />;
    return <line x1={cx} x2={cx} y1={cy - 14} y2={cy + 14} stroke="var(--ink)" strokeWidth={2} strokeDasharray="3 2" />;
}

function PorLote({ linhas }: { linhas: LinhaDeLote[] }) {
    const dados: LinhaDoLoteNoGrafico[] = linhas.map((l) => ({ ...l, nome: [l.type, l.lot].filter(Boolean).join(" · ") }));
    const temCapacidade = linhas.some((l) => l.capacity !== null && l.capacity !== undefined);
    const vazio = linhas.length === 0 || linhas.every((l) => !l.total && !l.capacity);

    return (
        <Cartao titulo="Por lote">
            {vazio ? (
                <Vazio>Nenhum ingresso vendido ainda.</Vazio>
            ) : (
                <>
                    <Legenda
                        itens={[
                            ...SERIES_DO_LOTE.map((s) => ({ cor: s.cor, rotulo: s.rotulo })),
                            ...(temCapacidade ? [{ cor: "var(--ink)", rotulo: "Capacidade", tracejado: true }] : []),
                        ]}
                    />
                    <div className={style.area} style={{ height: Math.max(180, dados.length * 48 + 40) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={dados} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                                <CartesianGrid stroke={GRADE} horizontal={false} />
                                <XAxis type="number" tick={EIXO} tickLine={false} axisLine={{ stroke: GRADE }} allowDecimals={false} />
                                <YAxis type="category" dataKey="nome" tick={EIXO} tickLine={false} axisLine={false} width={120} />
                                <Tooltip
                                    cursor={{ fill: "var(--subtle)" }}
                                    content={(props: DicaProps<LinhaDoLoteNoGrafico>) => {
                                        const l = linhaDaDica(props);
                                        if (!l) return null;
                                        return (
                                            <CaixaDica
                                                titulo={l.nome}
                                                linhas={[
                                                    ...SERIES_DO_LOTE.map((s) => ({ rotulo: s.rotulo, valor: formatarInteiro(l[s.chave]), cor: s.cor })),
                                                    { rotulo: "Total", valor: formatarInteiro(l.total) },
                                                    { rotulo: "Capacidade", valor: l.capacity === null ? "Sem limite" : formatarInteiro(l.capacity) },
                                                    { rotulo: "Valor líquido", valor: formatarDinheiro(l.net) },
                                                ]}
                                            />
                                        );
                                    }}
                                />
                                {SERIES_DO_LOTE.map((s) => (
                                    <Bar
                                        key={s.chave}
                                        dataKey={s.chave}
                                        stackId="lote"
                                        fill={s.cor}
                                        stroke="var(--surface)"
                                        strokeWidth={2}
                                        barSize={22}
                                        isAnimationActive={false}
                                    />
                                ))}
                                {temCapacidade && (
                                    <Line
                                        dataKey="capacity"
                                        stroke="none"
                                        dot={<MarcaDeCapacidade />}
                                        activeDot={false}
                                        legendType="none"
                                        isAnimationActive={false}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </>
            )}
        </Cartao>
    );
}

/* ------------------------------------------------------------------ Por canal */

function Rosca({ titulo, fatias }: { titulo: string; fatias: FatiaDeCanal[] }) {
    const total = fatias.reduce((soma, f) => soma + (f.count || 0), 0);

    return (
        <div className={style.rosca}>
            <h4 className={style.roscaTitulo}>{titulo}</h4>
            {total === 0 ? (
                <Vazio>Nenhuma venda ainda.</Vazio>
            ) : (
                <>
                    <div className={style.area} style={{ height: 180 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={fatias}
                                    dataKey="count"
                                    nameKey="label"
                                    innerRadius="58%"
                                    outerRadius="88%"
                                    stroke="var(--surface)"
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                >
                                    {fatias.map((f, i) => (
                                        <Cell key={f.key} fill={corDaFatia(i)} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={(props: DicaProps<FatiaDeCanal>) => {
                                        const f = linhaDaDica(props);
                                        if (!f) return null;
                                        return (
                                            <CaixaDica
                                                titulo={f.label}
                                                linhas={[
                                                    { rotulo: "Ingressos", valor: formatarInteiro(f.count) },
                                                    { rotulo: "Valor", valor: formatarDinheiro(f.amount) },
                                                ]}
                                            />
                                        );
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <ul className={style.fatias}>
                        {fatias.map((f, i) => (
                            <li key={f.key}>
                                <span className={style.legendaCor} style={{ background: corDaFatia(i) }} aria-hidden="true" />
                                <span className={style.fatiaRotulo}>{f.label}</span>
                                <span className={style.mono}>{formatarInteiro(f.count)}</span>
                                <span className={`${style.mono} ${style.fatiaValor}`}>{formatarDinheiro(f.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

function PorCanal({ origem, comprador }: { origem: FatiaDeCanal[]; comprador: FatiaDeCanal[] }) {
    return (
        <Cartao titulo="Por canal">
            <div className={style.roscas}>
                <Rosca titulo="Origem" fatias={origem} />
                <Rosca titulo="Comprador" fatias={comprador} />
            </div>
        </Cartao>
    );
}

/* ------------------------------------------------------- Por forma de pagamento */

function PorForma({ linhas }: { linhas: LinhaDeForma[] }) {
    return (
        <Cartao titulo="Recebido por forma de pagamento">
            {linhas.length === 0 ? (
                <Vazio>Nenhum pagamento ainda.</Vazio>
            ) : (
                <div className={style.area} style={{ height: Math.max(160, linhas.length * 44 + 40) }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={linhas} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                            <CartesianGrid stroke={GRADE} horizontal={false} />
                            <XAxis type="number" tick={EIXO} tickLine={false} axisLine={{ stroke: GRADE }} tickFormatter={formatarDinheiro} />
                            <YAxis type="category" dataKey="method" tick={EIXO} tickLine={false} axisLine={false} width={120} />
                            <Tooltip
                                cursor={{ fill: "var(--subtle)" }}
                                content={(props: DicaProps<LinhaDeForma>) => {
                                    const l = linhaDaDica(props);
                                    if (!l) return null;
                                    return (
                                        <CaixaDica
                                            titulo={l.method}
                                            linhas={[
                                                { rotulo: "Pagamentos", valor: formatarInteiro(l.count) },
                                                { rotulo: "Pago", valor: formatarDinheiro(l.paid) },
                                                { rotulo: "Estornado", valor: formatarDinheiro(l.refunded) },
                                                { rotulo: "Recebido", valor: formatarDinheiro(l.received) },
                                            ]}
                                        />
                                    );
                                }}
                            />
                            <Bar dataKey="received" fill="var(--viz-1)" barSize={22} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </Cartao>
    );
}

/* ---------------------------------------------------------------- Conjunto */

interface GraficosIngressosProps {
    porDia: VendaDoDia[];
    porLote: LinhaDeLote[];
    origem: FatiaDeCanal[];
    comprador: FatiaDeCanal[];
    porForma: LinhaDeForma[];
}

export default function GraficosIngressos({ porDia, porLote, origem, comprador, porForma }: GraficosIngressosProps) {
    return (
        <div className={style.graficos}>
            <VendasPorDia serie={porDia} />
            <PorLote linhas={porLote} />
            <PorCanal origem={origem} comprador={comprador} />
            <PorForma linhas={porForma} />
        </div>
    );
}
