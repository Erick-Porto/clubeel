"use client";

/**
 * Filtro do painel Vendas: período (atalhos ou de/até) e lojas. O filtro mora
 * na URL (`?de=AAAA-MM-DD&ate=AAAA-MM-DD&lojas=Loja A,Loja B`); a página do
 * servidor repassa à Lara como `from`, `to` e `stores[]`.
 *
 * - "Hoje" é o padrão e não põe datas na URL (sem datas, a Lara usa hoje).
 * - "Todas" não manda `stores[]`.
 * - Personalizado: data máxima hoje e no máximo 366 dias (o contrato pede o
 *   limite no campo). Quem valida de verdade é a Lara: o 422 dela aparece aqui,
 *   em `erro`, sem apagar os gráficos anteriores.
 */

import { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faCircleExclamation, faStore } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/painel.module.css";
import { DATA_ISO, diasNoPeriodo, formatarDiaLongo, hojeNoClube, somarDias } from "../../../utils/painel";
import { useVendas } from "./ContextoDeVendas";

const LIMITE_DE_DIAS = 366;

type Atalho = "hoje" | "ontem" | "7dias" | "mes" | "personalizado";

interface FiltroProps {
    /** Lista de `/sales/stores`, exatamente como veio. */
    lojas: string[];
    lojasIndisponiveis: boolean;
    de?: string;
    ate?: string;
    selecionadas: string[];
    /** Período que a Lara usou (para preencher o personalizado). */
    periodo: { from: string; to: string } | null;
    /** Mensagem do 422 da Lara. */
    erro: string | null;
}

function montarUrl(de: string | undefined, ate: string | undefined, lojas: string[]): string {
    const consulta = new URLSearchParams();
    if (de) consulta.set("de", de);
    if (ate) consulta.set("ate", ate);
    if (lojas.length > 0) consulta.set("lojas", lojas.join(","));
    const texto = consulta.toString();
    return texto ? `/painel/vendas?${texto}` : "/painel/vendas";
}

function periodoDoAtalho(atalho: Exclude<Atalho, "personalizado">, hoje: string): { de?: string; ate?: string } {
    switch (atalho) {
        case "hoje":
            return {};
        case "ontem": {
            const ontem = somarDias(hoje, -1);
            return { de: ontem, ate: ontem };
        }
        case "7dias":
            return { de: somarDias(hoje, -6), ate: hoje };
        case "mes":
            return { de: `${hoje.slice(0, 8)}01`, ate: hoje };
    }
}

function atalhoAtual(de: string | undefined, ate: string | undefined, hoje: string): Atalho {
    const inicio = de ?? hoje;
    const fim = ate ?? hoje;
    if (inicio === hoje && fim === hoje) return "hoje";
    for (const atalho of ["ontem", "7dias", "mes"] as const) {
        const p = periodoDoAtalho(atalho, hoje);
        if (p.de === inicio && p.ate === fim) return atalho;
    }
    return "personalizado";
}

const ROTULOS: [Atalho, string][] = [
    ["hoje", "Hoje"],
    ["ontem", "Ontem"],
    ["7dias", "7 dias"],
    ["mes", "Este mês"],
    ["personalizado", "Personalizado"],
];

