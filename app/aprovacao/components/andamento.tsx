'use client';

/**
 * Andamento da aprovação: quem já decidiu, o que decidiu e quando.
 *
 * Apresentação pura, sem regra nenhuma — a ordem e o conteúdo dos passos são os
 * que a Lara devolveu. É client component porque também é renderizado depois de
 * uma decisão, dentro do painel de resultado.
 */

import type { Aprovacao } from '../../../services/aprovacao-api';
import { dataHora, ouTraco, rotuloDecisao, rotuloStatus } from '../formato';
import styles from '../../../styles/aprovacao.module.css';

function classeDaDecisao(decisao: string | null): string {
  if (decisao === 'approved') return styles.passoAprovado;
  if (decisao === 'rejected') return styles.passoReprovado;
  return styles.passoPendente;
}

export default function Andamento({ aprovacao }: { aprovacao: Aprovacao | null }) {
  if (!aprovacao) return null;

  const passos = Array.isArray(aprovacao.passos) ? aprovacao.passos : [];

  return (
    <section className={styles.bloco}>
      <h2 className={styles.blocoTitulo}>Andamento da aprovação</h2>

      <div className={styles.ordemCampos}>
        <div>
          <span className={styles.campoRotulo}>Nível atual</span>
          <span className={styles.campoValor}>
            {ouTraco(aprovacao.nivel_atual_rotulo)}
            {typeof aprovacao.nivel_atual === 'number' && ` (nível ${aprovacao.nivel_atual})`}
          </span>
        </div>
        <div>
          <span className={styles.campoRotulo}>Situação do processo</span>
          <span className={styles.campoValor}>{rotuloStatus(aprovacao.status)}</span>
        </div>
        {typeof aprovacao.aguardando === 'number' && (
          <div>
            <span className={styles.campoRotulo}>Decisões pendentes neste nível</span>
            <span className={styles.campoValor}>{aprovacao.aguardando}</span>
          </div>
        )}
      </div>

      {passos.length === 0 ? (
        <p className={styles.textoVazio}>Nenhum passo registrado.</p>
      ) : (
        <ol className={styles.passos}>
          {passos.map((passo, i) => (
            <li key={`${passo.nivel}-${i}`} className={classeDaDecisao(passo.decisao)}>
              <div className={styles.passoCabecalho}>
                <span className={styles.passoNivel}>Nível {passo.nivel}</span>
                <span className={styles.passoDecisao}>{rotuloDecisao(passo.decisao)}</span>
              </div>
              <div className={styles.passoResponsavel}>{ouTraco(passo.responsavel)}</div>
              <div className={styles.passoMeta}>
                {passo.decidido_por ? (
                  <>
                    por <strong>{passo.decidido_por}</strong>
                    {passo.decidido_em && ` em ${dataHora(passo.decidido_em)}`}
                  </>
                ) : (
                  'sem decisão registrada'
                )}
              </div>
              {passo.observacao && (
                <p className={styles.passoObservacao}>{passo.observacao}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
