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
