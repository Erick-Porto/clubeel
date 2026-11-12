"use client";

/**
 * Gráficos do painel Vendas (MultiVendas), no layout do Grafana "Vendas Hoje".
 * Os dados chegam prontos do servidor e as listas já vêm do maior para o
 * menor: aqui nada é reordenado nem recalculado. O que o site soma é só o
 * "Outros" da rosca de pagamentos (além de 6 fatias), como o contrato pede.
 */

import { useEffect, useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import style from "../../../styles/painel.module.css";
import { formatarDiaCurto, formatarDiaLongo, formatarDinheiro, formatarInteiro, formatarValor } from "../../../utils/painel";
import type { ItemDeValor, Vendas } from "../../../services/dashboard-api";
import { EIXO, GRADE, CaixaDica, Cartao, Vazio, corDaFatia, linhaDaDica, type DicaProps } from "./graficos-comuns";

/** Altura de cada barra horizontal (barra + respiro). */
const PASSO = 34;
/** Acima disto o gráfico rola dentro do próprio cartão. */
const ALTURA_MAXIMA = 440;

/** Celular (≤ 600px): rótulos e margens menores para sobrar barra. */
function useTelaEstreita(): boolean {
    const [estreita, setEstreita] = useState(false);
    useEffect(() => {
        const consulta = window.matchMedia("(max-width: 600px)");
        const atualizar = () => setEstreita(consulta.matches);
        atualizar();
        consulta.addEventListener("change", atualizar);
        return () => consulta.removeEventListener("change", atualizar);
    }, []);
    return estreita;
}

function encurtar(texto: string, limite: number): string {
    return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
}

/* ------------------------------------------------- Barras horizontais (R$) */

/**
 * Lojas, produtos e vendedores: barras horizontais com o valor em R$ escrito
 * na ponta (sem eixo X: o número já está na barra). Muitos itens → o gráfico
 * fica alto e rola dentro do cartão, nunca a página.
 */
function BarrasDeValor({ itens, larguraDoRotulo: larguraNoDesktop = 140 }: { itens: ItemDeValor[]; larguraDoRotulo?: number }) {
    const estreita = useTelaEstreita();
    const larguraDoRotulo = estreita ? 96 : larguraNoDesktop;
    const altura = itens.length * PASSO + 8;
    const limite = Math.floor(larguraDoRotulo / 7);
    // Espaço à direita para o maior valor escrito na ponta (fonte mono 12px ≈ 7,3px por caractere).
    const maiorValor = Math.max(...itens.map((item) => formatarDinheiro(item.amount).length));
    const margemDireita = Math.ceil(maiorValor * 7.3) + 14;

    return (
        <div className={style.rolagem} style={{ maxHeight: ALTURA_MAXIMA }}>
            <div className={style.area} style={{ height: altura }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={itens} layout="vertical" margin={{ top: 4, right: margemDireita, bottom: 4, left: 0 }}>
                        <XAxis type="number" hide domain={[0, "dataMax"]} />
                        <YAxis
                            type="category"
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            width={larguraDoRotulo}
                            interval={0}
                            // Rótulo numa linha só (o tick padrão quebra o texto), truncado, com o nome inteiro no title.
                            tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => (
                                <text x={x} y={y} dy={4} textAnchor="end" fill={EIXO.fill} fontSize={EIXO.fontSize}>
                                    <title>{payload.value}</title>
                                    {encurtar(payload.value, limite)}
                                </text>
                            )}
                        />
                        <Tooltip
                            cursor={{ fill: "var(--subtle)" }}
                            content={(props: DicaProps<ItemDeValor>) => {
                                const item = linhaDaDica(props);
                                if (!item) return null;
                                return <CaixaDica titulo={item.label} linhas={[{ rotulo: "Valor", valor: formatarDinheiro(item.amount) }]} />;
                            }}
                        />
                        <Bar dataKey="amount" fill="var(--viz-1)" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                            <LabelList
                                dataKey="amount"
                                position="right"
                                formatter={(valor: number) => formatarDinheiro(valor)}
                                style={{ fill: "var(--ink-2)", fontSize: 12, fontFamily: "var(--font-mono)" }}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

/* --------------------------------------------------------------- Por dia */

function PorDia({ serie }: { serie: Vendas["by_day"] }) {
    return (
        <div className={style.area} style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRADE} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatarDiaCurto} tick={EIXO} tickLine={false} axisLine={{ stroke: GRADE }} minTickGap={16} />
                    <YAxis tick={EIXO} tickLine={false} axisLine={false} width={84} tickFormatter={formatarDinheiro} />
                    <Tooltip
                        cursor={{ stroke: "var(--line-strong)" }}
                        content={(props: DicaProps<Vendas["by_day"][number]>) => {
                            const dia = linhaDaDica(props);
                            if (!dia) return null;
                            return (
                                <CaixaDica
                                    titulo={formatarDiaLongo(dia.date)}
                                    linhas={[
                                        { rotulo: "Faturamento", valor: formatarDinheiro(dia.amount) },
                                        { rotulo: "Vendas", valor: formatarInteiro(dia.sales) },
                                    ]}
                                />
                            );
                        }}
                    />
                    <Area
                        type="linear"
                        dataKey="amount"
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
    );
}

/* -------------------------------------------------------------- Por hora */

const hora = (h: number) => `${String(h).padStart(2, "0")}h`;

function PorHora({ serie }: { serie: Vendas["by_hour"] }) {
    return (
        <div className={style.area} style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRADE} vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={hora} tick={EIXO} tickLine={false} axisLine={{ stroke: GRADE }} interval="preserveStartEnd" />
                    <YAxis tick={EIXO} tickLine={false} axisLine={false} width={84} tickFormatter={formatarDinheiro} />
                    <Tooltip
                        cursor={{ fill: "var(--subtle)" }}
                        content={(props: DicaProps<Vendas["by_hour"][number]>) => {
                            const h = linhaDaDica(props);
                            if (!h) return null;
                            return <CaixaDica titulo={`${hora(h.hour)} às ${hora(h.hour + 1)}`} linhas={[{ rotulo: "Valor", valor: formatarDinheiro(h.amount) }]} />;
                        }}
                    />
                    <Bar dataKey="amount" fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

/* ------------------------------------------------------------- Pagamentos */

const MAXIMO_DE_FATIAS = 6;

function Pagamentos({ itens }: { itens: ItemDeValor[] }) {
    // Até 6 fatias; o resto vira "Outros", somado aqui (pedido do contrato).
    const fatias: ItemDeValor[] =
        itens.length > MAXIMO_DE_FATIAS + 1
            ? [
                  ...itens.slice(0, MAXIMO_DE_FATIAS),
                  { label: "Outros", amount: itens.slice(MAXIMO_DE_FATIAS).reduce((soma, i) => soma + (i.amount || 0), 0) },
              ]
            : itens;
    const total = fatias.reduce((soma, f) => soma + (f.amount || 0), 0);
    const percentual = (valor: number) => (total > 0 ? formatarValor((valor / total) * 100, "percent") : "—");
    // "Outros" (7ª fatia) fica cinza: não é uma série, é o resto.
    const cor = (i: number) => (i >= MAXIMO_DE_FATIAS ? "var(--ink-3)" : corDaFatia(i));

    if (total <= 0) return <Vazio>Nenhum pagamento no período.</Vazio>;

    return (
        <>
            <div className={style.area} style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={fatias}
                            dataKey="amount"
                            nameKey="label"
                            innerRadius="55%"
                            outerRadius="80%"
                            stroke="var(--surface)"
                            strokeWidth={2}
                            isAnimationActive={false}
                            labelLine={false}
                            label={(props: { cx: number; cy: number; midAngle: number; outerRadius: number; percent: number }) => {
                                // Percentual fora da rosca; fatias finas (< 5%) ficam só na lista.
                                if (props.percent < 0.05) return null;
                                const raio = props.outerRadius + 14;
                                const angulo = (-props.midAngle * Math.PI) / 180;
                                const x = props.cx + raio * Math.cos(angulo);
                                const y = props.cy + raio * Math.sin(angulo);
                                return (
                                    <text
                                        x={x}
                                        y={y}
                                        fill="var(--ink-2)"
                                        fontSize={12}
                                        textAnchor={x > props.cx ? "start" : "end"}
                                        dominantBaseline="central"
                                    >
                                        {formatarValor(props.percent * 100, "percent")}
                                    </text>
                                );
                            }}
                        >
                            {fatias.map((f, i) => (
                                <Cell key={f.label} fill={cor(i)} />
                            ))}
                        </Pie>
                        <Tooltip
                            content={(props: DicaProps<ItemDeValor>) => {
                                const f = linhaDaDica(props);
                                if (!f) return null;
                                return (
                                    <CaixaDica
                                        titulo={f.label}
                                        linhas={[
                                            { rotulo: "Valor", valor: formatarDinheiro(f.amount) },
                                            { rotulo: "Participação", valor: percentual(f.amount) },
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
                    <li key={f.label}>
                        <span className={style.legendaCor} style={{ background: cor(i) }} aria-hidden="true" />
                        <span className={style.fatiaRotulo}>{f.label}</span>
                        <span className={style.mono}>{percentual(f.amount)}</span>
                        <span className={`${style.mono} ${style.fatiaValor}`}>{formatarDinheiro(f.amount)}</span>
                    </li>
                ))}
            </ul>
        </>
    );
}

/* ---------------------------------------------------------------- Conjunto */

export default function GraficosVendas({ vendas }: { vendas: Vendas }) {
    const { period, by_store, by_day, top_products, by_hour, payment_methods, sellers } = vendas;

    return (
        <div className={style.graficosVendas}>
            <Cartao titulo="Vendas por loja" largo>
                {by_store.length === 0 ? <Vazio>Nenhuma venda no período.</Vazio> : <BarrasDeValor itens={by_store} />}
            </Cartao>

            {/* Em um dia só a série seria um ponto: o bloco some. */}
            {period.days > 1 && (
                <Cartao titulo="Vendas por dia" largo>
                    {by_day.length === 0 ? <Vazio>Nenhuma venda no período.</Vazio> : <PorDia serie={by_day} />}
                </Cartao>
            )}

            <Cartao titulo="Produtos mais vendidos" largo>
                {top_products.length === 0 ? (
                    <Vazio>Nenhum produto vendido no período.</Vazio>
                ) : (
                    <BarrasDeValor itens={top_products.slice(0, 10)} larguraDoRotulo={200} />
                )}
            </Cartao>

            <Cartao titulo="Venda por hora">
                {by_hour.length === 0 ? <Vazio>Nenhuma venda no período.</Vazio> : <PorHora serie={by_hour} />}
            </Cartao>

            <Cartao titulo="Métodos de pagamento">
                <Pagamentos itens={payment_methods} />
            </Cartao>

            <Cartao titulo="Vendedores" largo>
                {sellers.length === 0 ? <Vazio>Nenhum vendedor no período.</Vazio> : <BarrasDeValor itens={sellers} />}
            </Cartao>
        </div>
    );
}