export default function FiltroDeVendas({ lojas, lojasIndisponiveis, de, ate, selecionadas, periodo, erro }: FiltroProps) {
    const { navegar, pendente } = useVendas();
    const hoje = hojeNoClube();
    const atual = atalhoAtual(de, ate, hoje);

    const [abrirPersonalizado, setAbrirPersonalizado] = useState(atual === "personalizado");
    const [inicio, setInicio] = useState(de ?? periodo?.from ?? hoje);
    const [fim, setFim] = useState(ate ?? periodo?.to ?? hoje);
    const [erroLocal, setErroLocal] = useState<string | null>(null);

    const [marcadas, setMarcadas] = useState<string[]>(selecionadas);
    const lojasRef = useRef<HTMLDetailsElement>(null);

    const escolherAtalho = (atalho: Atalho) => {
        if (atalho === "personalizado") {
            setAbrirPersonalizado(true);
            return;
        }
        setAbrirPersonalizado(false);
        setErroLocal(null);
        const p = periodoDoAtalho(atalho, hoje);
        navegar(montarUrl(p.de, p.ate, selecionadas));
    };

    const aplicarPersonalizado = () => {
        if (!DATA_ISO.test(inicio) || !DATA_ISO.test(fim)) return setErroLocal("Preencha as duas datas.");
        if (fim > hoje) return setErroLocal("A data final não pode passar de hoje.");
        if (fim < inicio) return setErroLocal("A data final vem antes da inicial.");
        if (diasNoPeriodo(inicio, fim) > LIMITE_DE_DIAS) return setErroLocal(`O período pode ter no máximo ${LIMITE_DE_DIAS} dias.`);
        setErroLocal(null);
        navegar(montarUrl(inicio, fim, selecionadas));
    };

    const aplicarLojas = () => {
        if (lojasRef.current) lojasRef.current.open = false;
        // Todas marcadas = "Todas" (não manda `stores[]`).
        const lista = marcadas.length === lojas.length ? [] : marcadas;
        navegar(montarUrl(de, ate, lista));
    };

    const resumoLojas =
        selecionadas.length === 0 ? "Todas as lojas" : selecionadas.length === 1 ? selecionadas[0] : `${selecionadas.length} lojas`;
    const mensagem = erroLocal ?? erro;

    return (
        <section className={style.filtro} aria-label="Filtro" aria-busy={pendente}>
            <div className={style.filtroLinha}>
                <div className={style.atalhos} role="group" aria-label="Período">
                    {ROTULOS.map(([chave, rotulo]) => {
                        const ativo = chave === "personalizado" ? abrirPersonalizado || atual === "personalizado" : !abrirPersonalizado && atual === chave;
                        return (
                            <button
                                key={chave}
                                type="button"
                                className={`${ui.btn} ${ui.btnSm} ${ativo ? ui.btnPrimary : ui.btnSecondary}`}
                                aria-pressed={ativo}
                                onClick={() => escolherAtalho(chave)}
                                disabled={pendente}
                            >
                                {chave === "personalizado" && <FontAwesomeIcon icon={faCalendarDays} />} {rotulo}
                            </button>
                        );
                    })}
                </div>

                <details className={style.lojas} ref={lojasRef}>
                    <summary className={`${ui.btn} ${ui.btnSecondary} ${ui.btnSm}`}>
                        <FontAwesomeIcon icon={faStore} /> <span className={style.lojasResumo}>{resumoLojas}</span>
                    </summary>
                    <div className={style.lojasPainel}>
                        {lojasIndisponiveis ? (
                            <p className={style.vazio}>Não conseguimos carregar a lista de lojas.</p>
                        ) : (
                            <>
                                <label className={style.lojasItem}>
                                    <input type="checkbox" checked={marcadas.length === 0} onChange={() => setMarcadas([])} />
                                    <strong>Todas</strong>
                                </label>
                                {lojas.map((loja) => (
                                    <label key={loja} className={style.lojasItem}>
                                        <input
                                            type="checkbox"
                                            checked={marcadas.includes(loja)}
                                            onChange={(e) =>
                                                setMarcadas((atuais) =>
                                                    e.target.checked ? lojas.filter((l) => l === loja || atuais.includes(l)) : atuais.filter((l) => l !== loja)
                                                )
                                            }
                                        />
                                        {loja}
                                    </label>
                                ))}
                                <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${ui.btnSm}`} onClick={aplicarLojas} disabled={pendente}>
                                    Aplicar
                                </button>
                            </>
                        )}
                    </div>
                </details>
            </div>

            {abrirPersonalizado && (
                <div className={style.personalizado}>
                    <label>
                        <span className={style.rotulo}>De</span>
                        <input type="date" value={inicio} max={fim && fim < hoje ? fim : hoje} onChange={(e) => setInicio(e.target.value)} />
                    </label>
                    <label>
                        <span className={style.rotulo}>Até</span>
                        <input type="date" value={fim} min={inicio} max={hoje} onChange={(e) => setFim(e.target.value)} />
                    </label>
                    <button type="button" className={`${ui.btn} ${ui.btnPrimary} ${ui.btnSm}`} onClick={aplicarPersonalizado} disabled={pendente}>
                        Aplicar
                    </button>
                </div>
            )}

            {periodo && !mensagem && (
                <p className={style.periodo}>
                    {periodo.from === periodo.to
                        ? formatarDiaLongo(periodo.from)
                        : `${formatarDiaLongo(periodo.from)} a ${formatarDiaLongo(periodo.to)}`}
                </p>
            )}

            {mensagem && (
                <p className={style.erroFiltro} role="alert">
                    <FontAwesomeIcon icon={faCircleExclamation} /> {mensagem}
                </p>
            )}
        </section>
    );
}
