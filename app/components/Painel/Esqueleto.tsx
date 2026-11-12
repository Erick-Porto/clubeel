import style from "../../../styles/painel.module.css";

/** Carregando: o formato da tela (cards e gráficos) sem números. */
export default function EsqueletoDoEvento() {
    return (
        <div className={style.conteudo} aria-busy="true" aria-label="Carregando o painel">
            <div className={`${style.bloco} ${style.blocoTitulo}`} />
            <div className={style.kpis}>
                {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className={`${style.bloco} ${style.blocoKpi}`} />
                ))}
            </div>
            <div className={style.graficos}>
                {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className={`${style.bloco} ${style.blocoGrafico}`} />
                ))}
            </div>
        </div>
    );
}

/** Carregando Vendas: 3 cards e os blocos dos gráficos. */
export function EsqueletoDeVendas() {
    return (
        <div className={style.conteudo} aria-busy="true" aria-label="Carregando as vendas">
            <div className={style.kpis3}>
                {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className={`${style.bloco} ${style.blocoKpi}`} />
                ))}
            </div>
            <div className={style.graficosVendas}>
                <div className={`${style.bloco} ${style.blocoGrafico} ${style.graficoInteiro}`} />
                <div className={`${style.bloco} ${style.blocoGrafico} ${style.graficoInteiro}`} />
                <div className={`${style.bloco} ${style.blocoGrafico}`} />
                <div className={`${style.bloco} ${style.blocoGrafico}`} />
            </div>
        </div>
    );
}
