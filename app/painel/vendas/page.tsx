/**
 * /painel/vendas — números das lojas do clube (MultiVendas), no layout do
 * Grafana "Vendas Hoje", com período de/até e filtro de lojas.
 *
 * Tudo no servidor: acesso, lista de lojas e vendas em paralelo, sem cache no
 * site (o cache é da Lara: 60 s com hoje no período, 10 min no passado). O
 * filtro mora na URL (`?de=&ate=&lojas=A,B`) e vai à Lara como `from`, `to` e
 * `stores[]` sem ser reinterpretado: data inválida, período grande demais ou
 * loja desconhecida voltam como 422 e a mensagem aparece junto do filtro.
 */

import PainelCasca from "../../components/Painel/PainelCasca";
import FalhaDoPainel from "../../components/Painel/FalhaDoPainel";
import BotaoAtualizar from "../../components/Painel/BotaoAtualizar";
import AutoAtualizar from "../../components/Painel/AutoAtualizar";
import FiltroDeVendas from "../../components/Painel/FiltroDeVendas";
import GraficosVendas from "../../components/Painel/GraficosVendas";
import { MemoriaDeVendas, ProvedorDeVendas } from "../../components/Painel/ContextoDeVendas";
import style from "../../../styles/painel.module.css";
import { lerAcesso, lerLojas, lerVendas, type Vendas } from "../../../services/dashboard-api";
import { formatarHora, formatarValor, hojeNoClube } from "../../../utils/painel";

export const dynamic = "force-dynamic";

type Parametros = Promise<{ de?: string | string[]; ate?: string | string[]; lojas?: string | string[] }>;

const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor) || undefined;

export default async function PainelVendas({ searchParams }: { searchParams: Parametros }) {
    const parametros = await searchParams;
    const de = primeiro(parametros.de);
    const ate = primeiro(parametros.ate);
    const lojas = (primeiro(parametros.lojas) ?? "")
        .split(",")
        .map((loja) => loja.trim())
        .filter(Boolean);

    const [acesso, listaDeLojas, vendas] = await Promise.all([lerAcesso(), lerLojas(), lerVendas({ de, ate, lojas })]);

    if (!acesso.ok) {
        return (
            <PainelCasca>
                <FalhaDoPainel falha={acesso} />
            </PainelCasca>
        );
    }

    // Sessão vencida ou acesso retirado no meio do caminho valem para a tela toda.
    const fatal = [listaDeLojas, vendas].find((r) => !r.ok && (r.tipo === "login" || r.tipo === "sem-acesso"));
    if (fatal && !fatal.ok) {
        return (
            <PainelCasca>
                <FalhaDoPainel falha={fatal} />
            </PainelCasca>
        );
    }

    const invalido = !vendas.ok && vendas.tipo === "invalido";
    const erroDoFiltro = invalido ? vendas.mensagem || "Filtro inválido." : null;

    return (
        <PainelCasca acesso={acesso.dados} ativo="vendas">
            <ProvedorDeVendas>
                <FiltroDeVendas
                    // Nova URL → filtro remonta com os valores dela.
                    key={`${de ?? ""}|${ate ?? ""}|${lojas.join(",")}`}
                    lojas={listaDeLojas.ok ? listaDeLojas.dados.stores ?? [] : []}
                    lojasIndisponiveis={!listaDeLojas.ok}
                    de={de}
                    ate={ate}
                    selecionadas={lojas}
                    periodo={vendas.ok ? vendas.dados.period : null}
                    erro={erroDoFiltro}
                />
                <MemoriaDeVendas guardar={vendas.ok} invalido={invalido}>
                    {vendas.ok ? <ConteudoDeVendas vendas={vendas.dados} /> : invalido ? null : <FalhaDoPainel falha={vendas} />}
                </MemoriaDeVendas>
            </ProvedorDeVendas>
        </PainelCasca>
    );
}

function ConteudoDeVendas({ vendas }: { vendas: Vendas }) {
    const atualizado = formatarHora(vendas.generated_at);
    const incluiHoje = vendas.period.to >= hojeNoClube();
    const totalDeVendas = vendas.kpis.find((kpi) => kpi.key === "sales")?.value;
    const semVendas = totalDeVendas === 0;
    const lojasDoFiltro = vendas.stores.all ? "Todas as lojas" : vendas.stores.selected.join(", ");

    return (
        <div className={style.conteudo}>
            <div className={style.cabecalhoEvento}>
                <p className={style.subtitulo}>{lojasDoFiltro}</p>
                <div className={style.atualizacao}>
                    {atualizado && <span>Atualizado às {atualizado}</span>}
                    <BotaoAtualizar />
                    <AutoAtualizar ativo={incluiHoje} />
                </div>
            </div>

            {vendas.kpis.length > 0 && (
                <dl className={style.kpis3}>
                    {vendas.kpis.map((kpi) => (
                        <div key={kpi.key} className={style.kpi}>
                            <dt>{kpi.label}</dt>
                            <dd className={style.mono}>{formatarValor(kpi.value, kpi.format)}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {semVendas ? (
                <div className={style.aviso}>
                    <strong>Nenhuma venda neste período</strong>
                    <p>Escolha outro período ou outras lojas no filtro.</p>
                </div>
            ) : (
                <GraficosVendas vendas={vendas} />
            )}
        </div>
    );
}
