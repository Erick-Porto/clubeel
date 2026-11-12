/**
 * /painel/ingressos — vendas de ingressos por evento.
 *
 * Tudo no servidor: acesso + lista de eventos, depois as 5 chamadas do evento
 * em paralelo (`lerDadosDoEvento`), sempre sem cache. O evento escolhido fica
 * na URL (`?evento=12`); sem ele abre o `default_event_id` da Lara. Os números,
 * rótulos e formatos são os que a Lara manda: o site só desenha.
 */

import { Suspense } from "react";
import PainelCasca from "../../components/Painel/PainelCasca";
import FalhaDoPainel from "../../components/Painel/FalhaDoPainel";
import SeletorDeEvento from "../../components/Painel/SeletorDeEvento";
import BotaoAtualizar from "../../components/Painel/BotaoAtualizar";
import EsqueletoDoEvento from "../../components/Painel/Esqueleto";
import GraficosIngressos from "../../components/Painel/GraficosIngressos";
import style from "../../../styles/painel.module.css";
import { lerAcesso, lerDadosDoEvento, lerEventosDoPainel } from "../../../services/dashboard-api";
import { formatarData, formatarHora, formatarValor } from "../../../utils/painel";

export const dynamic = "force-dynamic";

type Parametros = Promise<{ evento?: string | string[] }>;

export default async function PainelIngressos({ searchParams }: { searchParams: Parametros }) {
    const parametros = await searchParams;
    const [acesso, eventos] = await Promise.all([lerAcesso(), lerEventosDoPainel()]);

    if (!acesso.ok) {
        return (
            <PainelCasca>
                <FalhaDoPainel falha={acesso} />
            </PainelCasca>
        );
    }

    if (!eventos.ok) {
        return (
            <PainelCasca acesso={acesso.dados} ativo="ingressos">
                <FalhaDoPainel falha={eventos} />
            </PainelCasca>
        );
    }

    const lista = eventos.dados.events ?? [];
    if (lista.length === 0) {
        return (
            <PainelCasca acesso={acesso.dados} ativo="ingressos">
                <div className={style.aviso}>
                    <strong>Nenhum evento com vendas</strong>
                    <p>Quando um evento for publicado, os números dele aparecem aqui.</p>
                </div>
            </PainelCasca>
        );
    }

    // `?evento=` inválido não vira outro evento: cai no "Evento não encontrado".
    const bruto = Array.isArray(parametros.evento) ? parametros.evento[0] : parametros.evento;
    const escolhido = bruto === undefined ? (eventos.dados.default_event_id ?? lista[0].id) : /^\d+$/.test(bruto) ? Number(bruto) : null;

    return (
        <PainelCasca acesso={acesso.dados} ativo="ingressos">
            <div className={style.barra}>
                <SeletorDeEvento
                    eventos={lista.map(({ id, title, starts_at, status_label }) => ({ id, title, starts_at, status_label }))}
                    selecionado={escolhido}
                />
            </div>

            {escolhido === null ? (
                <FalhaDoPainel falha={{ ok: false, tipo: "nao-encontrado", mensagem: null }} />
            ) : (
                // A `key` faz a troca de evento mostrar o esqueleto; o "Atualizar"
                // (mesmo evento) mantém os números na tela enquanto busca.
                <Suspense key={escolhido} fallback={<EsqueletoDoEvento />}>
                    <ConteudoDoEvento id={escolhido} />
                </Suspense>
            )}
        </PainelCasca>
    );
}

async function ConteudoDoEvento({ id }: { id: number }) {
    const resultado = await lerDadosDoEvento(id);
    if (!resultado.ok) return <FalhaDoPainel falha={resultado} />;

    const { resumo, porDia, porLote, porCanal, porForma } = resultado.dados;
    const evento = resumo.event;
    const quando = [formatarData(evento.starts_at), formatarHora(evento.starts_at)].filter(Boolean).join(" às ");
    const atualizado = formatarHora(resumo.generated_at);

    return (
        <div className={style.conteudo}>
            <div className={style.cabecalhoEvento}>
                <div>
                    <h1 className={style.titulo}>{evento.title}</h1>
                    <p className={style.subtitulo}>
                        {[quando, evento.venue, evento.status_label].filter(Boolean).join(" · ")}
                    </p>
                </div>
                <div className={style.atualizacao}>
                    {atualizado && <span>Atualizado às {atualizado}</span>}
                    <BotaoAtualizar />
                </div>
            </div>

            {resumo.kpis.length > 0 && (
                <dl className={style.kpis}>
                    {resumo.kpis.map((kpi) => (
                        <div key={kpi.key} className={style.kpi}>
                            <dt>{kpi.label}</dt>
                            <dd className={style.mono}>{formatarValor(kpi.value, kpi.format)}</dd>
                        </div>
                    ))}
                </dl>
            )}

            <GraficosIngressos
                porDia={porDia}
                porLote={porLote}
                origem={porCanal.origin}
                comprador={porCanal.buyer}
                porForma={porForma}
            />
        </div>
    );
}
